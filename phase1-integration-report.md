# Phase 1 — HRM Integration Assessment

Scope: read-only inspection to define the Phase 2 adapter. No code changed.

Files inspected: `evaluate.py`, `pretrain.py`, `puzzle_dataset.py`, `utils/functions.py`,
`models/hrm/hrm_act_v1.py`, `models/losses.py`, `models/sparse_embedding.py`,
`dataset/build_arc_dataset.py`, `checkpoints/all_config.yaml`, `data/arc-small/*/dataset.json`.

---

## 1. Existing inference entry point

`evaluate.py:launch()` (`python evaluate.py checkpoint=checkpoints/step_181776`).

It is a **batch/offline CLI over a pre-built dataset directory** — not a per-task API.
Sequence inside `launch()`:

1. Read CLI via `OmegaConf.from_cli()` into `EvalConfig` (`evaluate.py:18`).
2. Load `<checkpoint_dir>/all_config.yaml` → `PretrainConfig` (`pretrain.py:39`).
3. `create_dataloader(config, "train"|"test", ...)` (`pretrain.py:84`).
4. `init_train_state(config, train_metadata, world_size=1)` (`pretrain.py:185`) → builds model.
5. `load_compatible_state_dict(model, checkpoint, device)` (`evaluate.py:174`).
6. `evaluate(...)` (`pretrain.py:279`) — the actual inference loop over batches.

The single-sample reference path is `_print_prediction_sample()` (`evaluate.py:222`) — this is
the closest existing analogue to "run one inference" and is the model for the Phase 2 adapter.

## 2. Input it accepts

**Today:** only a *pre-built dataset directory* (`config.data_path`, currently `data/arc-small`)
containing per-split `.npy` memmaps + `dataset.json`. There is no path that takes a raw ARC JSON.

Raw ARC JSON format (per `dataset/build_arc_dataset.py`):
```json
{ "train": [{"input": [[..]], "output": [[..]]}, ...],
  "test":  [{"input": [[..]], "output": [[..]]}, ...] }
```
Grids: 2-D int, values 0–9, max 30×30 (`ARCMaxGridSize = 30`, `arc_grid_to_np`, line 43).

**Model-level input** (what `model(...)` needs) is a dict of tensors:
- `inputs`: int32 `(B, 900)`
- `labels`: int32 `(B, 900)` — required by `ACTLossHead.forward`, even at eval
- `puzzle_identifiers`: int32 `(B,)`

## 3. Preprocessing before inference

`dataset/build_arc_dataset.py:np_grid_to_seq_translational_augment(inp, out, do_translation)` (line 54):
- token map: `PAD=0`, `<eos>=1`, colors `0..9 → 2..11` (so `vocab_size = 12`)
- pad grid to 30×30 (top-left offset 0,0 when `do_translation=False`, which is the test-set setting)
- write `<eos>=1` on the row below and column right of the grid content — this is how the
  model encodes output grid dimensions
- flatten → length-900 int sequence

Then `PuzzleDataset._collate_batch` (`puzzle_dataset.py:93`): cast int32, remap
`ignore_label_id (0) → IGNORE_LABEL_ID (-100)` in labels, pad batch to `local_batch_size`,
`torch.from_numpy`. Finally `evaluate()` moves the batch to device.

Phase 2 must reuse `np_grid_to_seq_translational_augment` directly (do NOT reimplement the encoding).

## 4. What actually performs inference

- `models/losses.py:ACTLossHead.forward(return_keys, carry=..., batch=...)` (line 50) — outer wrapper;
  returns `(new_carry, loss, metrics, detached_outputs, all_halted)`.
- `models/hrm/hrm_act_v1.py:HierarchicalReasoningModel_ACTV1.forward` (line 242) — ACT wrapper,
  one halting step per call.
- `models/hrm/hrm_act_v1.py:HierarchicalReasoningModel_ACTV1_Inner.forward` (line 181) — the
  H/L recurrent reasoning (`H_cycles=2`, `L_cycles=2`, `H_layers=4`, `L_layers=4`).

