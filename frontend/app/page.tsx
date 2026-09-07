"use client";

import { useCallback, useEffect, useState } from "react";

import ArcGrid from "@/components/ArcGrid";
import Card from "@/components/Card";
import Hero from "@/components/Hero";
import InferenceDetails from "@/components/InferenceDetails";
import PipelineMonitor from "@/components/PipelineMonitor";
import ResultPanel, { MatchBadge } from "@/components/ResultPanel";
import RunCard from "@/components/RunCard";
import Sidebar from "@/components/Sidebar";
import TopHeader from "@/components/TopHeader";
import TaskPreview from "@/components/TaskPreview";
import UploadPanel from "@/components/UploadPanel";
import {
  IconAlert, IconChart, IconChip, IconEye, IconInfo, IconPlay, IconUpload,
} from "@/components/icons";
import { fetchHealth, runInferenceStreaming } from "@/lib/api";
import type { ARCTask, HealthResponse, PipelineEvent, PuzzleResponse } from "@/lib/types";

export default function Workstation() {
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

  const handleTask = useCallback((next: ARCTask, name: string) => {
    setTask(next);
    setFileName(name);
    setTestIndex(0);
    setResult(null);
    setEvents([]);
    setError(null);
  }, []);

  const clearTask = useCallback(() => {
    setTask(null);
    setFileName(null);
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
    <div className="min-h-screen p-0 lg:p-4">
      <div className="mx-auto flex min-h-screen max-w-[1500px] overflow-hidden rounded-none border-line bg-shell shadow-card lg:min-h-[calc(100vh-2rem)] lg:rounded-[22px] lg:border">
        <Sidebar onNewTask={clearTask} />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopHeader
            health={health}
            error={healthError}
            loading={healthLoading}
            onRefresh={() => void loadHealth()}
          />

          <main className="flex-1 space-y-4 overflow-y-auto bg-canvas/40 p-4 lg:p-5">
            <Hero />

            {(healthError || (health && !hrmOnline)) && (
              <div className="flex items-start gap-3 rounded-card border border-danger-200 bg-danger-50 px-4 py-3.5 animate-fade-up">
                <IconAlert className="mt-0.5 h-[18px] w-[18px] shrink-0 text-danger-500" />
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-danger-700">
                    {healthError ? "Backend offline" : "HRM offline"}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-danger-700/80">
                    {healthError
                      ? "Start the local backend to enable inference."
                      : (health?.detail?.error ??
                        "The checkpoint did not load, so inference is unavailable.")}
                  </p>
                  {healthError && (
                    <code className="mt-1.5 block font-mono text-[11.5px] text-danger-700/70">
                      hrm_env/bin/python -m uvicorn backend.app.main:app --port 8000
                    </code>
                  )}
                </div>
                <button type="button" onClick={() => void loadHealth()} className="btn-quiet">
                  Retry
                </button>
              </div>
            )}

            {/* 01 / 02 */}
            <div className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
              <Card
                step="01"
                title="Upload ARC Task"
                Icon={IconUpload}
                aside={
                  <span title="Backend re-validates every task" className="text-faint">
                    <IconInfo className="h-4 w-4" />
                  </span>
                }
              >
                <UploadPanel
                  onTask={handleTask}
                  onError={setError}
                  fileName={fileName}
                  disabled={running}
                />
              </Card>

              <Card
                step="02"
                title="Task Preview"
                Icon={IconEye}
                aside={
                  task && (
                    <span className="chip">
                      Test Example {testIndex + 1} of {task.test.length}
                    </span>
                  )
                }
              >
                {task ? (
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
                ) : (
                  <div className="flex h-full min-h-[210px] flex-col items-center justify-center gap-2 rounded-panel border border-dashed border-line-strong bg-subtle">
                    <p className="text-[14px] font-medium text-muted">Load an ARC task to begin</p>
                    <p className="text-[12.5px] text-faint">
                      Demonstrations and the test input will appear here.
                    </p>
                  </div>
                )}
              </Card>
            </div>

            {/* 03 / 04 */}
            <div className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
              <Card step="03" title="Run Inference" Icon={IconPlay}>
                <RunCard
                  onRun={() => void run()}
                  running={running}
                  hasTask={Boolean(task)}
                  hrmOnline={Boolean(hrmOnline)}
                  testIndex={testIndex}
                  testCount={task?.test.length ?? 0}
                />
              </Card>

              <Card step="04" title="Pipeline Progress" Icon={IconChart}>
                <PipelineMonitor
                  events={events}
                  running={running}
                  failed={Boolean(error)}
                  hasTask={Boolean(task)}
                />
              </Card>
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-card border border-danger-200 bg-danger-50 px-4 py-3.5 animate-fade-up">
                <IconAlert className="mt-0.5 h-[18px] w-[18px] shrink-0 text-danger-500" />
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-danger-700">Inference failed</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-danger-700/80">{error}</p>
                </div>
                {task && (
                  <button
                    type="button"
                    onClick={() => void run()}
                    disabled={running || !hrmOnline}
                    className="btn-quiet disabled:opacity-50"
                  >
                    Try again
                  </button>
                )}
              </div>
            )}

            {/* 05 / 06 */}
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
              <Card
                step="05"
                title="Result"
                Icon={IconChart}
                aside={
                  result && <MatchBadge result={result} groundTruth={groundTruth} />
                }
              >
                {result ? (
                  <ResultPanel result={result} groundTruth={groundTruth} />
                ) : (
                  <div className="flex min-h-[230px] flex-col items-center justify-center gap-3 py-4">
                    <ArcGrid
                      grid={task?.test[testIndex]?.input ?? null}
                      maxSize={170}
                      showDimensions={false}
                      emptyMessage="Load an ARC task to begin"
                    />
                    <p className="max-w-xs text-center text-[13px] text-muted">
                      {running
                        ? "The model is reasoning over the encoded sequence."
                        : task
                          ? "Run HRM to see the predicted grid here."
                          : "The prediction will appear here."}
                    </p>
                  </div>
                )}
              </Card>

              <Card step="06" title="Inference Details" Icon={IconChip}>
                {result ? (
                  <InferenceDetails result={result} />
                ) : (
                  <div className="flex min-h-[230px] items-center justify-center rounded-panel border border-dashed border-line-strong bg-subtle px-6 text-center">
                    <p className="text-[13px] text-faint">
                      Timing, ACT steps, device and tensor shapes appear after a run.
                    </p>
                  </div>
                )}
              </Card>
            </div>

            {/* Honest limitation - visible, not dominant. */}
            <div className="flex items-start gap-2.5 rounded-card border border-line bg-subtle px-4 py-3">
              <IconInfo className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
              <p className="text-[12.5px] leading-relaxed text-muted">
                Uploaded tasks run with a blank puzzle embedding
                (<span className="font-mono">puzzle_identifiers=0</span>) because this checkpoint
                ships no compatible trained embedding table. Results should not be interpreted as
                general ARC accuracy.
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
