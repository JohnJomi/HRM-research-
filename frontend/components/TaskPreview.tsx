"use client";

import { useState } from "react";
import ArcGrid from "./ArcGrid";
import GridModal from "./GridModal";
import type { ARCTask, Grid } from "@/lib/types";

interface Props {
  task: ARCTask;
  testIndex: number;
  onSelectTest: (index: number) => void;
  disabled?: boolean;
}

export default function TaskPreview({ task, testIndex, onSelectTest, disabled }: Props) {
  const [zoom, setZoom] = useState<{ grid: Grid; title: string } | null>(null);
  const selected = task.test[testIndex];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="rounded-panel border border-line bg-subtle p-4">
        <h3 className="mb-3 text-[13px] font-semibold text-heading">
          Training Examples{" "}
          <span className="font-normal text-muted">({task.train.length})</span>
        </h3>

        {task.train.length === 0 ? (
          <p className="text-[13px] text-muted">This task has no demonstration pairs.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {task.train.map((ex, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setZoom({ grid: ex.input, title: `Training example ${i + 1} — input` })}
                title={`View training example ${i + 1}`}
                className="rounded-panel transition-[transform,box-shadow] duration-200 ease-out hover:z-10 hover:scale-[1.05] hover:shadow-lift"
              >
                <div className="flex items-center gap-1.5">
                  <ArcGrid grid={ex.input} maxSize={72} showDimensions={false} />
                  <span aria-hidden className="text-[11px] text-faint">→</span>
                  <ArcGrid grid={ex.output ?? null} maxSize={72} showDimensions={false} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-panel border border-line bg-subtle p-4">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h3 className="text-[13px] font-semibold text-heading">Test Input</h3>
          {task.test.length > 1 && (
            <div className="flex items-center gap-1" role="group" aria-label="Select test example">
              {task.test.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  aria-pressed={i === testIndex}
                  onClick={() => onSelectTest(i)}
                  className={`h-7 w-7 rounded-md border text-[12px] font-medium transition-colors duration-200 ${
                    i === testIndex
                      ? "border-brand-400 bg-brand-100 text-brand-800"
                      : "border-line bg-surface text-muted hover:border-line-strong hover:bg-subtle"
                  } disabled:opacity-50`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>

        <ArcGrid
          grid={selected?.input}
          maxSize={190}
          interactive
          onExpand={() =>
            selected && setZoom({ grid: selected.input, title: `Test input ${testIndex + 1}` })
          }
        />
      </div>

      {zoom && <GridModal grid={zoom.grid} title={zoom.title} onClose={() => setZoom(null)} />}
    </div>
  );
}
