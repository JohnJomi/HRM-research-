"use client";

import {
  IconCheck, IconCheckCircle, IconCode, IconCpu, IconGrid, IconLayers, IconQuote, IconSpinner,
} from "./icons";
import type { PipelineEvent } from "@/lib/types";

/** The real stages emitted by the adapter's on_event callback. */
const STAGES = [
  { key: "validating", title: "Validation", desc: "Checking task format and grid structure", Icon: IconCheck },
  { key: "preprocessing", title: "Preprocessing", desc: "Preparing ARC task for model input", Icon: IconLayers },
  { key: "encoding", title: "Encoding", desc: "Converting grids to token representation", Icon: IconCode },
  { key: "act_step", title: "HRM Inference", desc: "Hierarchical reasoning over the sequence", Icon: IconCpu },
  { key: "postprocessing", title: "Postprocessing", desc: "Decoding prediction to ARC grid", Icon: IconGrid },
  { key: "complete", title: "Complete", desc: "Inference finished", Icon: IconCheckCircle },
] as const;

interface Props {
  events: PipelineEvent[];
  running: boolean;
  failed: boolean;
  hasTask: boolean;
}

export default function PipelineMonitor({ events, running, failed, hasTask }: Props) {
  const seen = new Set(events.map((e) => e.stage));
  const acts = events.filter((e) => e.stage === "act_step");
  const last = acts[acts.length - 1];
  const maxSteps = last?.max_steps ?? null;
  const step = last?.step ?? 0;
  const lastStage = events[events.length - 1]?.stage;
  const done = seen.has("complete");
  const started = events.length > 0;

  const stateLabel = failed ? "Failed" : running ? "Running" : done ? "Finished" : "Idle";
  const stateTone = failed
    ? "border-danger-200 bg-danger-50 text-danger-700"
    : running
      ? "border-brand-200 bg-brand-50 text-brand-800"
      : "border-line bg-subtle text-muted";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
      <ol className="relative space-y-0">
        {STAGES.map((stage, i) => {
          const reached = seen.has(stage.key);
          const active = running && !done && lastStage === stage.key;
          const isFailed = failed && active;
          const isLast = i === STAGES.length - 1;

          let dot = "border-line-strong bg-surface text-faint";
          let title = "text-muted";
          if (isFailed) {
            dot = "border-danger-500 bg-danger-50 text-danger-700";
            title = "text-danger-700";
          } else if (active) {
            dot = "border-brand-500 bg-brand-500 text-white animate-pulse-ring";
            title = "text-heading";
          } else if (reached) {
            dot = "border-brand-400 bg-brand-100 text-brand-600";
            title = "text-heading";
          }

          return (
            <li key={stage.key} className="relative flex gap-3 pb-4 last:pb-0">
              {!isLast && (
                <span
                  aria-hidden
                  className={`absolute left-[13px] top-7 h-[calc(100%-14px)] w-px ${
                    reached ? "bg-brand-300" : "bg-line"
                  }`}
                />
              )}
              <span
                className={`relative z-10 flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${dot}`}
              >
                {reached && !active ? (
                  <IconCheck className="h-3.5 w-3.5" />
                ) : (
                  <stage.Icon className="h-3.5 w-3.5" />
                )}
              </span>

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-baseline gap-x-2.5">
                  <span className={`text-[13.5px] font-semibold ${title}`}>{stage.title}</span>

                  {stage.key === "act_step" && acts.length > 0 && (
                    <>
                      <span className="rounded-md bg-brand-50 px-1.5 py-0.5 font-mono text-[11.5px] font-semibold text-brand-800">
                        ACT Step {step} / {maxSteps ?? "?"}
                      </span>
                      {typeof last?.q_halt_logit === "number" && (
                        <span
                          className="font-mono text-[11px] text-faint"
                          title="Q-head halt / continue logits reported for this step"
                        >
                          q_halt {last.q_halt_logit.toFixed(3)}
                        </span>
                      )}
                    </>
                  )}
                </div>
                <p className="text-[12px] text-muted">{stage.desc}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="space-y-3">
        <div className="flex items-center justify-end">
          <span className={`rounded-pill border px-2.5 py-1 text-[11.5px] font-medium ${stateTone}`}>
            {stateLabel}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center rounded-panel border border-line bg-subtle px-4 py-6 text-center">
          {running ? (
            <>
              <IconSpinner className="h-9 w-9 animate-spin text-brand-500" />
              <p className="mt-3 text-[13.5px] font-semibold text-heading">Running HRM…</p>
              <p className="mt-1 font-mono text-[12px] text-muted">
                {maxSteps ? `${step} / ${maxSteps} ACT steps` : "starting"}
              </p>
            </>
          ) : done ? (
            <>
              <IconCheckCircle className="h-9 w-9 text-brand-500" />
              <p className="mt-3 text-[13.5px] font-semibold text-heading">Inference complete</p>
              <p className="mt-1 font-mono text-[12px] text-muted">{acts.length} ACT steps</p>
            </>
          ) : (
            <>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-line-strong" />
              <p className="mt-3 text-[13.5px] font-semibold text-heading">Ready to start</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                {hasTask ? "Click Run HRM to begin inference." : "Upload an ARC task to begin."}
              </p>
            </>
          )}
        </div>

        {started && maxSteps ? (
          <div className="space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-pill bg-line">
              <div
                className="h-full rounded-pill bg-brand-500 transition-[width] duration-200"
                style={{ width: `${Math.round((step / maxSteps) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-faint">
              Real ACT iterations reported by the model.
            </p>
          </div>
        ) : (
          <div className="flex gap-2.5 rounded-panel border border-line bg-subtle px-3.5 py-3">
            <IconQuote className="h-4 w-4 shrink-0 text-brand-300" />
            <p className="text-[12px] italic leading-relaxed text-muted">
              Complex reasoning through simple, recurrent computation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
