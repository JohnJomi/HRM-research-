import importlib
import inspect
import json
import os

import numpy as np
import torch


def load_model_class(identifier: str, prefix: str = "models."):
    module_path, class_name = identifier.split('@')

    # Import the module
    module = importlib.import_module(prefix + module_path)
    cls = getattr(module, class_name)
    
    return cls


def get_model_source_path(identifier: str, prefix: str = "models."):
    module_path, class_name = identifier.split('@')

    module = importlib.import_module(prefix + module_path)
    return inspect.getsourcefile(module)


def get_compute_device() -> torch.device:
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return torch.device("mps")

    return torch.device("cpu")


def ensure_dataset_split_exists(dataset_path: str, split: str) -> str:
    dataset_json = os.path.join(dataset_path, split, "dataset.json")
    if os.path.exists(dataset_json):
        return dataset_json

    split_dir = os.path.join(dataset_path, split)
    available_files = []
    if os.path.isdir(split_dir):
        available_files = sorted(os.listdir(split_dir))

    raise FileNotFoundError(
        f"Missing dataset metadata: {dataset_json}. Available files in {split_dir}: {available_files}"
    )


def get_dataset_split_info(dataset_path: str, split: str) -> tuple[int, dict]:
    dataset_json = ensure_dataset_split_exists(dataset_path, split)

    with open(dataset_json, "r") as f:
        metadata = json.load(f)

    total_examples = 0
    for set_name in metadata.get("sets", []):
        inputs_path = os.path.join(dataset_path, split, f"{set_name}__inputs.npy")
        if os.path.exists(inputs_path):
            total_examples += int(np.load(inputs_path, mmap_mode="r").shape[0])

    return total_examples, metadata


def normalize_state_dict_keys(state_dict: dict[str, torch.Tensor], model_state_dict: dict[str, torch.Tensor]) -> dict[str, torch.Tensor]:
    if not state_dict:
        return state_dict

    model_has_prefix = any(key.startswith("_orig_mod.") for key in model_state_dict.keys())
    checkpoint_has_prefix = any(key.startswith("_orig_mod.") for key in state_dict.keys())

    if model_has_prefix and not checkpoint_has_prefix:
        return {f"_orig_mod.{key}": value for key, value in state_dict.items()}

    if checkpoint_has_prefix and not model_has_prefix:
        return {key.removeprefix("_orig_mod."): value for key, value in state_dict.items()}

    return state_dict


def filter_state_dict_by_shape(
    state_dict: dict[str, torch.Tensor],
    model_state_dict: dict[str, torch.Tensor],
) -> tuple[dict[str, torch.Tensor], list[tuple[str, torch.Size, torch.Size]]]:
    filtered_state_dict: dict[str, torch.Tensor] = {}
    skipped_keys: list[tuple[str, torch.Size, torch.Size]] = []

    for key, value in state_dict.items():
        model_value = model_state_dict.get(key)
        if isinstance(value, torch.Tensor) and isinstance(model_value, torch.Tensor) and value.shape != model_value.shape:
            skipped_keys.append((key, value.shape, model_value.shape))
            continue

        filtered_state_dict[key] = value

    return filtered_state_dict, skipped_keys
