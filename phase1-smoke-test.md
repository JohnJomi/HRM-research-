# HRM Smoke Test

One real end-to-end HRM inference on one ARC sample. No model, architecture,
training, preprocessing, dataset or checkpoint file was modified.

## Result

**PASS**

## Environment

* **device**: `mps` (Apple Silicon), via `utils/functions.get_compute_device()`
* **dtype**: `torch.bfloat16` (`HierarchicalReasoningModel_ACTV1Config.forward_dtype`); logits come back `bfloat16`. MPS + bfloat16 worked — **no dtype or device fallback was needed**.
* **checkpoint**: `checkpoints/step_181776` (directory format)
* **config**: `checkpoints/all_config.yaml`, metadata `data/arc-small/train/dataset.json` (`vocab_size=12`, `seq_len=900`, `num_puzzle_identifiers=22104`)
* **script**: `phase1_smoke_test.py` (temporary; delete once the Phase 2 adapter exists)
* Model built by `pretrain.init_train_state`, weights via `evaluate.load_compatible_state_dict`, `model.eval()` set explicitly before inference.

## Input

* **source sample**: puzzle `13713586`, `test[0]`, from `dataset/raw-data/ARC-AGI/data/evaluation/13713586.json` — the first puzzle referenced by `data/arc-small/test/all__puzzle_identifiers.npy`
* **original grid dimensions**: 19x18
* **encoded shape**: `(900,)` via `dataset/build_arc_dataset.np_grid_to_seq_translational_augment(..., do_translation=False)`
* **model input**: `inputs (1,900) int32`, `labels (1,900) int32` filled `-100`, `puzzle_identifiers (1,) int32 = 0` (blank)

## Model Output

* **logits shape**: `(1, 900, 12)`
* **predicted token shape**: `(900,)` (observed token range 1..10)
* **decoded grid dimensions**: **19x18** (was incorrectly 1x1 before the decoder fix)
* **ACT steps**: 16 (`carry.steps = 16 = halt_max_steps`; fixed in eval mode)
* `q_halt_logits = 6.84375`, `q_continue_logits = 6.625`

## Timing

* **model load time**: ~1.5–1.9 s (weights already in page cache)
* **inference time**: ~5.2 s for 16 ACT steps on MPS (~325 ms/step)

## Encoding / decoding convention (discovered)

Source of truth: `dataset/build_arc_dataset.py:np_grid_to_seq_translational_augment` (line 54).
For a grid `(nrow, ncol)` at top-left offset `(pad_r, pad_c)` in a 30x30 canvas, flattened row-major to 900:

* **colors**: cell value `+ 2` → tokens `2..11`. ARC color `0` (black) is token `2`, **not** 0.
* **PAD**: `0`, everywhere outside the content block and the eos markers.
* **`<eos>` row**: row `pad_r+nrow`, columns `pad_c .. pad_c+ncol-1` set to `1` (a horizontal run of length `ncol`).
* **`<eos>` col**: column `pad_c+ncol`, rows `pad_r .. pad_r+nrow-1` set to `1` (a vertical run of length `nrow`).
* The corner cell `(pad_r+nrow, pad_c+ncol)` is **never** marked; it stays `0`.
* An eos marker is **omitted entirely** when it would fall outside the canvas — i.e. a grid touching the 30-row or 30-column edge has no eos on that axis.
* **Translation**: `pad_r`/`pad_c` are random only when `do_translation=True`, which the builder enables **for the train split only** (`enable_translational_augment = split_name == "train"`). Test-split examples are anchored at `(0,0)`.

### Why the first decoder returned 1x1

It took "first row containing a `1`" and "first column containing a `1`" as `nrow`/`ncol`.
The row test is accidentally right at `pad_c=0`, but the column test is wrong: the **horizontal**
eos run itself places a `1` in column `pad_c`, so the first `1`-containing column is `0` → `ncol=0`,
clamped to 1. The two eos markers are not symmetric look-ups; each must be read along the
*content origin* line.

### Corrected decoder (in `phase1_smoke_test.py:decode_tokens`, the only thing changed)

1. `canvas = tokens.reshape(30, 30)`; content origin `(pad_r, pad_c)` = top-left of the `>= 2` (color) mask.
2. `nrow` = index of the first `1` scanning **down column `pad_c`** from `pad_r`.
3. `ncol` = index of the first `1` scanning **right along row `pad_r`** from `pad_c`.
4. If an axis has no eos (grid touches the canvas edge), fall back to the extent of the color block on that axis.
5. Crop `canvas[pad_r:pad_r+nrow, pad_c:pad_c+ncol]`, subtract 2, clip to `0..9`.

Dimensions are derived **only** from the predicted sequence — never from the ground truth.

**Decoder validation** (independent of the model): 800/800 exact round-trips of
`np_grid_to_seq_translational_augment` → `decode_tokens` over random grids with and without
translational augmentation, plus every edge case (`30x30`, `30x5`, `5x30`, `1x1`, `1x30`, `30x1`, `19x18`).
The smoke test also re-decodes its own encoded input in-run: 19x18, identical to the original.

That edge-fallback matters here: on this sample the model emitted color tokens across the full
canvas (`colorbbox_dims = (30, 30)`), so a bounding-box-only decoder would have returned 30x30.
The eos markers gave the correct `(19, 18)`, with `stray_tokens_in_block = 0`.

## Prediction

