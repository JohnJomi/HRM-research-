from typing import List
import yaml
import os
from typing import Optional

import torch
import torch.distributed as dist
import tqdm

import pydantic
from omegaconf import OmegaConf
from pretrain import PretrainConfig, init_train_state, evaluate, create_dataloader
from utils.functions import get_dataset_split_info, get_compute_device, normalize_state_dict_keys, filter_state_dict_by_shape


class EvalConfig(pydantic.BaseModel):
    checkpoint: str
    max_samples: Optional[int] = None
    
    save_outputs: List[str] = ["inputs", "labels", "puzzle_identifiers", "logits", "q_halt_logits", "q_continue_logits"]


def load_checkpoint(checkpoint_path: str, device: str = "cpu"):
    """
    Load a checkpoint that may be stored as either a file or a directory.
    
    Supports:
    - Standard .pth/.pt files (PyTorch 1.x format)
    - Directory-format checkpoints (torch.distributed.checkpoint format)
    
    Returns state_dict in standard format for model.load_state_dict()
    """
    
    if os.path.isdir(checkpoint_path):
        # Handle directory-based checkpoint format
        # First, try using torch.distributed.checkpoint API (official & proper)
        try:
            from torch.distributed.checkpoint import load_state_dict
            
            # Create a minimal model state dict structure
            # The distributed checkpoint loader expects to populate this
            state_dict = {}
            
            # Define a callback to capture loaded tensors
            def stateful_fn(module):
                return state_dict
            
            # Try to load using the distributed checkpoint API
            try:
                load_state_dict(
                    state_dict=state_dict,
                    storage_reader=None,  # Uses default file reader
                    checkpoint_dir=checkpoint_path,
                )
                # Successfully loaded, move to device
                return {k: v.to(device) if isinstance(v, torch.Tensor) else v 
                        for k, v in state_dict.items()}
            except Exception:
                # distributed API might not work for this checkpoint format
                # Fall through to manual loading below
                pass
                
        except ImportError:
            # torch.distributed.checkpoint not available
            pass
        
        # Fallback: Manual loading from pickle + separate tensor files
        # This handles PyTorch 2.0+ directory format with external storage
        import pickle
        import io
        
        pkl_path = os.path.join(checkpoint_path, 'data.pkl')
        data_dir = os.path.join(checkpoint_path, 'data')
        
        if not os.path.exists(pkl_path):
            raise FileNotFoundError(
                f"No checkpoint pickle found at {pkl_path}. "
                f"Directory contents: {os.listdir(checkpoint_path)}"
            )
        
        # Pre-load all tensor storage files into memory
        storage_files = {}
        if os.path.exists(data_dir):
            for filename in sorted(os.listdir(data_dir)):
                if filename.isdigit():
                    filepath = os.path.join(data_dir, filename)
                    with open(filepath, 'rb') as f:
                        storage_files[filename] = f.read()
        
        print(f"[Checkpoint] Loaded {len(storage_files)} external tensor files")
        
        # Create handler to reconstruct Storage objects from persistent references
        def persistent_load(pid):
            """Reconstruct Storage objects for unpickling."""
            if not isinstance(pid, tuple) or len(pid) < 3:
                return None
            
            if pid[0] != 'storage':
                return None
            
            storage_class = pid[1]      # e.g., torch.BFloat16Storage
            storage_id_str = pid[2]     # e.g., '0' (string ID)
            
            if storage_id_str not in storage_files:
                return None
            
            raw_data = storage_files[storage_id_str]
            
            # Reconstruct the Storage from raw binary data
            try:
                # Map storage class to dtype
                class_name = storage_class.__name__
                dtype_map = {
                    'FloatStorage': torch.float32,
                    'DoubleStorage': torch.float64,
                    'HalfStorage': torch.float16,
                    'BFloat16Storage': torch.bfloat16,
                    'LongStorage': torch.int64,
                    'IntStorage': torch.int32,
                    'Int8Storage': torch.int8,
                    'BoolStorage': torch.bool,
                }
                dtype = dtype_map.get(class_name, torch.float32)
                
                # Create a tensor from raw bytes
                tensor = torch.frombuffer(raw_data, dtype=dtype).clone()
                
                # Return a Storage-like object with dtype attribute
                # For PyTorch 2.0+, we need to wrap the untyped storage
                untyped_storage = tensor.untyped_storage()
                
                # Create a wrapper that preserves dtype for _rebuild_tensor
                class StorageWithDtype:
                    def __init__(self, untyped_storage, dtype):
                        self._untyped_storage = untyped_storage
                        self.dtype = dtype
                        self.device = untyped_storage.device
                    
                    def __getattr__(self, name):
                        # Delegate to the untyped storage for other attributes
                        return getattr(self._untyped_storage, name)
                
                return StorageWithDtype(untyped_storage, dtype)
                    
            except Exception as e:
                print(f"[Warning] Could not reconstruct storage {storage_id_str}: {e}")
                return None
        
        # Load the state dict from pickle
        with open(pkl_path, 'rb') as pkl_file:
            unpickler = pickle.Unpickler(pkl_file)
            unpickler.persistent_load = persistent_load
            
            try:
                state_dict = unpickler.load()
                print(f"[Checkpoint] Loaded state dict with {len(state_dict)} keys")
                
                # Recursively move all tensors to the target device
                def move_to_device(obj):
                    if isinstance(obj, torch.Tensor):
                        return obj.to(device)
                    elif isinstance(obj, dict):
                        return {k: move_to_device(v) for k, v in obj.items()}
                    elif isinstance(obj, (list, tuple)):
                        return type(obj)(move_to_device(v) for v in obj)
                    return obj
                
                return move_to_device(state_dict)
                
            except Exception as e:
                raise RuntimeError(
                    f"Failed to load checkpoint from {checkpoint_path}\n"
                    f"Error: {e}\n"
                    "This directory-format checkpoint could not be loaded. "
                    "The data.pkl file may be corrupted or incompatible with this PyTorch version."
                )
    
    else:
        # Standard file-based checkpoint (.pth or .pt)
        print(f"[Checkpoint] Loading from file: {checkpoint_path}")
        return torch.load(checkpoint_path, map_location=device, weights_only=False)


