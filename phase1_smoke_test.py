"""TEMPORARY Phase 1 smoke test: one real HRM inference on one ARC sample.

Read-only w.r.t. the repository: no model, training, dataset or checkpoint files
are modified. Delete this file once Phase 2 has a real adapter.
"""
import json, os, sys, time
import numpy as np
import torch
import yaml

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "dataset"))

from pretrain import PretrainConfig, init_train_state
from evaluate import load_compatible_state_dict
from utils.functions import get_compute_device
from dataset.common import PuzzleDatasetMetadata
from build_arc_dataset import np_grid_to_seq_translational_augment, ARCMaxGridSize

CONFIG_PATH = "checkpoints/all_config.yaml"
CHECKPOINT = "checkpoints/step_181776"
METADATA_PATH = "data/arc-small/train/dataset.json"
IGNORE_LABEL_ID = -100


def decode_tokens(tokens: np.ndarray):
    """Minimum temporary decoder: inverse of np_grid_to_seq_translational_augment.

    Encoding convention (dataset/build_arc_dataset.py:54), for a grid of shape
    (nrow, ncol) placed at top-left offset (pad_r, pad_c) inside a 30x30 canvas:

      * colors      : cell value + 2  -> tokens 2..11 (ARC color 0 == token 2)
      * PAD         : 0 everywhere outside the content block and the eos markers
      * <eos> row   : row  pad_r+nrow, columns pad_c .. pad_c+ncol-1   (all 1)
      * <eos> col   : col  pad_c+ncol, rows    pad_r .. pad_r+nrow-1   (all 1)
      * the corner (pad_r+nrow, pad_c+ncol) is NOT marked; it stays 0
      * an eos marker is omitted entirely when it would fall outside the canvas
        (i.e. when the grid touches the 30-row or 30-column edge)
      * test-split examples use pad_r = pad_c = 0 (do_translation=False)

    Therefore the first row containing a 1 gives nrow, but the first *column*
    containing a 1 does NOT give ncol - the horizontal eos run itself puts a 1
    in column pad_c. Dimensions must be read off the eos markers relative to the
    content origin: scan the first content row for the vertical eos, and the
    first content column for the horizontal eos.

    Returns (grid, info) where info records how the extent was derived.
    """
    canvas = tokens.reshape(ARCMaxGridSize, ARCMaxGridSize)
    color_mask = canvas >= 2

    if not color_mask.any():
        return np.zeros((0, 0), dtype=np.int32), {"method": "empty", "origin": None}

    # Content origin: top-left of the predicted color block.
    rows = np.where(color_mask.any(axis=1))[0]
    cols = np.where(color_mask.any(axis=0))[0]
    pad_r, pad_c = int(rows[0]), int(cols[0])

    # Extent from the eos markers (the encoding's explicit dimension signal).
    col_run = canvas[pad_r:, pad_c]          # walk down the first content column
    hits = np.where(col_run == 1)[0]
    nrow_eos = int(hits[0]) if len(hits) else None

    row_run = canvas[pad_r, pad_c:]          # walk right along the first content row
    hits = np.where(row_run == 1)[0]
    ncol_eos = int(hits[0]) if len(hits) else None

    # Fallback: grids touching the canvas edge have no eos marker on that axis,
    # so fall back to the extent of the color block itself.
    nrow_bbox = int(rows[-1]) - pad_r + 1
    ncol_bbox = int(cols[-1]) - pad_c + 1

    nrow = nrow_eos if nrow_eos else nrow_bbox
    ncol = ncol_eos if ncol_eos else ncol_bbox
    nrow = max(1, min(nrow, ARCMaxGridSize - pad_r))
    ncol = max(1, min(ncol, ARCMaxGridSize - pad_c))

    block = canvas[pad_r:pad_r + nrow, pad_c:pad_c + ncol]
    # colors are token-2; any stray PAD/<eos> token inside the block is clipped to 0
    grid = (block.astype(np.int32) - 2).clip(0, 9)

    info = {
        "method": f"eos(rows={'yes' if nrow_eos else 'edge-fallback'}, "
                  f"cols={'yes' if ncol_eos else 'edge-fallback'})",
        "origin": (pad_r, pad_c),
        "nrow_eos": nrow_eos, "ncol_eos": ncol_eos,
        "nrow_bbox": nrow_bbox, "ncol_bbox": ncol_bbox,
        "stray_tokens_in_block": int((block < 2).sum()),
    }
    return grid, info


