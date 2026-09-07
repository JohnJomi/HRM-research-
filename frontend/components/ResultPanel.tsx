"use client";

import ArcGrid from "./ArcGrid";
import type { Grid, PuzzleResponse } from "@/lib/types";

interface Props {
  result: PuzzleResponse;
  groundTruth?: Grid | null;
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded border border-ink-700 bg-ink-850 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm text-slate-200">{value}</div>
      {hint && <div className="mt-0.5 font-mono text-[10px] text-slate-600">{hint}</div>}
    </div>
  );
}

function gridsEqual(a: Grid, b: Grid): boolean {
  return (
    a.length === b.length &&
    a.every((row, i) => row.length === b[i].length && row.every((v, j) => v === b[i][j]))
  );
}

export default function ResultPanel({ result, groundTruth }: Props) {
  const m = result.metadata;
  const [rows, cols] = result.prediction_dimensions;
  const match = groundTruth ? gridsEqual(result.prediction_grid, groundTruth) : null;
  const decodeMethod = (m.decode_info?.method as string) ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-8">
        <ArcGrid grid={result.input_grid} maxSize={300} label="Input" />
        <div className="flex h-[300px] items-center">
          <span className="font-mono text-2xl text-slate-700">→</span>
        </div>
        <ArcGrid grid={result.prediction_grid} maxSize={300} label="HRM Prediction" />
        {groundTruth && (
          <ArcGrid grid={groundTruth} maxSize={300} label="Ground truth" />
        )}
      </div>

      {match !== null && (
        <div
          className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] ${
            match
              ? "border-emerald-700/60 bg-emerald-500/10 text-emerald-300"
              : "border-amber-700/60 bg-amber-500/10 text-amber-300"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${match ? "bg-emerald-400" : "bg-amber-400"}`} />
          {match ? "Exact match with this task's answer" : "Differs from this task's answer"}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <Metric label="Dimensions" value={`${rows} × ${cols}`} hint={decodeMethod} />
        <Metric
          label="Inference time"
          value={`${(m.elapsed_ms / 1000).toFixed(2)} s`}
          hint={`${Math.round(m.elapsed_ms)} ms`}
        />
        <Metric
          label="ACT steps"
          value={`${m.steps} / ${m.max_steps}`}
          hint="fixed in eval mode"
        />
        <Metric label="Device" value={m.device.toUpperCase()} hint="local inference" />
        <Metric label="Dtype" value={m.dtype.replace("torch.", "")} />
        <Metric label="Logits" value={m.logits_shape.join(" × ")} hint="batch × seq × vocab" />
        <Metric
          label="Puzzle embedding"
          value={`id ${m.puzzle_identifier}`}
          hint={m.puzzle_identifier === 0 ? "blank" : "trained"}
        />
        <Metric
          label="Final q_halt"
          value={m.q_halt_logits.length ? m.q_halt_logits[m.q_halt_logits.length - 1].toFixed(3) : "—"}
          hint={
            m.q_continue_logits.length
              ? `q_continue ${m.q_continue_logits[m.q_continue_logits.length - 1].toFixed(3)}`
              : undefined
          }
        />
      </div>

      <div className="font-mono text-[10px] text-slate-600">
        job {result.job_id}
        {result.raw_tokens ? ` · ${result.raw_tokens.length} predicted tokens` : ""}
      </div>
    </div>
  );
}