Driving loop (from `evaluate.py:227` / `pretrain.py:303`):
```python
carry = model.initial_carry(batch)
while True:
    carry, _, metrics, preds, all_finish = model(carry=carry, batch=batch, return_keys=["logits"])
    if all_finish:
        break
```
In `eval()` mode `halted = new_steps >= halt_max_steps`, so this loop always runs exactly
`halt_max_steps = 16` iterations (Q-halting is training-only). That is a fixed, known step count.

## 5. Model / checkpoint loading

- Config: `checkpoints/all_config.yaml` → `PretrainConfig`. Arch: `hrm.hrm_act_v1@HierarchicalReasoningModel_ACTV1`
  + `losses@ACTLossHead`, `hidden_size=512`, `puzzle_emb_ndim=512`, `halt_max_steps=16`,
  `global_batch_size=768`, `data_path=data/arc-small`.
- Model construction: `pretrain.py:create_model` / `init_train_state` — requires a
  `PuzzleDatasetMetadata` (from `data/arc-small/train/dataset.json`) supplying
  `vocab_size=12`, `seq_len=900`, `num_puzzle_identifiers=22104`. These must match the
  checkpoint or the puzzle-embedding table shape mismatches.
- Weights: `evaluate.py:load_checkpoint` (line 25) handles both file and directory-format
  checkpoints; `evaluate.py:load_compatible_state_dict` (line 174) normalizes keys
  (`utils/functions.normalize_state_dict_keys`), drops shape-mismatched tensors
  (`filter_state_dict_by_shape`), and calls `load_state_dict(strict=False, assign=True)`.
- Available checkpoint: `checkpoints/step_181776` (directory format) + `checkpoints/all_config.yaml`.
- Device: `utils/functions.get_compute_device()` → **`mps` if available, else `cpu`** (no CUDA path).
- `torch.compile` is skipped on MPS and when `DISABLE_COMPILE` is set (`pretrain.py:135`).

## 6. Output format

`preds["logits"]`: float `(B, 900, 12)`.

Decoded as `torch.argmax(preds["logits"][i], dim=-1)` → `(900,)` int tokens
(`evaluate.py:236`). To get an ARC grid back you must invert the encoding:
subtract 2 from color tokens, and crop using the `<eos>=1` markers / `PAD=0` region
(reshape 30×30, find first eos row/col). **No inverse decoder exists in the repo today** —
`_print_prediction_sample` only reshapes to a square and prints raw tokens. Phase 2 must add
a small `tokens -> grid` decoder in the adapter.

Also available per step: `q_halt_logits`, `q_continue_logits` `(B,)`, and `metrics`
(`count`, `accuracy`, `exact_accuracy`, `q_halt_accuracy`, `steps`, `lm_loss`, `q_halt_loss`).

## 7. Simplest way for another process to run one inference

In-process (no subprocess, no dataset build), reusing existing functions:

1. `PretrainConfig(**yaml.safe_load(open("checkpoints/all_config.yaml")))`; set
   `config.global_batch_size = 1` (only affects the training-only `local_weights` buffer).
2. `metadata = PuzzleDatasetMetadata(**json.load(open(f"{config.data_path}/train/dataset.json")))`.
3. `state = init_train_state(config, metadata, world_size=1)`; `state.model.to(get_compute_device())`.
4. `load_compatible_state_dict(state.model, "checkpoints/step_181776", device)`; `state.model.eval()`.
5. Encode the uploaded task's test input with
   `np_grid_to_seq_translational_augment(inp, dummy_out, do_translation=False)`.
6. Build `batch = {"inputs": (1,900) int32, "labels": full(-100), "puzzle_identifiers": tensor([0])}`
   on device — `0` is `blank_identifier_id`; an uploaded task has no trained puzzle embedding.
7. Run the `initial_carry` + `while not all_finish` loop under `torch.inference_mode()`.
8. `argmax(logits[0], -1)` → decode tokens back to a grid.

Do it in-process, not by shelling out to `evaluate.py` — `launch()` is hard-wired to a dataset
directory, prints debug samples, and writes `step_*_all_preds.0` to disk.

## 8. GPU / model-state / concurrency constraints

