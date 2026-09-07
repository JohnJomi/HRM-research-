# Local HRM ARC Interface --- Architecture Specification

## 1. Purpose

Build a full-stack local web interface for the existing Hierarchical
Reasoning Model (HRM) pipeline.

The application allows a user to upload ARC (Abstraction and Reasoning
Corpus) puzzle data through a browser. The uploaded task is sent to a
locally running backend, which invokes the existing HRM pipeline on the
same machine.

The system must expose the real pipeline stages through the interface
without replacing, duplicating, or faking the existing HRM
implementation.

### Core flow

``` text
User
  │
  ▼
Web UI
  │
  │ Upload ARC task
  ▼
Local Backend API
  │
  ▼
HRM Adapter
  │
  ▼
Existing HRM Pipeline
  ├── Input validation
  ├── Preprocessing
  ├── Encoding / tensor preparation
  ├── HRM inference
  ├── Reasoning / recurrent iterations
  └── Postprocessing
  │
  ▼
Prediction
  │
  ▼
Web UI
  ├── Input visualization
  ├── Output visualization
  ├── Pipeline status
  └── Inference statistics
```

------------------------------------------------------------------------

# 2. Design Principles

## 2.1 Preserve the existing HRM

The existing HRM implementation is the source of truth.

Do not rewrite the model, preprocessing, training code, inference logic,
or postprocessing merely to make it work with the web interface.

Instead, introduce a thin integration layer / adapter around the
existing implementation.

``` text
Web application
      │
      ▼
Integration layer
      │
      ▼
Existing HRM code
```

## 2.2 Local-first execution

All AI computation should happen locally on the user's machine.

The browser communicates with the local backend. The backend
communicates with the local HRM.

No puzzle data or model inference should be sent to a remote AI service.

## 2.3 Real pipeline state

The UI must represent actual pipeline progress.

Do not use fake timers or artificial progress bars to simulate
inference.

If the HRM exposes meaningful stages or iteration information, those
events should be surfaced to the frontend.

## 2.4 Modular architecture

The interface should not be tightly coupled to one implementation of
HRM.

Future models or reasoning pipelines should be attachable through an
adapter/interface without rewriting the frontend.

------------------------------------------------------------------------

# 3. High-Level Architecture

``` text
┌─────────────────────────────────────────────────────────────┐
│                         BROWSER                             │
│                                                             │
│  Next.js / React / TypeScript                               │
│                                                             │
│  ┌───────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │ Upload        │  │ ARC Grid       │  │ Pipeline       │ │
│  │ Interface     │  │ Visualizer     │  │ Monitor        │ │
│  └───────┬───────┘  └───────┬────────┘  └───────┬────────┘ │
│          │                  │                   │          │
└──────────┼──────────────────┼───────────────────┼──────────┘
           │ REST             │ REST/WebSocket    │ WebSocket
           ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    LOCAL BACKEND                            │
│                                                             │
│                       FastAPI                               │
│                                                             │
│  ┌────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ API Routes │ │ Job Manager  │ │ WebSocket Manager    │ │
│  └─────┬──────┘ └──────┬───────┘ └──────────┬───────────┘ │
│        │               │                    │             │
│        └───────────────┼────────────────────┘             │
│                        ▼                                  │
│                ┌───────────────┐                          │
│                │ HRM Adapter   │                          │
│                └───────┬───────┘                          │
└────────────────────────┼───────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXISTING HRM                             │
│                                                             │
│  Input → Preprocessing → Encoding → HRM → Postprocessing   │
│                            │                                │
│                            ▼                                │
│                     Prediction Result                       │
└─────────────────────────────────────────────────────────────┘
```

------------------------------------------------------------------------

# 4. Technology Stack

## Frontend

-   Next.js
-   React
-   TypeScript
-   Tailwind CSS
-   shadcn/ui where useful
-   WebSocket client for live pipeline events

## Backend

