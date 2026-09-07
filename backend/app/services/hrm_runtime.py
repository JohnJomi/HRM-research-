"""Import shim for the existing HRM repository.

The HRM repo is a flat top-level package (`pretrain.py`, `evaluate.py`,
`utils/`, `models/`, `dataset/`) and `dataset/build_arc_dataset.py` imports its
sibling as bare `common`. This module puts the repo root and `dataset/` on
sys.path once, then re-exports the existing APIs. Nothing here reimplements
HRM behaviour.
"""
import os
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
DATASET_DIR = os.path.join(REPO_ROOT, "dataset")

for _p in (REPO_ROOT, DATASET_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# Existing repository APIs (Phase 1 discovery)
from pretrain import PretrainConfig, init_train_state            # noqa: E402
from evaluate import load_compatible_state_dict                  # noqa: E402
from utils.functions import get_compute_device                   # noqa: E402
from dataset.common import PuzzleDatasetMetadata                 # noqa: E402
from build_arc_dataset import (                                  # noqa: E402
    ARCMaxGridSize,
    arc_grid_to_np,
    np_grid_to_seq_translational_augment,
)

DEFAULT_CONFIG_PATH = os.path.join(REPO_ROOT, "checkpoints", "all_config.yaml")
DEFAULT_CHECKPOINT = os.path.join(REPO_ROOT, "checkpoints", "step_181776")
DEFAULT_METADATA_PATH = os.path.join(REPO_ROOT, "data", "arc-small", "train", "dataset.json")

__all__ = [
    "REPO_ROOT",
    "PretrainConfig",
    "init_train_state",
    "load_compatible_state_dict",
    "get_compute_device",
    "PuzzleDatasetMetadata",
    "ARCMaxGridSize",
    "arc_grid_to_np",
    "np_grid_to_seq_translational_augment",
    "DEFAULT_CONFIG_PATH",
    "DEFAULT_CHECKPOINT",
    "DEFAULT_METADATA_PATH",
]