def show(name, grid):
    print(f"\n{name}  ({grid.shape[0]}x{grid.shape[1]})")
    for row in grid:
        print("  " + "".join(str(int(v)) for v in row))


def main():
    report = {}

    # --- pick one real ARC sample referenced by data/arc-small ---------------
    identifiers = json.load(open("data/arc-small/identifiers.json"))
    pid = int(np.load("data/arc-small/test/all__puzzle_identifiers.npy")[0])
    puzzle_name = identifiers[pid]
    base_id = puzzle_name.split("_")[0]

    raw_path = None
    for root in ("dataset/raw-data/ARC-AGI/data", "dataset/raw-data/ARC-AGI-2/data"):
        for split in ("training", "evaluation"):
            cand = os.path.join(root, split, f"{base_id}.json")
            if os.path.exists(cand):
                raw_path = cand
                break
        if raw_path:
            break
    if raw_path is None:
        raise SystemExit(f"raw ARC json for {base_id} not found")

    task = json.load(open(raw_path))
    input_grid = np.array(task["test"][0]["input"], dtype=np.uint8)
    output_grid = np.array(task["test"][0]["output"], dtype=np.uint8)
    report["sample"] = f"{base_id} (test[0]) from {raw_path}"
    report["input_dims"] = f"{input_grid.shape[0]}x{input_grid.shape[1]}"
    print(f"[Sample] {report['sample']}  input {input_grid.shape}  gt output {output_grid.shape}")

    # --- 5. existing encoding path ------------------------------------------
    enc_inp, _enc_out = np_grid_to_seq_translational_augment(
        input_grid, output_grid, do_translation=False)
    report["encoded_shape"] = str(np.asarray(enc_inp).shape)
    print(f"[Encode] inputs sequence shape {np.asarray(enc_inp).shape}")

    # --- 1/2/3/4. config, metadata, model, checkpoint ------------------------
    config = PretrainConfig(**yaml.safe_load(open(CONFIG_PATH)))
    config.global_batch_size = 1
    metadata = PuzzleDatasetMetadata(**json.load(open(METADATA_PATH)))
    device = get_compute_device()
    report["device"] = str(device)
    print(f"[Device] {device}")

    t0 = time.time()
    model_ok = False
    try:
        state = init_train_state(config, metadata, world_size=1)
        state.model = state.model.to(device)
        load_compatible_state_dict(state.model, CHECKPOINT, device)
        model_ok = True
    except Exception as e:
        report["load_error"] = f"{type(e).__name__}: {e}"
        print(f"[Load] FAILED: {e}")
        raise
    finally:
        report["load_time_s"] = round(time.time() - t0, 2)
    report["model_load"] = "success" if model_ok else "failure"
    print(f"[Load] success in {report['load_time_s']}s")

    # --- 7. eval mode --------------------------------------------------------
    state.model.eval()

    fwd_dtype = getattr(state.model.model.inner, "forward_dtype", None)
    report["dtype"] = str(fwd_dtype)
    print(f"[Dtype] forward_dtype={fwd_dtype}")

    # --- 6. build the model input -------------------------------------------
    batch = {
        "inputs": torch.from_numpy(np.asarray(enc_inp, dtype=np.int32)).reshape(1, -1).to(device),
        "labels": torch.full((1, metadata.seq_len), IGNORE_LABEL_ID, dtype=torch.int32).to(device),
        "puzzle_identifiers": torch.zeros((1,), dtype=torch.int32).to(device),
    }
    print(f"[Batch] inputs={tuple(batch['inputs'].shape)} labels={tuple(batch['labels'].shape)} "
          f"puzzle_identifiers={tuple(batch['puzzle_identifiers'].shape)} (id=0 / blank)")

    # --- 8. one real inference ----------------------------------------------
    t0 = time.time()
    steps = 0
    q_halt = q_cont = None
    with torch.inference_mode():
        carry = state.model.initial_carry(batch)
        while True:
            carry, _loss, metrics, preds, all_finish = state.model(
                carry=carry, batch=batch,
                return_keys=["logits", "q_halt_logits", "q_continue_logits"])
            steps += 1
            if "q_halt_logits" in preds:
                q_halt = float(preds["q_halt_logits"][0])
                q_cont = float(preds["q_continue_logits"][0])
            if all_finish:
                break
    infer_s = time.time() - t0

    logits = preds["logits"]
    pred_tokens = torch.argmax(logits[0], dim=-1).to(torch.int32).cpu().numpy()

    report.update(
        inference="success",
        inference_time_s=round(infer_s, 2),
        logits_shape=str(tuple(logits.shape)),
        pred_token_shape=str(tuple(pred_tokens.shape)),
        act_steps=steps,
        carry_steps=int(carry.steps[0]) if hasattr(carry, "steps") else None,
        q_halt_logit=q_halt,
        q_continue_logit=q_cont,
        halt_max_steps=config.arch.__pydantic_extra__.get("halt_max_steps"),
    )

    print(f"\n[Infer] success in {infer_s:.2f}s over {steps} ACT steps "
          f"(carry.steps={report['carry_steps']}, halt_max_steps={report['halt_max_steps']})")
    print(f"[Infer] logits {tuple(logits.shape)} dtype={logits.dtype}")
    print(f"[Infer] predicted tokens {pred_tokens.shape} "
          f"(min={pred_tokens.min()}, max={pred_tokens.max()})")
    print(f"[Infer] q_halt_logits={q_halt}  q_continue_logits={q_cont}")

    # --- 10/11. decode + display --------------------------------------------
    # decoder self-check: the encoded INPUT must round-trip to its true dimensions
    rt_grid, rt_info = decode_tokens(np.asarray(enc_inp, dtype=np.int32))
    roundtrip_ok = rt_grid.shape == input_grid.shape and bool((rt_grid == input_grid).all())
    report["decoder_roundtrip_input"] = (
        f"{rt_grid.shape[0]}x{rt_grid.shape[1]} exact={roundtrip_ok} [{rt_info['method']}]")
    print(f"\n[Decoder self-check] re-decoded encoded input -> {rt_grid.shape}, "
          f"identical to original: {roundtrip_ok}")

    decoded, dec_info = decode_tokens(pred_tokens)
    report["decoded_dims"] = f"{decoded.shape[0]}x{decoded.shape[1]}"
    report["decode_info"] = dec_info
    print(f"[Decode] origin={dec_info['origin']} method={dec_info['method']} "
          f"eos_dims=({dec_info['nrow_eos']}, {dec_info['ncol_eos']}) "
          f"colorbbox_dims=({dec_info['nrow_bbox']}, {dec_info['ncol_bbox']}) "
          f"stray_tokens_in_block={dec_info['stray_tokens_in_block']}")
    show("INPUT GRID (original ARC)", input_grid)
    show("DECODED PREDICTION", decoded)
    show("GROUND TRUTH OUTPUT", output_grid)
    exact = decoded.shape == output_grid.shape and bool((decoded == output_grid).all())
    report["exact_match"] = exact
    print(f"\n[Compare] decoded == ground truth: {exact}")

    print("\n===== REPORT =====")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
