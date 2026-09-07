"use client";

import type { HealthResponse } from "@/lib/types";

interface Props {
  health: HealthResponse | null;
  error: string | null;
  loading: boolean;
}

/** Model availability is read from /api/health only - never assumed. */
export default function StatusBadge({ health, error, loading }: Props) {
  let dot = "bg-slate-500";
  let title = "CHECKING";
  let tone = "text-slate-400";
  const facts: string[] = [];

  if (loading) {
    dot = "bg-amber-400 animate-pulse";
    title = "CHECKING";
  } else if (error) {
    dot = "bg-red-500";
    title = "BACKEND OFFLINE";
    tone = "text-red-300";
    facts.push(error);
  } else if (health?.hrm === "online") {
    dot = "bg-emerald-400";
    title = "HRM ONLINE";
    tone = "text-emerald-300";
    if (health.detail.device) facts.push(health.detail.device.toUpperCase());
    if (health.detail.dtype) facts.push(health.detail.dtype.replace("torch.", ""));
    if (health.detail.max_steps) facts.push(`${health.detail.max_steps} ACT steps`);
  } else {
    dot = "bg-red-500";
    title = "HRM OFFLINE";
    tone = "text-red-300";
    facts.push(health?.detail?.error ?? "Model did not load.");
  }

  return (
    <div className="flex items-center gap-3 rounded border border-ink-700 bg-ink-850 px-3 py-2">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <div className="leading-tight">
        <div className={`font-mono text-[11px] font-semibold tracking-[0.14em] ${tone}`}>
          {title}
        </div>
        {facts.length > 0 && (
          <div className="max-w-[22rem] truncate font-mono text-[10px] text-slate-500">
            {facts.join("  ·  ")}
          </div>
        )}
      </div>
    </div>
  );
}
