"use client";

import type { ComponentType, SVGProps } from "react";
import {
  IconChip, IconClock, IconCode, IconCpu, IconDatabase, IconFile, IconGrid, IconLayers, IconPulse,
} from "./icons";
import type { PuzzleResponse } from "@/lib/types";

interface MetricProps {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
  hint?: string;
  primary?: boolean;
}

function Metric({ Icon, label, value, hint, primary }: MetricProps) {
  return (
    <div
      className={`rounded-panel border p-3.5 transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-card ${
        primary ? "border-line bg-surface" : "border-line bg-subtle"
      }`}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${primary ? "text-brand-500" : "text-brand-400"}`} />
        <span className="text-[12px] font-medium text-muted">{label}</span>
      </div>
      <div className={primary ? "metric-value" : "font-mono text-[14px] font-semibold text-heading"}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[11.5px] text-faint">{hint}</div>}
    </div>
  );
}

export default function InferenceDetails({ result }: { result: PuzzleResponse }) {
  const m = result.metadata;
  const [rows, cols] = result.prediction_dimensions;
  const qHalt = m.q_halt_logits.at(-1);
  const qCont = m.q_continue_logits.at(-1);
  const decode = (m.decode_info?.method as string) ?? undefined;

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
      <Metric
        primary
        Icon={IconClock}
        label="Inference Time"
        value={`${(m.elapsed_ms / 1000).toFixed(2)} s`}
        hint={`${Math.round(m.elapsed_ms)} ms`}
      />
      <Metric
        primary
        Icon={IconLayers}
        label="ACT Steps"
        value={`${m.steps} / ${m.max_steps}`}
        hint="fixed in eval mode"
      />
      <Metric
        primary
        Icon={IconCpu}
        label="Device"
        value={m.device.toUpperCase()}
        hint="local inference"
      />
      <Metric
        Icon={IconChip}
        label="Data Type"
        value={m.dtype.replace("torch.", "")}
      />
      <Metric
        Icon={IconCode}
        label="Logits Shape"
        value={m.logits_shape.join(" × ")}
        hint="batch × seq × vocab"
      />
      <Metric
        Icon={IconDatabase}
        label="Puzzle Embedding"
        value={`ID ${m.puzzle_identifier}`}
        hint={m.puzzle_identifier === 0 ? "blank (uploaded task)" : "trained"}
      />
      <Metric
        Icon={IconPulse}
        label="Final Q_Halt"
        value={qHalt !== undefined ? qHalt.toFixed(3) : "—"}
        hint={qCont !== undefined ? `q_continue ${qCont.toFixed(3)}` : undefined}
      />
      <Metric
        Icon={IconFile}
        label="Predicted Tokens"
        value={result.raw_tokens ? String(result.raw_tokens.length) : "—"}
        hint="sequence length"
      />
      <Metric
        Icon={IconGrid}
        label="Dimensions"
        value={`${rows} × ${cols}`}
        hint={decode}
      />
    </div>
  );
}
