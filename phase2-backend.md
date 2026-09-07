# Phase 2 — Minimal Local Backend

A FastAPI orchestration layer around the existing HRM. The HRM is treated as a
black box: no model, architecture, preprocessing, inference or checkpoint code
was changed in this phase.

## Files created

```
backend/
├── app/
│   ├── main.py                  FastAPI app, CORS, startup model load
│   ├── api/
│   │   ├── health.py            GET  /api/health
│   │   └── puzzles.py           POST /api/puzzles, /api/puzzles/upload, GET /api/jobs/{id}[/result]
│   ├── services/
│   │   ├── hrm_runtime.py       sys.path shim + re-export of the existing repo APIs
│   │   ├── hrm_adapter.py       HRMAdapter, InferenceResult, get_adapter() singleton
│   │   ├── arc_codec.py         imports the existing encoder; hosts the verified decode_tokens
│   │   ├── validation.py        ARC task/grid validation
│   │   └── job_store.py         in-memory dict of completed jobs
│   └── models/schemas.py        pydantic request/response models
└── tests/test_integration.py    real (unmocked) HRM integration test
```

**Files modified: none.** `evaluate.py` still carries the Phase 1 checkpoint-loader
fix; Phase 2 added nothing to it. `phase1_smoke_test.py` is left as-is — the
decoder was *extracted* into `backend/app/services/arc_codec.py` rather than
imported from the temporary script.

New runtime deps installed into `hrm_env`: `fastapi`, `uvicorn[standard]`,
`python-multipart`, `pytest`.

## Run

```bash
hrm_env/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
hrm_env/bin/python -m pytest backend/tests/test_integration.py -q
```

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | backend + real HRM load state |
| POST | `/api/puzzles` | submit ARC JSON body, returns the prediction (synchronous) |
| POST | `/api/puzzles/upload` | same via multipart `.json` file upload |
| POST | `/api/puzzles/stream` | same run, streaming the real pipeline events as SSE |
| GET | `/api/jobs/{job_id}` | retrieve a completed job |
| GET | `/api/jobs/{job_id}/result` | alias of the above |

### Request format

JSON body is the primary path (fastest for the frontend to call):

```json
{ "task": { "train": [{"input": [[...]], "output": [[...]]}],
            "test":  [{"input": [[...]]}] },
  "test_index": 0 }
```

`train` and `test` are required. `output` is optional on `test` examples (an
uploaded puzzle has no answer) and required on `train` examples. Multipart
upload takes the bare ARC task file — no `task` wrapper — with `test_index` as a
query parameter. No image/PNG handling.

Validation mirrors what the existing encoder already enforces
(`arc_grid_to_np`: 2-D, integers 0..9, ≤30×30) and adds a rectangularity check.
Failures return **422** with the offending location, e.g.
`task['test'][0]['input']: grid is not rectangular (row lengths [1, 2])`.

### Response format

```jsonc
{
  "job_id": "3d00914519be45c7...",
  "status": "complete",
  "input_grid": [[...]],
  "prediction_grid": [[...]],
  "prediction_dimensions": [19, 18],
  "metadata": {
    "steps": 16, "max_steps": 16, "elapsed_ms": 5882.25,
    "device": "mps", "dtype": "torch.bfloat16",
    "logits_shape": [1, 900, 12],
    "q_halt_logits": [...16 floats...],
    "q_continue_logits": [...16 floats...],
    "decode_info": { "method": "eos(rows=yes, cols=yes)", "origin": [0,0], ... },
    "puzzle_identifier": 0
  },
  "events": [ {"stage": "validating"}, {"stage": "preprocessing"},
              {"stage": "encoding", "seq_len": 900},
              {"stage": "act_step", "step": 1, "max_steps": 16,
               "q_halt_logit": -3.296875, "q_continue_logit": 3.71875},
              /* ...16 act_step events... */
              {"stage": "postprocessing"},
              {"stage": "complete", "elapsed_ms": 5882.25, "steps": 16, "dimensions": [19,18]} ],
  "raw_tokens": [ /* 900 ints */ ]
}
```

No confidence score is reported — the model does not produce one. `q_halt_logits`
are the real Q-head outputs, nothing derived.

### Streaming (added for the frontend)

