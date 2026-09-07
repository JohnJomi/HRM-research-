from fastapi import APIRouter

from ..models.schemas import HealthResponse, HRMStatus
from ..services.hrm_adapter import get_adapter

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Backend liveness + real HRM load state.

    'hrm' reports "online" only when the checkpoint actually loaded.
    """
    status = get_adapter().status()
    return HealthResponse(
        backend="ok",
        hrm="online" if status["loaded"] else "offline",
        device=status["device"],
        detail=HRMStatus(**status),
    )
