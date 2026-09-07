"""Puzzle submission.

Execution is synchronous (one inference is ~5 s and the demo window is short),
but the response is already job-shaped and the results are kept in an in-memory
store, so an async/background variant can be added later without changing the
client contract.
"""
import uuid
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.concurrency import run_in_threadpool

from ..models.schemas import PipelineEvent, PuzzleRequest, PuzzleResponse
from ..services.hrm_adapter import get_adapter
from ..services.job_store import JOBS
from ..services.validation import ARCValidationError

router = APIRouter()


async def _run(task: Dict[str, Any], test_index: int) -> PuzzleResponse:
    adapter = get_adapter()
    if not adapter.loaded:
        raise HTTPException(
            status_code=503,
            detail=f"HRM model is not loaded: {adapter.load_error}")

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


@router.post("/puzzles", response_model=PuzzleResponse)
async def create_puzzle(request: PuzzleRequest) -> PuzzleResponse:
    """Submit a raw ARC task as JSON and get the HRM prediction back."""
    return await _run(request.task.model_dump(), request.test_index)


@router.post("/puzzles/upload", response_model=PuzzleResponse)
async def upload_puzzle(file: UploadFile = File(...), test_index: int = 0) -> PuzzleResponse:
    """Same thing via multipart upload of a .json ARC file."""
    import json

    raw = await file.read()
    try:
        task = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"invalid JSON: {exc}") from exc
    if not isinstance(task, dict):
        raise HTTPException(status_code=422, detail="ARC task file must contain a JSON object")
    return await _run(task, test_index)


@router.get("/jobs/{job_id}", response_model=PuzzleResponse)
def get_job(job_id: str) -> PuzzleResponse:
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail=f"unknown job_id {job_id}")
    return JOBS[job_id]


@router.get("/jobs/{job_id}/result", response_model=PuzzleResponse)
def get_job_result(job_id: str) -> PuzzleResponse:
    return get_job(job_id)
