# HRM ARC Workstation — frontend

Next.js 14 (App Router) + React + TypeScript + Tailwind. Single dashboard screen.

## Run

```bash
# 1. backend (from the repo root)
hrm_env/bin/python -m uvicorn backend.app.main:app --port 8000

# 2. frontend
cd frontend && npm install && npm run dev     # http://localhost:3001
```

Port 3001 is the default because 3000 was already taken on this machine;
override with `PORT=3000 npm run dev`. `next.config.mjs` rewrites `/api/*` to
the backend (`HRM_BACKEND_URL`, default `http://127.0.0.1:8000`), so the browser
talks same-origin and CORS never enters the picture.

## Flow

Upload / drop / paste ARC JSON → client-side shape check → task preview
(demonstrations + selectable test input) → **Run HRM** → `POST /api/puzzles/stream`
→ real pipeline events rendered live → input / prediction grids + metadata.

If the SSE endpoint is unavailable the client falls back to `POST /api/puzzles`
and rebuilds the pipeline view from the `events` array in the response, so the
result still displays correctly.

## Notes

- The backend is authoritative for validation; the client check only catches
  obviously wrong files so the user gets instant feedback.
- Model availability comes from `GET /api/health` — never assumed.
- No fabricated confidence scores and no synthetic progress: every stage and
  ACT step shown comes from a real adapter event.