def load_compatible_state_dict(model: torch.nn.Module, checkpoint_path: str, device: torch.device):
    checkpoint_state = load_checkpoint(checkpoint_path, str(device))
    if not isinstance(checkpoint_state, dict):
        raise TypeError(f"Checkpoint at {checkpoint_path} did not return a state dict")

    model_state = model.state_dict()
    checkpoint_state = normalize_state_dict_keys(checkpoint_state, model_state)
    checkpoint_state, skipped_keys = filter_state_dict_by_shape(checkpoint_state, model_state)

    if skipped_keys:
        print(f"[Checkpoint] Skipped {len(skipped_keys)} parameters due to shape mismatch:")
        for key, ckpt_shape, model_shape in skipped_keys[:5]:
            print(f"  {key}: checkpoint {ckpt_shape} vs model {model_shape}")
        if len(skipped_keys) > 5:
            print(f"  ... and {len(skipped_keys) - 5} more")

    incompatible = model.load_state_dict(checkpoint_state, strict=False, assign=True)
    if incompatible.missing_keys:
        print(f"[Checkpoint] Loaded successfully with {len(incompatible.missing_keys)} missing keys")
    if incompatible.unexpected_keys:
        print(f"[Checkpoint] Unexpected keys ignored: {len(incompatible.unexpected_keys)}")

    return checkpoint_state


def launch():
    eval_cfg = EvalConfig(**OmegaConf.to_container(OmegaConf.from_cli()))  # type: ignore
    
    RANK = 0
    WORLD_SIZE = 1
    # Initialize distributed training if in distributed environment (e.g. torchrun)
    if "LOCAL_RANK" in os.environ:
        # Initialize distributed, default device and dtype
        dist.init_process_group(backend="gloo")

        RANK = dist.get_rank()
        WORLD_SIZE = dist.get_world_size()

    checkpoint_dir = os.path.dirname(eval_cfg.checkpoint)
    with open(os.path.join(checkpoint_dir, "all_config.yaml"), "r") as f:
        config = PretrainConfig(**yaml.safe_load(f))

        config.eval_save_outputs = eval_cfg.save_outputs
        config.checkpoint_path = checkpoint_dir

    if eval_cfg.max_samples is not None:
        config.global_batch_size = min(config.global_batch_size, max(1, eval_cfg.max_samples))

    train_examples, _ = get_dataset_split_info(config.data_path, "train")
    eval_examples, _ = get_dataset_split_info(config.data_path, "test")
    print(f"[Dataset] train examples: {train_examples}")
    print(f"[Dataset] eval examples: {eval_examples}")
    if eval_cfg.max_samples is not None:
        print(f"[Dataset] eval subset limit: {eval_cfg.max_samples}")

    # Dataloader
    train_loader, train_metadata = create_dataloader(config, "train", test_set_mode=False, epochs_per_iter=1, global_batch_size=config.global_batch_size, rank=RANK, world_size=WORLD_SIZE)
    eval_loader,  eval_metadata  = create_dataloader(config, "test", test_set_mode=True, epochs_per_iter=1, global_batch_size=config.global_batch_size, rank=RANK, world_size=WORLD_SIZE)

    # Models
    device = get_compute_device()
    train_state = init_train_state(config, train_metadata, world_size=WORLD_SIZE)
    train_state.model = train_state.model.to(device)
    # Load checkpoint (handles both file and directory formats)
    try:
        load_compatible_state_dict(train_state.model, eval_cfg.checkpoint, device)
    except Exception as e:
        print(f"[Error] Failed to load checkpoint: {e}")
        raise
    
    train_state.step = 0
    ckpt_filename = os.path.basename(eval_cfg.checkpoint)
    if ckpt_filename.startswith("step_"):
        train_state.step = int(ckpt_filename.removeprefix("step_"))

    # Evaluate
    print ("Starting evaluation")
    
    train_state.model.eval()
    metrics = evaluate(config, train_state, eval_loader, eval_metadata, rank=RANK, world_size=WORLD_SIZE, max_samples=eval_cfg.max_samples)

    if metrics is not None:
        total_count = 0.0
        total_exact = 0.0
        for set_name, set_metrics in metrics.items():
            count = float(set_metrics.get("count", 0))
            exact_accuracy = float(set_metrics.get("exact_accuracy", 0.0))
            total_count += count
            total_exact += exact_accuracy * count

            print(f"[Metrics] {set_name}: {set_metrics}")

        if total_count > 0:
            print("Evaluation complete")
            print(f"Accuracy: {total_exact:.0f} / {total_count:.0f}")
            print(f"Success rate: {100.0 * total_exact / total_count:.2f}%")


if __name__ == "__main__":
    launch()
