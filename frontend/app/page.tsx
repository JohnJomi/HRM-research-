"use client";

import { useCallback, useEffect, useState } from "react";

import ArcGrid from "@/components/ArcGrid";
import Panel from "@/components/Panel";
import PipelineMonitor from "@/components/PipelineMonitor";
import ResultPanel from "@/components/ResultPanel";
import StatusBadge from "@/components/StatusBadge";
import TaskPreview from "@/components/TaskPreview";
import UploadPanel from "@/components/UploadPanel";
import { fetchHealth, runInferenceStreaming } from "@/lib/api";
import type { ARCTask, HealthResponse, PipelineEvent, PuzzleResponse } from "@/lib/types";

export default function Dashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  const [task, setTask] = useState<ARCTask | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [testIndex, setTestIndex] = useState(0);

  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [result, setResult] = useState<PuzzleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      setHealth(await fetchHealth());
      setHealthError(null);
    } catch (err) {
      setHealth(null);
      setHealthError(err instanceof Error ? err.message : String(err));
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  const hrmOnline = health?.hrm === "online";
  const canRun = Boolean(task) && hrmOnline && !running;

  const handleTask = useCallback((next: ARCTask, name: string) => {
    setTask(next);
    setFileName(name);
    setTestIndex(0);
    setResult(null);
    setEvents([]);
    setError(null);
  }, []);

  const run = useCallback(async () => {
    if (!task || running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setEvents([]);
    try {
      const response = await runInferenceStreaming(task, testIndex, (event) =>
        setEvents((prev) => [...prev, event]),
      );
      setResult(response);
      // If SSE was unavailable the run still succeeded - fill the pipeline in
      // from the real events the response carries.
      setEvents((prev) => (prev.length > 0 ? prev : response.events));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      void loadHealth();
    } finally {
      setRunning(false);
    }
  }, [task, testIndex, running, loadHealth]);

  const groundTruth = task?.test[testIndex]?.output ?? null;

  return (
    <main className="mx-auto max-w-[1400px] px-8 py-7">
      {/* HEADER */}
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-ink-800 pb-5">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded border border-ink-600 bg-ink-850 font-mono text-[13px] font-bold tracking-tight text-accent">
            HRM
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-100">
              Hierarchical Reasoning Model
            </h1>
            <p className="font-mono text-[11px] tracking-[0.1em] text-slate-500">
              ARC ABSTRACTION &amp; REASONING WORKSTATION
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded border border-ink-700 bg-ink-850 px-3 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">
              Local inference
            </span>
          </div>
          <StatusBadge health={health} error={healthError} loading={healthLoading} />
          <button
            type="button"
            onClick={() => void loadHealth()}
            className="rounded border border-ink-700 bg-ink-850 px-2.5 py-2 font-mono text-[11px] text-slate-500 hover:text-slate-300"
            title="Re-check backend health"
          >
            ↻
          </button>
        </div>
      </header>

      {(healthError || (health && !hrmOnline)) && (
        <div className="mb-6 rounded border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          <strong className="font-semibold">
            {healthError ? "Backend unreachable." : "HRM model is offline."}
          </strong>{" "}
          {healthError ??
            health?.detail?.error ??
            "The checkpoint did not load, so inference is unavailable."}
          {healthError && (
            <span className="block font-mono text-[11px] text-red-300/70">
              start it with: hrm_env/bin/python -m uvicorn backend.app.main:app --port 8000
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* LEFT: task input + pipeline */}
        <div className="space-y-5">
          <Panel title="ARC Task" step="01">
            <UploadPanel
              onTask={handleTask}
              onError={setError}
              fileName={fileName}
              disabled={running}
            />
          </Panel>

          {task && (
            <Panel
              title="Task Preview"
              step="02"
              aside={
                <span className="font-mono text-[10px] text-slate-600">
                  test {testIndex + 1} of {task.test.length}
                </span>
              }
            >
              <TaskPreview
                task={task}
                testIndex={testIndex}
                onSelectTest={(i) => {
                  setTestIndex(i);
                  setResult(null);
                  setEvents([]);
                }}
                disabled={running}
              />
            </Panel>
          )}

          <Panel title="Run" step="03">
            <button
              type="button"
              onClick={() => void run()}
              disabled={!canRun}
              className="w-full rounded border border-accent-dim bg-accent/15 px-4 py-3 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:border-ink-700 disabled:bg-ink-850 disabled:text-slate-600"
            >
              {running ? "Running HRM…" : "Run HRM"}
            </button>
            <p className="mt-2 font-mono text-[10px] text-slate-600">
              {running
                ? "Inference is serialized — one task at a time."
                : !task
                  ? "Load an ARC task to enable inference."
                  : !hrmOnline
                    ? "The model is not available."
                    : `Sends test example ${testIndex + 1} to the local HRM.`}
            </p>
          </Panel>

          <Panel title="Pipeline" step="04">
            <PipelineMonitor
              events={events}
              running={running}
              streaming={running && events.length > 0}
              failed={Boolean(error)}
            />
          </Panel>
        </div>

        {/* RIGHT: results */}
        <div className="space-y-5">
          {error && (
            <div className="rounded border border-red-900/60 bg-red-950/30 px-4 py-3">
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-red-300">
                Inference failed
              </div>
              <p className="mt-1 text-sm text-red-100">{error}</p>
            </div>
          )}

          <Panel
            title="Result"
            step="05"
            aside={
              result && (
                <span className="font-mono text-[10px] text-slate-600">
                  {result.metadata.device.toUpperCase()} ·{" "}
                  {result.metadata.dtype.replace("torch.", "")}
                </span>
              )
            }
          >
            {result ? (
              <ResultPanel result={result} groundTruth={groundTruth} />
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 py-14">
                <ArcGrid
                  grid={task?.test[testIndex]?.input ?? null}
                  maxSize={240}
                  label={task ? "Awaiting prediction" : undefined}
                  emptyMessage="Load an ARC task to begin"
                />
                <p className="max-w-sm text-center text-xs text-slate-600">
                  {running
                    ? "The model is reasoning over the encoded 30×30 sequence."
                    : task
                      ? "Press Run HRM to send this test input to the local model."
                      : "Drop an ARC task JSON file into the panel on the left."}
                </p>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* Limitation notice - present, but not the visual focus. */}
      <footer className="mt-6 border-t border-ink-800 pt-4">
        <p className="max-w-4xl font-mono text-[10px] leading-relaxed text-slate-600">
          <span className="text-slate-500">note</span> — uploaded tasks run with{" "}
          <span className="text-slate-500">puzzle_identifiers=0</span>, a blank puzzle
          embedding: this checkpoint ships no compatible trained embedding table, so
          results should not be read as general ARC accuracy. All computation is local;
          no puzzle data leaves this machine.
        </p>
      </footer>
    </main>
  );
}
