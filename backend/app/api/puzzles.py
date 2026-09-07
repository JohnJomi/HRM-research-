"""Puzzle submission.

Two shapes over the same adapter call:
  * POST /api/puzzles          synchronous, returns the full result
  * POST /api/puzzles/stream   Server-Sent Events, emits the adapter's REAL
                               on_event stream as it happens, then the result

Both are job-shaped and share an in-memory store, so a background/async variant
can be added later without changing the client contract.
"""
import asyncio
import json
import queue
import threading
import uuid
from typing import Any, AsyncIterator, Dict, List, Tuple

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse

from ..models.schemas import PipelineEvent, PuzzleRequest, PuzzleResponse
from ..services.hrm_adapter import InferenceResult, get_adapter
from ..services.job_store import JOBS
from ..services.validation import ARCValidationError

router = APIRouter()


def _require_model():
    adapter = get_adapter()
    if not adapter.loaded:
        raise HTTPException(
            status_code=503,
            detail=f"HRM model is not loaded: {adapter.load_error}")
    return adapter


def _build_response(result: InferenceResult, events: List[Dict[str, Any]]) -> PuzzleResponse:
    job_id = uuid.uuid4().hex
    payload = result.to_dict()
    response = PuzzleResponse(
        job_id=job_id,
        status="complete",
        input_grid=payload["input_grid"],
        prediction_grid=payload["prediction_grid"],
        prediction_dimensions=[
            len(payload["prediction_grid"]),
            len(payload["prediction_grid"][0]) if payload["prediction_grid"] else 0,
        ],
        metadata={
            "steps": payload["steps"],
            "max_steps": payload["max_steps"],
            "elapsed_ms": payload["elapsed_ms"],
            "device": payload["device"],
            "dtype": payload["dtype"],
            "logits_shape": payload["logits_shape"],
            "q_halt_logits": payload["q_halt_logits"],
            "q_continue_logits": payload["q_continue_logits"],
            "decode_info": payload["decode_info"],
            "puzzle_identifier": payload["puzzle_identifier"],
        },
        events=[PipelineEvent(**e) for e in events],
        raw_tokens=payload["raw_tokens"],
    )
    JOBS[job_id] = response
    return response


async def _run(task: Dict[str, Any], test_index: int) -> PuzzleResponse:
    adapter = _require_model()
    events: List[Dict[str, Any]] = []
    try:
        # Inference is blocking and lock-guarded; keep the event loop free.
        result = await run_in_threadpool(
            adapter.run_inference, task, test_index, events.append)
    except ARCValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500,
            detail=f"HRM inference failed: {type(exc).__name__}: {exc}") from exc
    return _build_response(result, events)


@router.post("/puzzles", response_model=PuzzleResponse)
async def create_puzzle(request: PuzzleRequest) -> PuzzleResponse:
    """Submit a raw ARC task as JSON and get the HRM prediction back."""
    return await _run(request.task.model_dump(), request.test_index)


@router.post("/puzzles/upload", response_model=PuzzleResponse)
async def upload_puzzle(file: UploadFile = File(...), test_index: int = 0) -> PuzzleResponse:
    """Same thing via multipart upload of a .json ARC file."""
    raw = await file.read()
    try:
        task = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"invalid JSON: {exc}") from exc
    if not isinstance(task, dict):
        raise HTTPException(status_code=422, detail="ARC task file must contain a JSON object")
    return await _run(task, test_index)


@router.post("/puzzles/stream")
async def stream_puzzle(request: PuzzleRequest) -> StreamingResponse:
    """Run inference and stream the adapter's real pipeline events as SSE.

    Emits `event: stage` per real on_event callback (including one act_step per
    genuine ACT iteration), then `event: result` with the same payload as
    POST /api/puzzles, or `event: error`. No synthetic progress.
    """
    adapter = _require_model()
    task = request.task.model_dump()
    test_index = request.test_index

    q: "queue.Queue[Tuple[str, Any] | None]" = queue.Queue()

    def worker() -> None:
        events: List[Dict[str, Any]] = []

        def on_event(event: Dict[str, Any]) -> None:
            events.append(event)
            q.put(("stage", event))

        try:
            result = adapter.run_inference(task, test_index, on_event)
            q.put(("result", _build_response(result, events).model_dump()))
        except ARCValidationError as exc:
            q.put(("error", {"detail": str(exc), "status": 422}))
        except Exception as exc:  # noqa: BLE001
            q.put(("error", {
                "detail": f"HRM inference failed: {type(exc).__name__}: {exc}",
                "status": 500}))
        finally:
            q.put(None)

    threading.Thread(target=worker, daemon=True).start()

    async def generator() -> AsyncIterator[str]:
        loop = asyncio.get_running_loop()
        while True:
            item = await loop.run_in_executor(None, q.get)
            if item is None:
                break
            kind, payload = item
            yield f"event: {kind}\ndata: {json.dumps(payload)}\n\n"

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/jobs/{job_id}", response_model=PuzzleResponse)
def get_job(job_id: str) -> PuzzleResponse:
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail=f"unknown job_id {job_id}")
    return JOBS[job_id]


@router.get("/jobs/{job_id}/result", response_model=PuzzleResponse)
def get_job_result(job_id: str) -> PuzzleResponse:
    return get_job(job_id)
