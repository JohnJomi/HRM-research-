"use client";

import {
  IconChart, IconDashboard, IconHelp, IconInfo, IconLibrary,
  IconPlus, IconSettings,
} from "./icons";

const MENU = [
  { label: "Dashboard", Icon: IconDashboard, active: true },
  { label: "New Task", Icon: IconPlus },
  { label: "Task Library", Icon: IconLibrary },
  { label: "Evaluation", Icon: IconChart },
  { label: "Settings", Icon: IconSettings },
];

const GENERAL = [
  { label: "Help", Icon: IconHelp },
  { label: "About", Icon: IconInfo },
];

interface Props {
  onNewTask: () => void;
}

/**
 * Workspace navigation. Only Dashboard is a real destination in this build -
 * the rest are structural, so they are rendered as disabled controls with an
 * honest tooltip rather than links that appear to work and don't.
 */
export default function Sidebar({ onNewTask }: Props) {
  return (
    <aside className="hidden w-[236px] shrink-0 flex-col border-r border-line bg-shell lg:flex">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-brand-600 to-brand-900 text-[11px] font-bold tracking-tight text-white shadow-card">
          HRM
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight text-heading">HRM Lab</div>
          <div className="text-[12px] text-muted">Local Reasoning</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Workspace">
        <p className="px-2 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
          Menu
        </p>
        <ul className="space-y-0.5">
          {MENU.map(({ label, Icon, active }) => (
            <li key={label}>
              {active ? (
                <span
                  aria-current="page"
                  className="relative flex items-center gap-3 rounded-panel bg-brand-50 px-3 py-2.5 text-[14px] font-semibold text-brand-800"
                >
                  <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-500" />
                  <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-brand-500/15 text-brand-700">
                    <Icon className="h-[17px] w-[17px]" />
                  </span>
                  {label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={label === "New Task" ? onNewTask : undefined}
                  disabled={label !== "New Task"}
                  title={label === "New Task" ? "Clear the workspace" : "Not available in this build"}
                  className="group flex w-full items-center gap-3 rounded-panel px-3 py-2.5 text-[14px] font-medium text-body transition-colors duration-200 hover:bg-subtle disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-transparent"
                >
                  <span className="flex h-7 w-7 items-center justify-center text-muted transition-transform duration-200 group-hover:scale-105 group-hover:text-brand-600 group-disabled:group-hover:scale-100 group-disabled:text-faint">
                    <Icon className="h-[17px] w-[17px]" />
                  </span>
                  {label}
                </button>
              )}
            </li>
          ))}
        </ul>

        <p className="px-2 pb-2 pt-6 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
          General
        </p>
        <ul className="space-y-0.5">
          {GENERAL.map(({ label, Icon }) => (
            <li key={label}>
              <button
                type="button"
                disabled
                title="Not available in this build"
                className="flex w-full cursor-not-allowed items-center gap-3 rounded-panel px-3 py-2.5 text-[14px] font-medium text-faint"
              >
                <span className="flex h-7 w-7 items-center justify-center">
                  <Icon className="h-[17px] w-[17px]" />
                </span>
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-3">
        <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-brand-800 via-brand-900 to-brand-950 p-4 text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-brand-400/25 blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-14 -left-8 h-28 w-28 rounded-full bg-brand-300/15 blur-2xl"
          />
          <h3 className="relative text-[15px] font-semibold leading-snug">
            Powerful Reasoning Locally
          </h3>
          <p className="relative mt-1.5 text-[12px] leading-relaxed text-brand-100/80">
            Inference runs on this machine. Puzzle data is sent only to your local backend.
          </p>
        </div>
      </div>
    </aside>
  );
}
