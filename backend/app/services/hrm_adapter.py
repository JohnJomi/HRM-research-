"""Thin adapter around the EXISTING HRM pipeline.

No HRM behaviour is reimplemented here. The adapter only:
  * builds the model once via the repository's own `init_train_state` +
    `load_compatible_state_dict` (the path proven in phase1-smoke-test.md),
  * encodes with the repository's own encoder,
  * drives the repository's own ACT loop,
  * decodes with the verified `decode_tokens`.

The model is treated as a black box.
"""
import json
import logging
import threading
import time
from dataclasses import dataclass, field, asdict
from typing import Any, Callable, Dict, List, Optional

import numpy as np
import torch
import yaml

from .arc_codec import decode_tokens, encode_grid_pair, grid_to_lists
from .hrm_runtime import (
    DEFAULT_CHECKPOINT,
    DEFAULT_CONFIG_PATH,
    DEFAULT_METADATA_PATH,
    PretrainConfig,
    PuzzleDatasetMetadata,
    arc_grid_to_np,
    get_compute_device,
    init_train_state,
    load_compatible_state_dict,
)
from .validation import validate_task

logger = logging.getLogger(__name__)

IGNORE_LABEL_ID = -100          # models/losses.py
BLANK_PUZZLE_IDENTIFIER = 0     # dataset metadata: blank_identifier_id

EventCallback = Optional[Callable[[Dict[str, Any]], None]]


