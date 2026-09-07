"""In-memory job store.

Deliberately a plain dict: no database, no queue. Results are per-process and
disappear on restart, which is fine for a local single-user demo.
"""
from typing import Any, Dict

JOBS: Dict[str, Any] = {}
