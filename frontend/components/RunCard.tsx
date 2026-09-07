"use client";

import { IconArrowRight, IconPlay, IconSpinner } from "./icons";

interface Props {
  onRun: () => void;
  running: boolean;
  hasTask: boolean;
  hrmOnline: boolean;
  testIndex: number;
  testCount: number;
}

export default function RunCard({
  onRun, running, hasTask, hrmOnline, testIndex, testCount,
}: Props) {
  const disabled = !hasTask || !hrmOnline || running;

  const status = running
    ? "Inference is serialized — one task at a time."
    : !hrmOnline
      ? "The model is offline, so inference is unavailable."
      : !hasTask
        ? "Upload an ARC task to enable inference."
        : `Ready to run HRM on test example ${testIndex + 1} of ${testCount}.`;

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">{status}</p>

      <button
        type="button"
        onClick={onRun}
        disabled={disabled}
        className="btn-primary group w-full py-3.5 text-[15px]"
      >
        {running ? (
          <>
            <IconSpinner className="h-[18px] w-[18px] animate-spin" />
            Running HRM…
          </>
        ) : (
          <>
            <IconPlay className="h-[15px] w-[15px]" />
            Run HRM
            <IconArrowRight className="ml-1 h-[17px] w-[17px] transition-transform duration-200 group-hover:translate-x-[3px]" />
          </>
        )}
      </button>
    </div>
  );
}
