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

/**
 * Dark forest sidebar - the visual anchor of the workspace.
 * Only Dashboard is a real destination in this build; the rest are structural
 * and render as disabled controls with an honest tooltip.
 */
export default function Sidebar({ onNewTask }: { onNewTask: () => void }) {
  return (
    <aside className="hidden w-[236px] shrink-0 flex-col bg-brand-900 lg:flex">
      <div className="flex items-center gap-3 px-5 py-5">
        {/* Light tile keeps the mark legible against the dark surface. */}
        <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-canvas text-[11px] font-bold tracking-tight text-brand-900">
          HRM
        </div>
        <div className="leading-tight">
          <div className="font-display text-[17px] font-bold leading-none tracking-tight text-surface">
            HRM Lab
          </div>
          <div className="mt-1 text-[12px] text-brand-300">Local Reasoning</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Workspace">
        <p className="px-2 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-300">
          Menu
        </p>
        <ul className="space-y-0.5">
          {MENU.map(({ label, Icon, active }) => (
            <li key={label}>
              {active ? (
                <span
                  aria-current="page"
                  className="relative flex items-center gap-3 overflow-hidden rounded-panel bg-brand-500 px-3 py-2.5 text-[14px] font-semibold text-surface"
                >
                  <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-300" />
                  <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-surface/15 text-surface">
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
                  className="group flex w-full items-center gap-3 rounded-panel px-3 py-2.5 text-[14px] font-medium text-brand-100 transition-colors duration-200 hover:bg-brand-800 disabled:cursor-not-allowed disabled:text-brand-400 disabled:hover:bg-transparent"
                >
                  <span className="flex h-7 w-7 items-center justify-center text-brand-300 transition-transform duration-200 group-hover:scale-105 group-hover:text-surface group-disabled:text-brand-400 group-disabled:group-hover:scale-100">
                    <Icon className="h-[17px] w-[17px]" />
                  </span>
                  {label}
                </button>
              )}
            </li>
          ))}
        </ul>

        <p className="px-2 pb-2 pt-6 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-300">
          General
        </p>
        <ul className="space-y-0.5">
          {GENERAL.map(({ label, Icon }) => (
            <li key={label}>
              <button
                type="button"
                disabled
                title="Not available in this build"
                className="flex w-full cursor-not-allowed items-center gap-3 rounded-panel px-3 py-2.5 text-[14px] font-medium text-brand-400"
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
        {/* Slightly lighter than the sidebar so it reads as a raised surface. */}
        <div className="relative overflow-hidden rounded-card bg-brand-500 p-4">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-brand-300/20 blur-2xl"
          />
          <h3 className="relative text-[15px] font-semibold leading-snug text-surface">
            Powerful Reasoning Locally
          </h3>
          <p className="relative mt-1.5 text-[12px] leading-relaxed text-brand-100">
            Inference runs on this machine. Puzzle data is sent only to your local backend.
          </p>
        </div>
      </div>
    </aside>
  );
}
