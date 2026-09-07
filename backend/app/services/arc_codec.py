"""ARC <-> 900-token conversion.

The ENCODER is not reimplemented here: it is imported from the existing
repository (`dataset/build_arc_dataset.py`). Only the DECODER lives here,
because the repository has no token->grid inverse. This decoder is the one
validated in `phase1-smoke-test.md` (800/800 exact round-trips against the
real encoder, plus all 30-edge cases).
"""
from typing import Any, Dict, List, Tuple

import numpy as np

from .hrm_runtime import ARCMaxGridSize, arc_grid_to_np, np_grid_to_seq_translational_augment

__all__ = [
    "ARCMaxGridSize",
    "arc_grid_to_np",
    "np_grid_to_seq_translational_augment",
    "encode_grid_pair",
    "decode_tokens",
]


def encode_grid_pair(inp: np.ndarray, out: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """Encode via the repository's own encoder. `do_translation=False` matches
    the test-split convention (grid anchored at 0,0)."""
    enc_inp, enc_out = np_grid_to_seq_translational_augment(inp, out, do_translation=False)
    return np.asarray(enc_inp, dtype=np.int32), np.asarray(enc_out, dtype=np.int32)


def decode_tokens(tokens: np.ndarray) -> Tuple[np.ndarray, Dict[str, Any]]:
    """Inverse of np_grid_to_seq_translational_augment.

    Encoding convention (dataset/build_arc_dataset.py:54) for a grid (nrow, ncol)
    at top-left offset (pad_r, pad_c) in a 30x30 canvas:

      * colors    : value + 2  -> tokens 2..11 (ARC color 0 == token 2)
      * PAD       : 0
      * <eos> row : row pad_r+nrow, cols pad_c .. pad_c+ncol-1
      * <eos> col : col pad_c+ncol, rows pad_r .. pad_r+nrow-1
      * the corner (pad_r+nrow, pad_c+ncol) is never marked
      * a marker is omitted when it would fall outside the canvas

    The two markers are NOT symmetric look-ups: the horizontal <eos> run itself
    puts a 1 in column pad_c, so "first column containing a 1" is not ncol.
    Each extent must be read along the content-origin line.

    Returns (grid, info). Dimensions are derived only from `tokens`.
    """
    canvas = np.asarray(tokens).reshape(ARCMaxGridSize, ARCMaxGridSize)
    color_mask = canvas >= 2

    if not color_mask.any():
        return np.zeros((0, 0), dtype=np.int32), {"method": "empty", "origin": None}

    rows = np.where(color_mask.any(axis=1))[0]
    cols = np.where(color_mask.any(axis=0))[0]
    pad_r, pad_c = int(rows[0]), int(cols[0])

    col_run = canvas[pad_r:, pad_c]            # down the first content column
    hits = np.where(col_run == 1)[0]
    nrow_eos = int(hits[0]) if len(hits) else None

    row_run = canvas[pad_r, pad_c:]            # right along the first content row
    hits = np.where(row_run == 1)[0]
    ncol_eos = int(hits[0]) if len(hits) else None

    # Grids touching the canvas edge carry no <eos> on that axis.
    nrow_bbox = int(rows[-1]) - pad_r + 1
    ncol_bbox = int(cols[-1]) - pad_c + 1

    nrow = nrow_eos if nrow_eos else nrow_bbox
    ncol = ncol_eos if ncol_eos else ncol_bbox
    nrow = max(1, min(nrow, ARCMaxGridSize - pad_r))
    ncol = max(1, min(ncol, ARCMaxGridSize - pad_c))

    block = canvas[pad_r:pad_r + nrow, pad_c:pad_c + ncol]
    grid = (block.astype(np.int32) - 2).clip(0, 9)

    info = {
        "method": f"eos(rows={'yes' if nrow_eos else 'edge-fallback'}, "
                  f"cols={'yes' if ncol_eos else 'edge-fallback'})",
        "origin": [pad_r, pad_c],
        "nrow_eos": nrow_eos,
        "ncol_eos": ncol_eos,
        "nrow_bbox": nrow_bbox,
        "ncol_bbox": ncol_bbox,
        "stray_tokens_in_block": int((block < 2).sum()),
    }
    return grid, info


def grid_to_lists(grid: np.ndarray) -> List[List[int]]:
    return [[int(v) for v in row] for row in grid]
