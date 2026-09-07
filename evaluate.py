from typing import List
import yaml
import os
from typing import Optional
import math

import numpy as np
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

                if storage_id_str not in storage_files:
                    # External tensor file absent from the checkpoint directory.
                    # Build a zero-size 'meta' placeholder so unpickling can finish;
                    # it allocates no memory and is dropped later by
                    # filter_state_dict_by_shape / load_state_dict(strict=False).
                    numel = pid[4] if len(pid) > 4 else 0
                    print(f"[Checkpoint][WARNING] Missing external tensor file "
                          f"'{storage_id_str}' ({class_name}, numel={numel}). "
                          f"The parameter backed by it will NOT be loaded.")
                    tensor = torch.empty(numel, dtype=dtype, device="meta")
                    untyped_storage = tensor.untyped_storage()

                    class MetaStorageWithDtype:
                        def __init__(self, untyped_storage, dtype):
                            self._untyped_storage = untyped_storage
                            self.dtype = dtype
                            self.device = untyped_storage.device

                        def __getattr__(self, name):
                            return getattr(self._untyped_storage, name)

                    return MetaStorageWithDtype(untyped_storage, dtype)

                raw_data = storage_files[storage_id_str]

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
                        # 'meta' placeholders for missing files cannot be copied
                        if obj.device.type == "meta":
                            return obj
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


def _print_sample_from_loader(loader, title: str):
    """Print the first sample from a loader for debugging."""
    for _set_name, batch, _global_batch_size in loader:
        inp = batch["inputs"][0].cpu().numpy()
        lbl = batch["labels"][0].cpu().numpy()
        
        # Reshape 1D to 2D if it's a perfect square
        if inp.ndim == 1:
            side = int(math.sqrt(inp.shape[0]))
            if side * side == inp.shape[0]:
                inp = inp.reshape(side, side)
        
        if lbl.ndim == 1:
            side = int(math.sqrt(lbl.shape[0]))
            if side * side == lbl.shape[0]:
                lbl = lbl.reshape(side, side)
        
        print(f"\n===== {title} =====")
        print(f"Input shape: {inp.shape}")
        if inp.ndim == 2:
            print(inp[:5, :5])
        else:
            print(inp[:10])
        print(f"Label shape: {lbl.shape}")
        if lbl.ndim == 2:
            print(lbl[:5, :5])
        else:
            print(lbl[:10])
        break


def _print_prediction_sample(model: torch.nn.Module, loader, device: torch.device):
    """Print model prediction for the first sample from a loader."""
    with torch.no_grad():
        for _set_name, batch, _global_batch_size in loader:
            batch = {k: v.to(device) for k, v in batch.items()}
            carry = model.initial_carry(batch)  # type: ignore

            # Run model forward pass until completion
            while True:
                carry, _, _, preds, all_finish = model(carry=carry, batch=batch, return_keys=["logits"])
                if all_finish:
                    break

            # Extract prediction and ground truth
            pred_tokens = torch.argmax(preds["logits"][0], dim=-1).cpu().numpy()
            gt_tokens = batch["labels"][0].cpu().numpy()
            inp = batch["inputs"][0].cpu().numpy()

            # Reshape 1D to 2D if perfect square
            def reshape_if_1d(arr):
                if arr.ndim == 1:
                    side = int(math.sqrt(arr.shape[0]))
                    if side * side == arr.shape[0]:
                        arr = arr.reshape(side, side)
                return arr

            inp = reshape_if_1d(inp)
            pred_tokens = reshape_if_1d(pred_tokens)
            gt_tokens = reshape_if_1d(gt_tokens)

            # Print prediction sample
            print(f"\n===== PREDICTION SAMPLE =====")
            print(f"Input shape: {inp.shape}")
            if inp.ndim == 2:
                print(inp[:5, :5])
            else:
                print(inp[:10])

            print(f"Prediction shape: {pred_tokens.shape}")
            if pred_tokens.ndim == 2:
                print(pred_tokens[:5, :5])
            else:
                print(pred_tokens[:10])

            print(f"Ground Truth shape: {gt_tokens.shape}")
            if gt_tokens.ndim == 2:
                print(gt_tokens[:5, :5])
            else:
                print(gt_tokens[:10])

            break


