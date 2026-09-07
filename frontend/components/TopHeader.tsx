"use client";

import { IconActivity, IconBell, IconSearch } from "./icons";
import type { HealthResponse } from "@/lib/types";

interface Props {
  health: HealthResponse | null;
  error: string | null;
  loading: boolean;
  onRefresh: () => void;
}

function ModelStatus({ health, error, loading, onRefresh }: Props) {
  const online = health?.hrm === "online";

  let dot = "bg-faint";
  let title = "Checking…";
  let sub = "contacting backend";
  let tone = "border-line bg-subtle text-muted";

  if (loading) {
    dot = "bg-warn-600 animate-pulse";
  } else if (error) {
    dot = "bg-danger-500";
    title = "Backend Offline";
    sub = "start the local backend";
    tone = "border-danger-200 bg-danger-50 text-danger-700";
  } else if (online) {
    dot = "bg-brand-500";
    title = "HRM Online";
    sub = [health?.detail.device?.toUpperCase(), health?.detail.dtype?.replace("torch.", "")]
      .filter(Boolean)
      .join(" · ");
    tone = "border-brand-200 bg-brand-50 text-brand-800";
  } else if (health) {
    dot = "bg-danger-500";
    title = "HRM Offline";
    sub = "model did not load";
    tone = "border-danger-200 bg-danger-50 text-danger-700";
  }

  return (
    <button
      type="button"
      onClick={onRefresh}
      title="Re-check backend health"
      className={`flex items-center gap-2.5 rounded-pill border px-3.5 py-2 transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-card ${tone}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span className="text-left leading-tight">
        <span className="block text-[13px] font-semibold">{title}</span>
        <span className="block font-mono text-[11px] opacity-70">{sub}</span>
      </span>
      <IconActivity className="ml-1 h-4 w-4 opacity-60" />
    </button>
  );
}

export default function TopHeader(props: Props) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-line bg-shell px-5 py-3.5">
      <div className="relative min-w-[220px] flex-1">
        <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-faint" />
        <input
          type="search"
          disabled
          aria-label="Search (not available in this build)"
          title="Search is not wired up in this build"
          placeholder="Search tasks, examples, or documentation…"
          className="h-11 w-full cursor-not-allowed rounded-pill border border-line bg-subtle pl-11 pr-16 text-[14px] text-body placeholder:text-faint"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-line bg-surface px-2 py-1 font-mono text-[11px] text-muted">
          ⌘ K
        </kbd>
      </div>

      <div className="flex items-center gap-3">
        <ModelStatus {...props} />

        <button
          type="button"
          disabled
          aria-label="Notifications (none in this build)"
          title="No notifications in this build"
          className="flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-full border border-line bg-surface text-faint"
        >
          <IconBell className="h-[18px] w-[18px]" />
        </button>

        <div className="flex items-center gap-2.5 rounded-pill border border-line bg-surface py-1.5 pl-1.5 pr-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-[12px] font-semibold text-brand-800">
            LU
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-[13px] font-semibold text-heading">Local User</span>
            <span className="block text-[11px] text-muted">This machine</span>
          </span>
        </div>
      </div>
    </header>
  );
}
