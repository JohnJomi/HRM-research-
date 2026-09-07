"use client";

import type { PipelineEvent } from "@/lib/types";

/** The real stages emitted by the adapter's on_event callback. */
const STAGES = [
  { key: "validating", label: "Validation" },
  { key: "preprocessing", label: "Preprocessing" },
  { key: "encoding", label: "Encoding" },
  { key: "act_step", label: "HRM Inference" },
  { key: "postprocessing", label: "Postprocessing" },
  { key: "complete", label: "Complete" },
] as const;

interface Props {
  events: PipelineEvent[];
  running: boolean;
  streaming: boolean;
  failed: boolean;
}

export default function PipelineMonitor({ events, running, streaming, failed }: Props) {
  const seen = new Set(events.map((e) => e.stage));
  const actSteps = events.filter((e) => e.stage === "act_step");
  const lastAct = actSteps[actSteps.length - 1];
  const maxSteps = lastAct?.max_steps ?? null;
  const currentStep = lastAct?.step ?? 0;

  // The active stage is the last one we actually received an event for.
  const lastStage = events[events.length - 1]?.stage;
  const done = seen.has("complete");

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">
          Pipeline
        </h2>
        <span className="font-mono text-[10px] text-slate-600">
          {streaming ? "live · sse" : running ? "running" : done ? "finished" : "idle"}
        </span>
      </div>

      <ol className="space-y-1.5">
        {STAGES.map((stage) => {
          const reached = seen.has(stage.key);
          const active = running && !done && lastStage === stage.key;
          const isInference = stage.key === "act_step";

          let dot = "border-ink-600 bg-ink-850";
          let text = "text-slate-600";
          if (failed && active) {
            dot = "border-red-500 bg-red-500/20";
            text = "text-red-300";
          } else if (active) {
            dot = "border-accent bg-accent/30 animate-pulse";
            text = "text-slate-100";
          } else if (reached) {
            dot = "border-emerald-500/70 bg-emerald-500/20";
            text = "text-slate-300";
          }

          return (
            <li key={stage.key} className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full border ${dot}`} />
              <span className={`font-mono text-[11px] uppercase tracking-[0.12em] ${text}`}>
                {stage.label}
              </span>

              {isInference && actSteps.length > 0 && (
                <span className="ml-auto flex items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-300">
                    ACT STEP {currentStep} / {maxSteps ?? "?"}
                  </span>
                  {typeof lastAct?.q_halt_logit === "number" && (
                    <span
                      className="font-mono text-[10px] text-slate-600"
                      title="Q-head halt / continue logits for this step"
                    >
                      q {lastAct.q_halt_logit.toFixed(2)} /{" "}
                      {lastAct.q_continue_logit?.toFixed(2) ?? "—"}
                    </span>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {actSteps.length > 0 && maxSteps ? (
        <div className="space-y-1.5">
          <div className="h-1 w-full overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full bg-accent transition-[width] duration-200"
              style={{ width: `${Math.round((currentStep / maxSteps) * 100)}%` }}
            />
          </div>
          <div className="flex gap-px">
            {Array.from({ length: maxSteps }).map((_, i) => (
              <span
                key={i}
                className={`h-3 flex-1 rounded-[1px] ${
                  i < currentStep ? "bg-accent-dim" : "bg-ink-800"
                }`}
                title={
                  actSteps[i]?.q_halt_logit != null
                    ? `step ${i + 1} · q_halt ${actSteps[i].q_halt_logit!.toFixed(3)}`
                    : `step ${i + 1}`
                }
              />
            ))}
          </div>
          <p className="font-mono text-[10px] text-slate-600">
            Real ACT iterations reported by the model — the loop runs a fixed{" "}
            {maxSteps} steps in eval mode.
          </p>
        </div>
      ) : (
        running && (
          <p className="font-mono text-[10px] text-slate-600">
            Waiting for the model to report its first step…
          </p>
        )
      )}
    </div>
  );
}
