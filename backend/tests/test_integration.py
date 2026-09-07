"""Backend integration test: ARC JSON -> API -> adapter -> REAL HRM -> decode -> JSON.

The HRM is NOT mocked. This runs one genuine inference (~5 s on MPS) using the
same known-good sample as phase1-smoke-test.md.
"""
import json
import os

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.hrm_runtime import REPO_ROOT

SAMPLE = os.path.join(
    REPO_ROOT, "dataset", "raw-data", "ARC-AGI", "data", "evaluation", "13713586.json")


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def task():
    with open(SAMPLE, "r") as f:
        return json.load(f)


def test_health_reports_loaded_model(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["backend"] == "ok"
    assert body["hrm"] == "online", f"HRM did not load: {body['detail']['error']}"
    assert body["device"] in ("mps", "cpu")
    assert body["detail"]["loaded"] is True


def test_real_inference_end_to_end(client, task):
    r = client.post("/api/puzzles", json={"task": task, "test_index": 0})
    assert r.status_code == 200, r.text
    body = r.json()

    # ARC input round-tripped
    assert body["input_grid"] == task["test"][0]["input"]

    # decoded prediction has real ARC dimensions, not the 30x30 canvas or 1x1
    rows, cols = body["prediction_dimensions"]
    assert (rows, cols) == (19, 18)
    assert len(body["prediction_grid"]) == rows
    assert all(len(row) == cols for row in body["prediction_grid"])
    assert all(0 <= v <= 9 for row in body["prediction_grid"] for v in row)

    # real HRM metadata
    meta = body["metadata"]
    assert meta["steps"] == meta["max_steps"] == 16
    assert meta["logits_shape"] == [1, 900, 12]
    assert len(meta["q_halt_logits"]) == 16
    assert meta["elapsed_ms"] > 0
    assert len(body["raw_tokens"]) == 900

    # real pipeline events, one act_step per ACT iteration
    stages = [e["stage"] for e in body["events"]]
    for expected in ("validating", "preprocessing", "encoding", "postprocessing", "complete"):
        assert expected in stages
    assert stages.count("act_step") == 16

    # job is retrievable
    job_id = body["job_id"]
    assert client.get(f"/api/jobs/{job_id}").status_code == 200
    assert client.get(f"/api/jobs/{job_id}/result").json()["prediction_grid"] \
        == body["prediction_grid"]


def test_prediction_matches_known_ground_truth(client, task):
    """This sample decoded to an exact match in phase 1. Recorded as a
    regression check on the decoder, not as an accuracy claim (n=1)."""
    r = client.post("/api/puzzles", json={"task": task, "test_index": 0})
    assert r.json()["prediction_grid"] == task["test"][0]["output"]


def test_multipart_upload(client, task):
    r = client.post(
        "/api/puzzles/upload",
        files={"file": ("13713586.json", json.dumps(task), "application/json")})
    assert r.status_code == 200, r.text
    assert r.json()["prediction_dimensions"] == [19, 18]


@pytest.mark.parametrize("bad,expected", [
    ({"test": [{"input": [[1]]}]}, "train"),           # required field absent
    ({"train": [], "test": []}, "must contain at least one example"),
    ({"train": [], "test": [{"input": [[1, 2], [3]]}]}, "not rectangular"),
    ({"train": [], "test": [{"input": [[1, 42]]}]}, "colors must be 0..9"),
    ({"train": [], "test": [{"input": [[1] * 31]}]}, "exceeds the 30x30 maximum"),
])
def test_validation_errors(client, bad, expected):
    r = client.post("/api/puzzles", json={"task": bad, "test_index": 0})
    assert r.status_code == 422, r.text
    assert expected in json.dumps(r.json())


def test_unknown_job_returns_404(client):
    assert client.get("/api/jobs/does-not-exist").status_code == 404
