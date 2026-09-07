"""Local FastAPI backend around the existing HRM."""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import health, puzzles
from .services.hrm_adapter import get_adapter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="HRM ARC Local Backend", version="0.2.0")

# Local-only demo; the Next.js dev server needs to reach this.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(puzzles.router, prefix="/api", tags=["puzzles"])


@app.on_event("startup")
def _load_model_once() -> None:
    """Load the checkpoint at startup so the first request is not slow.
    A load failure is recorded, not raised: /api/health must stay reachable
    and report hrm=offline."""
    adapter = get_adapter()
    if adapter.loaded:
        logger.info("HRM ready on %s", adapter.device)
    else:
        logger.error("HRM unavailable: %s", adapter.load_error)