-   Python
-   FastAPI
-   Pydantic for request/response validation
-   WebSocket support
-   Existing Python HRM runtime

## Storage

For the initial version, avoid introducing a database unless the
existing project requires one.

Use:

-   in-memory job state for active inference jobs
-   temporary/local filesystem storage for uploaded tasks when necessary

A database can be introduced later for persistent experiment history.

------------------------------------------------------------------------

# 5. Repository Structure

The exact structure should be adapted after inspecting the existing HRM
repository.

Recommended target structure:

``` text
project-root/
│
├── frontend/
│   ├── app/
│   ├── components/
│   │   ├── arc/
│   │   ├── pipeline/
│   │   ├── upload/
│   │   └── results/
│   ├── lib/
│   ├── hooks/
│   ├── types/
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── puzzles.py
│   │   │   ├── jobs.py
│   │   │   └── websocket.py
│   │   ├── models/
│   │   ├── services/
│   │   │   ├── job_manager.py
│   │   │   └── hrm_adapter.py
│   │   └── core/
│   └── requirements.txt
│
├── hrm/
│   └── existing HRM implementation
│
├── data/
│   └── optional local puzzle data
│
└── architecture.md
```

The existing HRM directory should be preserved rather than moved
unnecessarily.

------------------------------------------------------------------------

# 6. Frontend Architecture

## 6.1 Main screens

### Dashboard

Primary landing page containing:

-   application/model status
-   ARC upload area
-   recent/current task
-   run button
-   pipeline overview

### Inference View

Shown while the HRM is running.

Contains:

-   uploaded puzzle
-   pipeline stages
-   current stage
-   iteration information if available
-   elapsed inference time
-   live status

### Results View

Contains:

-   input grid
-   predicted output grid
-   train examples where applicable
-   test input
-   prediction
-   raw JSON view
-   inference statistics

------------------------------------------------------------------------

# 7. ARC Data Model

The application should support standard ARC-style JSON structures.

A task generally contains training examples and test examples.

Conceptually:

``` json
{
  "train": [
    {
      "input": [[0, 0], [0, 1]],
      "output": [[0, 1], [1, 0]]
    }
  ],
  "test": [
    {
      "input": [[0, 0], [1, 0]]
    }
  ]
}
```

The frontend should not assume that all grids have the same dimensions.

The ARC renderer must support:

-   variable row counts
-   variable column counts
-   all standard ARC color values
-   rectangular grids
-   train input/output pairs
-   test inputs
-   predicted outputs

------------------------------------------------------------------------

# 8. Upload Flow

``` text
User selects file
       │
       ▼
Frontend validates basic format
       │
       ▼
POST /api/puzzles
       │
       ▼
Backend validates ARC structure
       │
       ▼
Create inference job
       │
       ▼
Return job_id
       │
       ▼
Frontend connects to job WebSocket
       │
       ▼
HRM execution starts
```

Supported formats should initially be determined by what the existing
HRM pipeline actually accepts.

Do not add image-to-ARC conversion unless the HRM already supports it or
it is explicitly implemented as a separate feature.

------------------------------------------------------------------------

# 9. Backend API

## POST `/api/puzzles`

Creates an inference job.

Request:

``` text
multipart/form-data
file=<ARC task>
```

Response:

``` json
{
  "job_id": "abc123",
  "status": "queued"
}
```

------------------------------------------------------------------------

## GET `/api/jobs/{job_id}`

Returns current job state.

Example:

``` json
{
  "job_id": "abc123",
  "status": "running",
  "stage": "hrm_inference",
  "progress": 67
}
```

Possible statuses:

``` text
queued
preprocessing
encoding
inference
postprocessing
completed
failed
cancelled
```

------------------------------------------------------------------------

## GET `/api/jobs/{job_id}/result`

Returns the completed result.

Example:

``` json
{
  "job_id": "abc123",
  "status": "completed",
  "input": [[0, 0], [1, 1]],
  "output": [[0, 0], [2, 2]],
  "inference_time_ms": 1820,
  "iterations": 12
}
```

