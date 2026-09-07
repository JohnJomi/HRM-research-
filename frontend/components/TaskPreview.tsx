"use client";

import ArcGrid from "./ArcGrid";
import type { ARCTask } from "@/lib/types";

interface Props {
  task: ARCTask;
  testIndex: number;
  onSelectTest: (index: number) => void;
  disabled?: boolean;
}

export default function TaskPreview({ task, testIndex, onSelectTest, disabled }: Props) {
  const selected = task.test[testIndex];

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">
            Demonstrations
          </h3>
          <span className="font-mono text-[10px] text-slate-600">
            {task.train.length} pair{task.train.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex flex-wrap gap-4 overflow-x-auto">
          {task.train.map((ex, i) => (
            <div key={i} className="flex items-center gap-2">
              <ArcGrid grid={ex.input} maxSize={82} showDimensions={false} />
              <span className="text-slate-600">→</span>
              <ArcGrid grid={ex.output ?? null} maxSize={82} showDimensions={false} />
            </div>
          ))}
          {task.train.length === 0 && (
            <span className="text-xs text-slate-600">No demonstration pairs in this task.</span>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">
            Test input
          </h3>
          {task.test.length > 1 && (
            <div className="flex items-center gap-1">
              {task.test.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectTest(i)}
                  className={`h-6 w-6 rounded border font-mono text-[10px] transition-colors ${
                    i === testIndex
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-ink-700 bg-ink-850 text-slate-500 hover:border-ink-500"
                  } disabled:opacity-40`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
        <ArcGrid grid={selected?.input} maxSize={210} />
      </div>
    </div>
  );
}