@dataclass
class InferenceResult:
    prediction_grid: List[List[int]]
    input_grid: List[List[int]]
    steps: int
    max_steps: int
    elapsed_ms: float
    q_halt_logits: List[float]        # one per ACT step
    q_continue_logits: List[float]    # one per ACT step
    raw_tokens: List[int]             # the 900 argmax tokens

    # genuinely available extras
    device: str = ""
    dtype: str = ""
    logits_shape: List[int] = field(default_factory=list)
    decode_info: Dict[str, Any] = field(default_factory=dict)
    puzzle_identifier: int = BLANK_PUZZLE_IDENTIFIER

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class HRMAdapter:
    """Loads the HRM once; runs one inference at a time."""

    def __init__(
        self,
        checkpoint: str = DEFAULT_CHECKPOINT,
        config_path: str = DEFAULT_CONFIG_PATH,
        metadata_path: str = DEFAULT_METADATA_PATH,
    ) -> None:
        self.checkpoint = checkpoint
        self.config_path = config_path
        self.metadata_path = metadata_path

        # HRM carries mutable ACT state and MPS has a single command queue:
        # inference is serialized process-wide.
        self._lock = threading.Lock()

        self.loaded = False
        self.load_error: Optional[str] = None
        self.load_time_ms: Optional[float] = None
        self.device: Optional[torch.device] = None
        self.model = None
        self.max_steps: Optional[int] = None
        self.dtype: Optional[str] = None
        self.seq_len: Optional[int] = None

        self._load()

    # ------------------------------------------------------------------ load
    def _load(self) -> None:
        t0 = time.time()
        try:
            with open(self.config_path, "r") as f:
                config = PretrainConfig(**yaml.safe_load(f))
            # Only sizes the training-only local_weights buffer; eval indexes
            # the global embedding table directly.
            config.global_batch_size = 1

            with open(self.metadata_path, "r") as f:
                metadata = PuzzleDatasetMetadata(**json.load(f))

            self.device = get_compute_device()
            state = init_train_state(config, metadata, world_size=1)
            state.model = state.model.to(self.device)
            load_compatible_state_dict(state.model, self.checkpoint, self.device)

            # Mandatory: CastedSparseEmbedding and the ACT wrapper both branch
            # on self.training.
            state.model.eval()

            self.model = state.model
            self.seq_len = metadata.seq_len
            self.max_steps = int(config.arch.__pydantic_extra__.get("halt_max_steps", 0)) or None
            self.dtype = str(getattr(state.model.model.inner, "forward_dtype", ""))
            self.loaded = True
            self.load_time_ms = (time.time() - t0) * 1000.0
            logger.info(
                "HRM loaded in %.0f ms on %s (dtype=%s, halt_max_steps=%s)",
                self.load_time_ms, self.device, self.dtype, self.max_steps)
        except Exception as exc:  # noqa: BLE001 - surfaced via /api/health
            self.load_error = f"{type(exc).__name__}: {exc}"
            self.loaded = False
            logger.exception("HRM failed to load")

    # ------------------------------------------------------------- inference
    def run_inference(
        self,
        task: Dict[str, Any],
        test_index: int = 0,
        on_event: EventCallback = None,
    ) -> InferenceResult:
        def emit(stage: str, **payload: Any) -> None:
            if on_event is not None:
                on_event({"stage": stage, **payload})

        if not self.loaded:
            raise RuntimeError(f"HRM model is not loaded: {self.load_error}")

        emit("validating")
        validate_task(task, test_index)

        emit("preprocessing")
        example = task["test"][test_index]
        input_grid = arc_grid_to_np(example["input"])
        # The encoder needs an output grid to pair with; when the uploaded task
        # has no ground truth we pass the input's shape as a placeholder. Only
        # the encoded INPUT is fed to the model, so this never reaches the HRM.
        reference = example.get("output")
        output_grid = arc_grid_to_np(reference) if reference else input_grid

        enc_inp, _enc_out = encode_grid_pair(input_grid, output_grid)

        emit("encoding", seq_len=int(enc_inp.size))
        batch = {
            "inputs": torch.from_numpy(enc_inp).reshape(1, -1).to(self.device),
            "labels": torch.full((1, self.seq_len), IGNORE_LABEL_ID,
                                 dtype=torch.int32).to(self.device),
            "puzzle_identifiers": torch.full((1,), BLANK_PUZZLE_IDENTIFIER,
                                             dtype=torch.int32).to(self.device),
        }

        q_halt: List[float] = []
        q_cont: List[float] = []
        steps = 0

        t0 = time.time()
        with self._lock:                      # one inference at a time
            with torch.inference_mode():
                carry = self.model.initial_carry(batch)
                while True:
                    carry, _loss, _metrics, preds, all_finish = self.model(
                        carry=carry,
                        batch=batch,
                        return_keys=["logits", "q_halt_logits", "q_continue_logits"],
                    )
                    steps += 1
                    step_event: Dict[str, Any] = {"step": steps, "max_steps": self.max_steps}
                    if "q_halt_logits" in preds:
                        qh = float(preds["q_halt_logits"][0])
                        qc = float(preds["q_continue_logits"][0])
                        q_halt.append(qh)
                        q_cont.append(qc)
                        step_event["q_halt_logit"] = qh
                        step_event["q_continue_logit"] = qc
                    emit("act_step", **step_event)
                    if all_finish:
                        break

                logits = preds["logits"]
                logits_shape = [int(d) for d in logits.shape]
                pred_tokens = torch.argmax(logits[0], dim=-1).to(torch.int32).cpu().numpy()
        elapsed_ms = (time.time() - t0) * 1000.0

        emit("postprocessing")
        decoded, decode_info = decode_tokens(pred_tokens)

        result = InferenceResult(
            prediction_grid=grid_to_lists(decoded),
            input_grid=grid_to_lists(input_grid),
            steps=steps,
            max_steps=self.max_steps or steps,
            elapsed_ms=round(elapsed_ms, 2),
            q_halt_logits=q_halt,
            q_continue_logits=q_cont,
            raw_tokens=[int(t) for t in pred_tokens],
            device=str(self.device),
            dtype=self.dtype or "",
            logits_shape=logits_shape,
            decode_info=decode_info,
        )
        emit("complete", elapsed_ms=result.elapsed_ms, steps=steps,
             dimensions=[len(result.prediction_grid),
                         len(result.prediction_grid[0]) if result.prediction_grid else 0])
        return result

    # ---------------------------------------------------------------- status
    def status(self) -> Dict[str, Any]:
        return {
            "loaded": self.loaded,
            "error": self.load_error,
            "device": str(self.device) if self.device is not None else None,
            "dtype": self.dtype,
            "checkpoint": self.checkpoint,
            "config": self.config_path,
            "max_steps": self.max_steps,
            "load_time_ms": round(self.load_time_ms, 2) if self.load_time_ms else None,
        }


_adapter: Optional[HRMAdapter] = None
_adapter_lock = threading.Lock()


def get_adapter() -> HRMAdapter:
    """Process-wide singleton: the checkpoint is loaded exactly once."""
    global _adapter
    if _adapter is None:
        with _adapter_lock:
            if _adapter is None:
                _adapter = HRMAdapter()
    return _adapter