- **Device**: `get_compute_device()` returns `mps` on this Mac (Apple Silicon) else `cpu`. No CUDA.
  MPS + `bfloat16` (`forward_dtype`) — verify a smoke run before trusting Phase 2 timings.
- **Load cost**: model construction + checkpoint load is slow (~GB-scale directory checkpoint).
  Load **once at backend startup**, hold a module-level singleton. Never per request.
- **Not thread-safe**: the model carries mutable ACT carry state and MPS has a single command
  queue. Serialize inference with a lock or a single worker; one job at a time.
- **`model.eval()` is mandatory**: `CastedSparseEmbedding.forward` (`sparse_embedding.py:29`)
  branches on `self.training` — in train mode it writes into a `batch_size`-sized buffer, and
  `HierarchicalReasoningModel_ACTV1.forward` enables Q-halting + an extra forward pass.
  Eval mode also guarantees exactly `halt_max_steps` iterations.
- **`labels` is required** even with no ground truth — `ACTLossHead.forward` reads
  `new_carry.current_data["labels"]` and computes a loss unconditionally. Pass `-100`
  (`IGNORE_LABEL_ID`) so masks/metrics degrade gracefully.
- **Puzzle embedding**: uploaded tasks map to `puzzle_identifiers=0` (blank / zero-init embedding).
  This is a real accuracy limitation — the trained model relies on per-puzzle embeddings — and
  should be stated in the UI, not hidden.
- `torch.inference_mode()` around the loop; keep `DISABLE_COMPILE` set to avoid compile stalls.
- Distributed (`dist`) paths are inert at `world_size=1`; do not initialize a process group.

## 9. Real pipeline stages exposable as status events

All of these correspond to actual work, no fake timers:

| Event | Real source |
|---|---|
| `model_ready` / `model_loading` | one-time `init_train_state` + `load_compatible_state_dict` at startup |
| `validating` | `arc_grid_to_np` assertions (2-D, 0–9, ≤30×30) |
| `preprocessing` | `np_grid_to_seq_translational_augment` |
| `encoding` | batch tensor build + `.to(device)` |
| `inference_started` | `model.initial_carry(batch)` |
| `act_step {step, max_steps: 16, q_halt_logit, q_continue_logit, halted}` | **each iteration** of the `while` loop — the highest-value real progress signal |
| `postprocessing` | argmax + token→grid decode |
| `complete {prediction, steps, elapsed_ms}` | after `all_finish` |
| `error` | any exception |

Progress is genuinely determinate: `step / halt_max_steps` (16) in eval mode.

---

## Recommended Phase 2 minimum integration interface

A single module, e.g. `backend/hrm_adapter.py`, wrapping (never modifying) the existing code:

```python
# module-level singleton, loaded once
class HRMAdapter:
    def __init__(self,
                 checkpoint: str = "checkpoints/step_181776",
                 config_path: str = "checkpoints/all_config.yaml") -> None: ...
        # PretrainConfig + PuzzleDatasetMetadata + init_train_state
        # + load_compatible_state_dict + model.eval()

    def run_inference(
        self,
        task: dict,                       # raw ARC JSON: {"train": [...], "test": [...]}
        test_index: int = 0,
        on_event: Callable[[dict], None] | None = None,   # real stage/ACT-step events
    ) -> "InferenceResult": ...

@dataclass
class InferenceResult:
    prediction: list[list[int]]     # decoded ARC grid
    input_grid: list[list[int]]
    steps: int                      # == halt_max_steps (16) in eval mode
    max_steps: int
    elapsed_ms: float
    q_halt_logits: list[float]      # per ACT step
    raw_tokens: list[int]           # 900 tokens, for debugging/visualisation
```

Plus two small private helpers in the same module:
- `_encode_task(task, test_index) -> dict[str, torch.Tensor]` — wraps
  `arc_grid_to_np` + `np_grid_to_seq_translational_augment`
- `_decode_tokens(tokens: np.ndarray) -> list[list[int]]` — the missing inverse
  (reshape 30×30, crop at `<eos>`/PAD, subtract 2)

FastAPI then holds one `HRMAdapter` instance, guards `run_inference` with an
`asyncio.Lock` + `run_in_executor`, and forwards `on_event` callbacks to the WebSocket.
