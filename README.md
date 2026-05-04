# HRM Research Engineering (Apple Silicon)

Independent research and engineering repository based on the open-source HRM (Hierarchical Reasoning Model) project.

## Attribution

This project is a derivative work of:

- Original project: Sapient HRM
- Original repository: https://github.com/sapientinc/HRM
- Original paper: https://arxiv.org/abs/2506.21734

The original authors and publication are fully credited. This repository focuses on engineering adaptations, debugging, and experiment workflows.

## What HRM Is

HRM (Hierarchical Reasoning Model) is a recurrent reasoning architecture with interacting high-level and low-level modules designed for structured reasoning tasks (for example ARC, Sudoku, and Maze). The model emphasizes computational depth with relatively compact parameter count.

## My Contributions in This Repo

- Apple Silicon support path (MPS/CPU first, no CUDA requirement for core evaluation flow)
- FlashAttention compatibility troubleshooting and fallbacks
- ARC dataset pipeline debugging (split metadata and `dataset.json` issues)
- Checkpoint loading robustness fixes for PyTorch directory/storage formats
- Evaluation experiments and small-sample benchmarking (`max_samples` based runs)
- Utility scripts for reproducible debugging workflows

## License

This repository keeps the original Apache-2.0 license terms in `LICENSE`.

## Setup (macOS Apple Silicon, MPS)

### 1) Create environment

```bash
python3 -m venv hrm_env
source hrm_env/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 2) Verify PyTorch device support

```bash
python - <<'PY'
import torch
print('mps_available=', torch.backends.mps.is_available())
print('device=', 'mps' if torch.backends.mps.is_available() else 'cpu')
PY
```

## Dataset Build (ARC-AGI-2)

Use the official repository pipeline (no manual metadata editing):

```bash
python dataset/build_arc_dataset.py \
      --dataset-dir dataset/raw-data/ARC-AGI-2/data \
      --output-dir data/arc-2-aug-1000 \
      --num-aug 50
```

Expected outputs include:

- `data/arc-2-aug-1000/train/dataset.json`
- `data/arc-2-aug-1000/test/dataset.json`

## Evaluation

Run checkpoint evaluation on a bounded sample count:

```bash
python evaluate.py checkpoint=checkpoints/step_181776 max_samples=30
```

Typical logs include:

- train/eval example counts
- any skipped checkpoint parameters due to shape mismatch
- final metrics lines:

```text
Accuracy: X / 30
Success rate: XX.XX%
```

## Notes for Portfolio Use

- This is an independent repo history (not a fork), but it is explicitly attributed to the original project.
- Claims in this repo are limited to engineering modifications and experiment work done here.