def _print_raw_dataset_sample(data_path: str, split: str, num_samples: int = 1):
    """Print actual ARC puzzle samples from raw data before preprocessing.
    
    Loads puzzle IDs from identifiers.json and displays the first num_samples
    puzzles from their raw ARC JSON files, showing the train/test structure.
    
    Args:
        data_path: Path to processed dataset directory (e.g., 'data/arc-small')
        split: 'train' or 'test' (specifies which split to sample from)
        num_samples: Number of actual puzzle samples to display
    """
    import json
    import glob as glob_module
    
    header = f"RAW {split.upper()} SAMPLE"
    print(f"\n===== {header} =====")
    
    try:
        # Load puzzle identifiers
        identifiers_path = os.path.join(data_path, "identifiers.json")
        if not os.path.exists(identifiers_path):
            print(f"[Warning] Identifiers file not found: {identifiers_path}")
            return
        
        with open(identifiers_path, 'r') as f:
            identifiers = json.load(f)
        
        # Find raw ARC data directories
        raw_data_dirs = []
        for base_dir in ["dataset/raw-data/ARC-AGI/data", 
                         "dataset/raw-data/ARC-AGI-2/data",
                         "dataset/raw-data/ConceptARC/corpus"]:
            if os.path.exists(base_dir):
                raw_data_dirs.append(base_dir)
        
        if not raw_data_dirs:
            print("[Warning] No raw ARC data found in dataset/raw-data/")
            return
        
        # Collect puzzle files from the appropriate split
        puzzle_files = []
        for raw_dir in raw_data_dirs:
            # Check for split subdirectories
            split_dir = os.path.join(raw_dir, split)
            if os.path.exists(split_dir):
                puzzle_files.extend(glob_module.glob(os.path.join(split_dir, "*.json")))
            
            # Also check for alternative split names (e.g., 'training' vs 'train')
            if split == "train":
                alt_dir = os.path.join(raw_dir, "training")
                if os.path.exists(alt_dir):
                    puzzle_files.extend(glob_module.glob(os.path.join(alt_dir, "*.json")))
            elif split == "test":
                alt_dir = os.path.join(raw_dir, "evaluation")
                if os.path.exists(alt_dir):
                    puzzle_files.extend(glob_module.glob(os.path.join(alt_dir, "*.json")))
        
        if not puzzle_files:
            print(f"[Warning] No puzzle files found for split '{split}' in raw ARC data")
            return
        
        # Print first num_samples puzzles
        printed = 0
        for puzzle_file in puzzle_files[:num_samples]:
            try:
                with open(puzzle_file, 'r') as f:
                    puzzle_data = json.load(f)
                
                puzzle_id = os.path.basename(puzzle_file).replace('.json', '')
                print(f"\n[Puzzle {printed}: {puzzle_id}]")
                print(f"Train examples: {len(puzzle_data.get('train', []))}, "
                      f"Test examples: {len(puzzle_data.get('test', []))}")
                
                # Print first train example structure
                if puzzle_data.get('train'):
                    first_train = puzzle_data['train'][0]
                    print(f"Train[0] input shape: {np.array(first_train['input']).shape}, "
                          f"output shape: {np.array(first_train['output']).shape}")
                
                # Print the full first example for one puzzle
                if printed == 0:
                    print(f"\nFull structure of first puzzle:")
                    display_data = {
                        'train': puzzle_data.get('train', [])[:1],
                        'test': puzzle_data.get('test', [])[:1]
                    }
                    print(json.dumps(display_data, indent=2)[:1500])
                
                printed += 1
            
            except Exception as e:
                print(f"[Warning] Failed to load puzzle {puzzle_file}: {e}")
                continue
    
    except FileNotFoundError:
        print(f"[Warning] Identifiers file not found: {identifiers_path}")
    except json.JSONDecodeError as e:
        print(f"[Warning] Failed to parse identifiers JSON: {e}")
    except Exception as e:
        print(f"[Warning] Error reading raw dataset samples: {e}")


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

    # Print raw dataset samples before preprocessing
    _print_raw_dataset_sample(config.data_path, "train", 1)
    _print_raw_dataset_sample(config.data_path, "test", 1)

    train_examples, _ = get_dataset_split_info(config.data_path, "train")
    eval_examples, _ = get_dataset_split_info(config.data_path, "test")
    print(f"[Dataset] train examples: {train_examples}")
    print(f"[Dataset] eval examples: {eval_examples}")
    if eval_cfg.max_samples is not None:
        print(f"[Dataset] eval subset limit: {eval_cfg.max_samples}")

    # Dataloader
    train_loader, train_metadata = create_dataloader(config, "train", test_set_mode=False, epochs_per_iter=1, global_batch_size=config.global_batch_size, rank=RANK, world_size=WORLD_SIZE)
    eval_loader,  eval_metadata  = create_dataloader(config, "test", test_set_mode=True, epochs_per_iter=1, global_batch_size=config.global_batch_size, rank=RANK, world_size=WORLD_SIZE)

    # Print one sample from each loader for inspection
    _print_sample_from_loader(train_loader, "TRAIN SAMPLE")
    _print_sample_from_loader(eval_loader, "TEST SAMPLE")

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

    _print_prediction_sample(train_state.model, eval_loader, device)

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