`POST /api/puzzles/stream` runs the identical adapter call and emits Server-Sent
Events: `event: stage` per real `on_event` callback (including one `act_step` per
genuine ACT iteration with that step's Q-head logits), then `event: result` with
the same body as `POST /api/puzzles`, or `event: error`. The inference runs on a
worker thread feeding a queue, so it still passes through the same adapter lock.
No synthetic progress is generated.

## HRM integration point

`backend/app/services/hrm_adapter.py:HRMAdapter.run_inference(task, test_index, on_event)`
is the single point of contact. It calls the repository's own code:

* config/metadata: `PretrainConfig`, `PuzzleDatasetMetadata`
* model: `pretrain.init_train_state` → `evaluate.load_compatible_state_dict` → `model.eval()`
* device: `utils.functions.get_compute_device()`
* encoding: `dataset/build_arc_dataset.np_grid_to_seq_translational_augment(..., do_translation=False)` — **imported, not duplicated**
* inference: the repository's `initial_carry` + `while not all_finish` ACT loop
* decoding: `arc_codec.decode_tokens` (the Phase 1 verified decoder, extracted verbatim)

Batch built exactly as Phase 1 established: `inputs (1,900) int32`,
`labels (1,900) = -100`, `puzzle_identifiers (1,) = 0`.

`hrm_runtime.py` exists only because the HRM repo is a flat top-level package and
`dataset/build_arc_dataset.py` imports its sibling as bare `common`; the shim puts
the repo root and `dataset/` on `sys.path` once. It reimplements nothing.

## Pipeline events

`on_event` receives real stage transitions — `validating`, `preprocessing`,
`encoding`, `act_step` (once per genuine ACT iteration, carrying the step number
and that step's `q_halt_logit`/`q_continue_logit`), `postprocessing`, `complete`.
No timers, no synthetic progress. Events are collected and returned with the
response; the same callback feeds a WebSocket in Phase 3 unchanged.

## Model loading behavior

Loaded **once** per process by the `get_adapter()` singleton, triggered at app
startup so the first request isn't slow. Measured cold load: **~2.0 s**. MPS +
bfloat16 and `model.eval()` are preserved. A load failure is captured rather than
raised, so `/api/health` stays reachable and honestly reports `hrm: "offline"`
with the error; `POST /api/puzzles` then returns **503**.

## Concurrency behavior

A single `threading.Lock` inside the adapter serializes the forward pass, because
the HRM carries mutable ACT state and MPS has one command queue. FastAPI runs the
blocking call via `run_in_threadpool`, so the event loop stays responsive and
concurrent requests queue on the lock instead of corrupting model state. No Redis,
Celery, or external queue.

Execution is **synchronous** — one inference is ~6 s and this is a short demo
window. The response is already job-shaped (`job_id`, `status`) and results land
in an in-memory store, so a background/async variant can be added later without
changing the client contract.

## Verification

`backend/tests/test_integration.py` — 10 tests, **HRM not mocked**, ~26 s:
health reports a genuinely loaded model; a real ARC task goes JSON → API →
adapter → real HRM → `decode_tokens` → JSON with the right 19×18 dimensions,
`logits_shape [1,900,12]`, 16 ACT steps and 16 `act_step` events; job retrieval;
multipart upload; five validation cases; 404 on unknown job.

Also exercised against a live `uvicorn` server over HTTP: health `hrm: online`
on `mps`, `POST /api/puzzles` in **5.96 s wall / 5882 ms inference**, exact match
against the known ground truth, job endpoints 200/200/404, upload 19×18.

## Known limitations

* **Zero puzzle embeddings.** `puzzle_emb.weights` is never loaded — its storage
  file is missing from `checkpoints/step_181776/data/` *and* the checkpoint's
  `(1045829, 512)` shape does not match this config's `(22104, 512)`, so
  `filter_state_dict_by_shape` drops it. Every request therefore runs with a
  zero puzzle embedding and `puzzle_identifiers=0`. The known-good sample still
  decodes to an exact match, but that is **n=1 and not an accuracy claim** — the
  frontend should state this caveat rather than imply general ARC performance.
* Jobs are per-process and in-memory; they vanish on restart.
* One inference at a time by design; a second request waits ~6 s.
* `test_index` selects a single test example; multi-output tasks need one request each.
* Grids that fill the 30×30 canvas carry no `<eos>` on that axis; the decoder
  falls back to the color bounding box, which is inherently ambiguous there.