The exact response schema should reflect the actual HRM output.

------------------------------------------------------------------------

# 10. WebSocket Architecture

WebSockets should be used for live inference status.

Endpoint:

``` text
/ws/jobs/{job_id}
```

Example event sequence:

``` json
{
  "type": "stage",
  "stage": "preprocessing",
  "status": "started"
}
```

``` json
{
  "type": "stage",
  "stage": "preprocessing",
  "status": "completed"
}
```

``` json
{
  "type": "stage",
  "stage": "hrm_inference",
  "status": "running",
  "iteration": 8,
  "total_iterations": 12
}
```

``` json
{
  "type": "stage",
  "stage": "postprocessing",
  "status": "completed"
}
```

``` json
{
  "type": "job",
  "status": "completed"
}
```

If the existing HRM does not expose iteration-level information, do not
fabricate it. The adapter should expose only information that can be
obtained reliably.

------------------------------------------------------------------------

# 11. HRM Adapter

The adapter is the most important backend boundary.

Conceptually:

``` python
class HRMAdapter:
    def run(self, puzzle, event_callback=None):
        processed = self.preprocess(puzzle, event_callback)

        encoded = self.encode(processed, event_callback)

        result = self.infer(encoded, event_callback)

        output = self.postprocess(result, event_callback)

        return output
```

However, this is an architectural concept, not a requirement to
duplicate existing functions.

The implementation must inspect the existing HRM code and call its real
entry points.

### Adapter responsibilities

-   receive validated ARC data
-   invoke the existing pipeline
-   translate pipeline state into application events
-   normalize the final result into an API-safe representation
-   capture inference metadata when available
-   propagate real errors

### Adapter must not

-   implement a second HRM
-   duplicate preprocessing
-   silently alter model behavior
-   fake inference progress
-   hide model errors

------------------------------------------------------------------------

# 12. Job Management

Each inference request should receive a unique job ID.

``` text
job_id
  │
  ├── status
  ├── current_stage
  ├── created_at
  ├── started_at
  ├── completed_at
  ├── result
  └── error
```

For the initial implementation, jobs can be stored in memory.

Example:

``` python
jobs = {
    "abc123": {
        "status": "running",
        "stage": "hrm_inference"
    }
}
```

Do not introduce Redis, Celery, PostgreSQL, or other infrastructure
unless the actual workload requires it.

------------------------------------------------------------------------

# 13. Concurrency

The HRM may be computationally expensive and may use GPU resources.

The backend must avoid accidentally launching multiple model instances
for every request.

Preferred initial behavior:

``` text
One model instance
       │
       ▼
Inference queue
       │
       ├── Job A
       ├── Job B
       └── Job C
```

Whether inference can safely run concurrently must be determined from
the existing HRM implementation and hardware requirements.

If the model is not thread-safe or GPU memory is limited, serialize
inference jobs.

------------------------------------------------------------------------

# 14. Error Handling

Errors must be visible and actionable.

Potential failure categories:

``` text
Invalid ARC file
Malformed JSON
Invalid grid
Unsupported input format
Model loading failure
Preprocessing failure
Inference failure
Postprocessing failure
GPU / memory failure
Unexpected pipeline exception
```

Example API error:

``` json
{
  "status": "failed",
  "error": {
    "code": "INVALID_ARC",
    "message": "The uploaded task does not contain a valid test example."
  }
}
```

Never expose raw internal stack traces to the browser in production UI.

Detailed errors should remain available in local backend logs.

------------------------------------------------------------------------

# 15. Security and Locality

Although this is a local application, basic protections should still
exist.

### File handling

-   validate file extension
-   validate MIME type where appropriate
-   parse JSON safely
-   enforce reasonable upload size limits
-   avoid executing uploaded content
-   store temporary files outside executable paths

### Network

The initial application should bind to localhost.

