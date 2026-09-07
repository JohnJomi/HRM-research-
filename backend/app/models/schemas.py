"""Pydantic request/response schemas."""
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

Grid = List[List[int]]


class ARCExample(BaseModel):
    input: Grid
    output: Optional[Grid] = None


class ARCTask(BaseModel):
    """Raw ARC task JSON. Grid contents are validated by the service layer
    against the encoder's real constraints, so the errors name the exact cell."""
    train: List[ARCExample] = Field(..., description="demonstration input/output pairs")
    test: List[ARCExample] = Field(..., description="at least one example with an 'input' grid")


class PuzzleRequest(BaseModel):
    task: ARCTask
    test_index: int = 0


class PipelineEvent(BaseModel):
    stage: str
    step: Optional[int] = None
    max_steps: Optional[int] = None
    q_halt_logit: Optional[float] = None
    q_continue_logit: Optional[float] = None
    seq_len: Optional[int] = None
    elapsed_ms: Optional[float] = None
    steps: Optional[int] = None
    dimensions: Optional[List[int]] = None


class InferenceMetadata(BaseModel):
    steps: int
    max_steps: int
    elapsed_ms: float
    device: str
    dtype: str
    logits_shape: List[int]
    q_halt_logits: List[float]
    q_continue_logits: List[float]
    decode_info: Dict[str, Any]
    puzzle_identifier: int


class PuzzleResponse(BaseModel):
    job_id: str
    status: str
    input_grid: Grid
    prediction_grid: Grid
    prediction_dimensions: List[int]
    metadata: InferenceMetadata
    events: List[PipelineEvent]
    raw_tokens: Optional[List[int]] = None


class HRMStatus(BaseModel):
    loaded: bool
    error: Optional[str] = None
    device: Optional[str] = None
    dtype: Optional[str] = None
    checkpoint: Optional[str] = None
    config: Optional[str] = None
    max_steps: Optional[int] = None
    load_time_ms: Optional[float] = None


class HealthResponse(BaseModel):
    backend: str
    hrm: str
    device: Optional[str] = None
    detail: HRMStatus