```
INPUT GRID (19x18)              DECODED PREDICTION (19x18)      GROUND TRUTH (19x18)
555555555555555555              555555555555555555              555555555555555555
000000000000000000              444433332222208880              444433332222208880
000000000000000000              444433332222208880              444433332222208880
000000000000000000              444433332222208880              444433332222208880
000000000000000000              444433332222208880              444433332222208880
000000000000008880              444433332222208880              444433332222208880
000000000000000000              444433332222200000              444433332222200000
444400000000000000              444433332222200000              444433332222200000
000000000000000000              003333332222200000              003333332222200000
000000000000000000              003333332222200000              003333332222200000
000000000000000000              003333332222200000              003333332222200000
000000000000000000              003333332222200000              003333332222200000
000000002222200000              003333333330000000              003333333330000000
000000000000000000              003333333330000000              003333333330000000
000000000000000000              003333333330000000              003333333330000000
000000000000000000              003333333330000000              003333333330000000
003333333330000000              000000000000000000              000000000000000000
000000000000000000              000000000000000000              000000000000000000
000000000000000000              000000000000000000              000000000000000000
```

**Exact match against ground truth: `True`** (all 342 cells).

## Errors

Two blockers were hit and fixed before the run; neither touched the model.

**1. Broken PyTorch install (environment, not repo).**
`hrm_env/lib/python3.11/site-packages/torch/lib/libtorch_cpu.dylib` was absent, so `import torch`
failed with `ImportError ... libtorch_cpu.dylib (no such file)`. Fixed by
`hrm_env/bin/pip install --force-reinstall --no-cache-dir torch==2.11.0`. No repo files involved.

**2. Incomplete checkpoint directory → `AttributeError: 'NoneType' object has no attribute 'dtype'`.**
Raised from `torch/_utils.py:_rebuild_tensor` via `evaluate.load_checkpoint`.
Root cause: `checkpoints/step_181776/data/` contains storage files `0..38` **except `6`**.
`data.pkl` references `6` as `FloatStorage, numel=535464448` — a ~2.0 GB tensor. That storage backs
exactly one parameter: `_orig_mod.model.inner.puzzle_emb.weights`, shape `(1045829, 512)`.
The repo's `persistent_load` returned `None` for the missing id, and the unpickler then
dereferenced it. (`checkpoints/` is gitignored, so the file was never version-controlled.)

*Minimum fix, confined to checkpoint loading in `evaluate.py:load_checkpoint`* (no model,
architecture, training, preprocessing or inference change):
* a missing external storage now yields a zero-size `device="meta"` placeholder (allocates no
  memory) plus a loud `[Checkpoint][WARNING]` naming the missing file, instead of `None`;
* `move_to_device` leaves `meta` tensors alone.

This is provably inconsequential for the loaded weights: the placeholder's declared shape
`(1045829, 512)` does not match this model's `(22104, 512)`, so the existing
`filter_state_dict_by_shape` discards it before `load_state_dict`, exactly as it would have with
the real file. Observed in the run:

```
[Checkpoint][WARNING] Missing external tensor file '6' (FloatStorage, numel=535464448). ...
[Checkpoint] Skipped 1 parameters due to shape mismatch:
  model.inner.puzzle_emb.weights: checkpoint torch.Size([1045829, 512]) vs model torch.Size([22104, 512])
[Checkpoint] Loaded successfully with 1 missing keys
```

All 38 transformer / embedding / head tensors loaded normally. No weights were fabricated for any
parameter the model actually uses.

## Remaining limitations

* **The puzzle embedding is untrained.** `puzzle_emb.weights` is not loaded (missing file *and*
  a shape mismatch — the checkpoint was trained with 1,045,829 identifiers, this config declares
  22,104), so it stays at its zero init. Combined with `puzzle_identifiers=0` for uploaded tasks,
  every inference runs with a zero puzzle embedding. **The exact match above was obtained under
  that condition**, but it is one ARC-AGI-1 evaluation puzzle and is not evidence of general
  accuracy — do not extrapolate a hit rate from n=1.
* **Accuracy is out of scope here**; this test proves the *plumbing*, not model quality.
* `q_halt_logits (6.84) > q_continue_logits (6.63)` is informational only — in `eval()` mode the
  ACT loop always runs the full `halt_max_steps=16`, so halting is not data-dependent.
* Grids that fill the canvas to 30 rows/columns carry no eos on that axis; the decoder's colour-
  bbox fallback handles this, but such a prediction is inherently ambiguous.
* `labels` must be supplied even with no ground truth (`ACTLossHead` computes a loss
  unconditionally); `-100` is used.

## Backend Integration Readiness

**Yes — safe to proceed to Phase 2.** Every element the Phase 2 adapter needs is now proven on
real hardware with real weights: config + metadata load, checkpoint load, MPS + bfloat16 forward,
the 16-step ACT loop as a genuine progress signal, and a verified `900 tokens -> ARC grid` decoder
(the one piece Phase 1 flagged as missing from the repo). The recommended interface from
`phase1-integration-report.md` — `HRMAdapter.run_inference(task, test_index, on_event) -> InferenceResult`
— stands unchanged; `decode_tokens` here is the reference implementation for its `_decode_tokens`
helper.

Carry into Phase 2: load the model once at startup (~2 s), serialize inference with a lock
(~5 s per request, one at a time), and surface the untrained-puzzle-embedding caveat in the UI.
Separately, the missing 2 GB `puzzle_emb` storage should be re-obtained if real accuracy matters.