Example:

``` text
Frontend: http://localhost:3000
Backend:  http://localhost:8000
```

Do not expose the inference server publicly unless explicitly required.

------------------------------------------------------------------------

# 16. UI Pipeline Visualization

The pipeline should be represented as a real state machine.

``` text
UPLOAD
   ↓
VALIDATING
   ↓
PREPROCESSING
   ↓
ENCODING
   ↓
HRM INFERENCE
   ↓
POSTPROCESSING
   ↓
COMPLETED
```

The interface should visually distinguish:

-   completed
-   active
-   waiting
-   failed

The UI should derive these states from backend events.

------------------------------------------------------------------------

# 17. ARC Grid Renderer

The ARC grid should be rendered as a visual grid rather than raw
numbers.

Requirements:

-   one cell per ARC value
-   clear grid boundaries
-   consistent cell sizing
-   support large and small grids
-   responsive layout
-   input/output side-by-side comparison
-   optional raw-value display

The renderer should use a centralized ARC color mapping.

Example:

``` text
0 → black/background
1 → blue
2 → red
3 → green
...
```

The exact visual palette should be defined in one place so it can be
adjusted without modifying the renderer.

------------------------------------------------------------------------

# 18. Result Presentation

The completed inference screen should contain:

``` text
┌───────────────────────────────────────────────┐
│                  HRM RESULT                   │
├───────────────────────┬───────────────────────┤
│ INPUT                 │ PREDICTED OUTPUT      │
│                       │                       │
│      ARC GRID         │      ARC GRID         │
│                       │                       │
└───────────────────────┴───────────────────────┘

Inference
─────────
Time:       1.82s
Iterations: 12
Status:     Completed
```

If the task contains multiple test examples, display each prediction
separately.

------------------------------------------------------------------------

# 19. Model Status

The UI should indicate whether the local backend/model is available.

Example:

``` text
● HRM ONLINE
Model loaded
Device: GPU
```

or:

``` text
○ HRM OFFLINE
Backend unavailable
```

This should come from a health endpoint rather than a hardcoded status.

Recommended:

``` text
GET /api/health
```

Response:

``` json
{
  "backend": "ok",
  "hrm": "loaded",
  "device": "cuda"
}
```

The exact fields depend on what can be reliably detected.

------------------------------------------------------------------------

# 20. Development and Startup

The application should eventually be startable with a simple local
workflow.

Example:

``` bash
# Backend
cd backend
uvicorn app.main:app --reload

# Frontend
cd frontend
npm run dev
```

A root-level startup script may later simplify this:

``` bash
./start.sh
```

Do not add complex deployment infrastructure for the initial local
version.

------------------------------------------------------------------------

# 21. Implementation Phases

## Phase 1 --- Inspect and Integrate

Before writing substantial code:

1.  Inspect the existing HRM repository.
2.  Identify the real inference entry point.
3.  Identify preprocessing and postprocessing boundaries.
4.  Determine accepted ARC input format.
5.  Determine model loading behavior.
6.  Determine whether inference is synchronous, asynchronous, GPU-bound,
    or otherwise constrained.
7.  Identify what pipeline state can be exposed reliably.

Deliverable:

``` text
ARC upload → backend → existing HRM → result
```

No major UI polish yet.

------------------------------------------------------------------------

## Phase 2 --- Backend API

Implement:

-   FastAPI application
-   health endpoint
-   upload endpoint
-   job manager
-   HRM adapter
-   result endpoint
-   error handling

Deliverable:

``` text
POST /api/puzzles
GET  /api/jobs/{id}
GET  /api/jobs/{id}/result
GET  /api/health
```

------------------------------------------------------------------------

## Phase 3 --- Live Pipeline

Implement:

-   WebSocket connection
-   pipeline event system
-   real HRM stage reporting
-   frontend state synchronization

Deliverable:

The browser visibly follows the actual HRM execution.

------------------------------------------------------------------------

