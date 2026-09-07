"""ARC task validation.

Deliberately mirrors the constraints the existing encoder already imposes
(`dataset/build_arc_dataset.arc_grid_to_np`: 2-D, values 0..9, max 30x30)
and adds nothing beyond them.
"""
from typing import Any, Dict, List

from .hrm_runtime import ARCMaxGridSize


class ARCValidationError(ValueError):
    """Raised with a human-readable, location-specific message."""


def validate_grid(grid: Any, where: str) -> List[List[int]]:
    if not isinstance(grid, list) or not grid:
        raise ARCValidationError(f"{where}: grid must be a non-empty list of rows")

    if not all(isinstance(row, list) for row in grid):
        raise ARCValidationError(f"{where}: every row must be a list")

    if any(len(row) == 0 for row in grid):
        raise ARCValidationError(f"{where}: rows must be non-empty")

    widths = {len(row) for row in grid}
    if len(widths) != 1:
        raise ARCValidationError(
            f"{where}: grid is not rectangular (row lengths {sorted(widths)})")

    nrow, ncol = len(grid), len(grid[0])
    if nrow > ARCMaxGridSize or ncol > ARCMaxGridSize:
        raise ARCValidationError(
            f"{where}: grid is {nrow}x{ncol}, exceeds the "
            f"{ARCMaxGridSize}x{ARCMaxGridSize} maximum the HRM encoder supports")

    for r, row in enumerate(grid):
        for c, value in enumerate(row):
            if isinstance(value, bool) or not isinstance(value, int):
                raise ARCValidationError(
                    f"{where}[{r}][{c}]: expected an integer, got {type(value).__name__}")
            if not 0 <= value <= 9:
                raise ARCValidationError(
                    f"{where}[{r}][{c}]: ARC colors must be 0..9, got {value}")
    return grid


def validate_task(task: Dict[str, Any], test_index: int = 0) -> Dict[str, Any]:
    """Validate a raw ARC task. Returns it unchanged on success."""
    if not isinstance(task, dict):
        raise ARCValidationError("task must be a JSON object")

    for key in ("train", "test"):
        if key not in task:
            raise ARCValidationError(f"task is missing the required '{key}' key")
        if not isinstance(task[key], list):
            raise ARCValidationError(f"task['{key}'] must be a list of examples")

    if not task["test"]:
        raise ARCValidationError("task['test'] must contain at least one example")

    # 'train' pairs must be well-formed; the HRM does not consume them at
    # inference time (no in-context learning), but a malformed task is a
    # malformed task and the UI should hear about it.
    for split in ("train", "test"):
        for i, example in enumerate(task[split]):
            if not isinstance(example, dict):
                raise ARCValidationError(f"task['{split}'][{i}] must be an object")
            if "input" not in example:
                raise ARCValidationError(f"task['{split}'][{i}] is missing 'input'")
            validate_grid(example["input"], f"task['{split}'][{i}]['input']")
            if "output" in example and example["output"] is not None:
                validate_grid(example["output"], f"task['{split}'][{i}]['output']")
            elif split == "train":
                raise ARCValidationError(f"task['train'][{i}] is missing 'output'")

    if not 0 <= test_index < len(task["test"]):
        raise ARCValidationError(
            f"test_index {test_index} is out of range "
            f"(task has {len(task['test'])} test example(s))")

    return task