## Phase 4 --- ARC Visualization

Implement:

-   ARC grid component
-   train example display
-   test input display
-   predicted output
-   JSON/raw-data toggle

Deliverable:

A user can visually understand the puzzle and HRM prediction.

------------------------------------------------------------------------

## Phase 5 --- UI/UX

Improve:

-   layout
-   typography
-   spacing
-   responsive behavior
-   upload experience
-   pipeline visualization
-   result presentation
-   loading/error states
-   model status

The interface should feel like a dedicated **local AI reasoning
workstation**, not a generic CRUD application.

------------------------------------------------------------------------

## Phase 6 --- Validation

Test the complete path:

``` text
Upload real ARC task
        ↓
Backend validation
        ↓
Existing preprocessing
        ↓
Existing HRM
        ↓
Existing postprocessing
        ↓
Correct prediction
        ↓
Frontend visualization
```

Also test:

-   malformed JSON
-   invalid ARC structure
-   empty file
-   unsupported file
-   model unavailable
-   inference failure
-   repeated inference
-   large grid
-   multiple test examples

------------------------------------------------------------------------

# 22. Non-Goals

The first version should NOT include:

-   user authentication
-   cloud deployment
-   remote inference
-   database-backed accounts
-   model training from the UI
-   experiment tracking platform
-   arbitrary model uploading
-   image-to-ARC OCR
-   fake reasoning traces
-   fabricated confidence scores

These can be considered later if there is a concrete requirement.

------------------------------------------------------------------------

# 23. Future Extensions

The architecture should make the following possible without major
frontend/backend rewrites:

``` text
                    Model Interface
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
         HRM           Other SLM       Future Model
          │              │              │
          └──────────────┼──────────────┘
                         ▼
                    Common Adapter
                         │
                         ▼
                     Web UI
```

Potential future features:

-   compare multiple models
-   batch ARC evaluation
-   accuracy benchmarking
-   inference history
-   model configuration
-   temperature/decoding controls if applicable
-   experiment runs
-   performance charts
-   CPU/GPU metrics
-   export predictions
-   model switching

The initial architecture should not over-engineer these features.

------------------------------------------------------------------------

# 24. Acceptance Criteria

The project is considered successfully integrated when all of the
following are true:

### Input

-   User can upload a valid ARC task.
-   Backend validates the task.
-   Invalid tasks produce understandable errors.

### Pipeline

-   Uploaded data reaches the existing HRM.
-   Existing preprocessing is used.
-   Existing inference code is used.
-   Existing postprocessing is used.
-   No duplicate model implementation exists.

### Execution

-   Job status is tracked.
-   Actual pipeline stages are reported where available.
-   Errors propagate correctly.
-   Local GPU/CPU execution works according to the existing HRM setup.

### Output

-   HRM prediction is returned to the frontend.
-   Input and predicted grids are visually rendered.
-   Multiple test examples are supported if present.
-   Raw JSON can be inspected.

### Architecture

-   Frontend and backend are separated.
-   HRM integration is isolated behind an adapter.
-   WebSocket communication is used for live status where appropriate.
-   The application runs entirely locally.

------------------------------------------------------------------------

# 25. Guiding Rule for Claude Code

Claude Code should work from the existing HRM implementation outward.

The correct order is:

``` text
UNDERSTAND EXISTING HRM
          ↓
IDENTIFY INFERENCE CONTRACT
          ↓
BUILD THIN ADAPTER
          ↓
BUILD BACKEND API
          ↓
CONNECT FRONTEND
          ↓
ADD REAL-TIME STATUS
          ↓
BUILD ARC VISUALIZATION
          ↓
POLISH UI
```

Do not begin by rewriting the HRM or restructuring the entire
repository.

Every implementation decision should preserve the correctness of the
existing model pipeline first, then improve usability around it.

The web application is an interface and orchestration layer around the
HRM --- **not a replacement for the HRM itself.**
