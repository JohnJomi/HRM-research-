"use client";

import { useState } from "react";
import ArcGrid from "./ArcGrid";
import GridModal from "./GridModal";
import { IconArrowRight, IconCheckCircle, IconEye } from "./icons";
import type { Grid, PuzzleResponse } from "@/lib/types";

interface Props {
  result: PuzzleResponse;
  groundTruth?: Grid | null;
}

function gridsEqual(a: Grid, b: Grid): boolean {
  return (
    a.length === b.length &&
    a.every((row, i) => row.length === b[i].length && row.every((v, j) => v === b[i][j]))
  );
}

/**
 * Prediction-first. Ground truth is deliberately secondary and hidden behind a
 * disclosure, so the prediction is read before the answer.
 */
export default function ResultPanel({ result, groundTruth }: Props) {
  const [showTruth, setShowTruth] = useState(false);
  const [zoom, setZoom] = useState<{ grid: Grid; title: string } | null>(null);

  // Only computed when the task actually carries an answer - never invented.
  const match = groundTruth ? gridsEqual(result.prediction_grid, groundTruth) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-center gap-6 sm:justify-start">
        <ArcGrid
          grid={result.input_grid}
          maxSize={250}
          label="Input"
          interactive
          onExpand={() => setZoom({ grid: result.input_grid, title: "Input grid" })}
        />

        <div className="flex h-[250px] items-center px-1">
          <IconArrowRight className="h-6 w-6 text-line-strong" />
        </div>

        <div className="rounded-card border border-brand-200 bg-brand-50/40 p-3">
          <ArcGrid
            grid={result.prediction_grid}
            maxSize={250}
            label="HRM Prediction"
            interactive
            onExpand={() =>
              setZoom({ grid: result.prediction_grid, title: "HRM prediction" })
            }
          />
        </div>
      </div>

      {groundTruth && (
        <div className="border-t border-line pt-4">
          <button
            type="button"
            onClick={() => setShowTruth((v) => !v)}
            aria-expanded={showTruth}
            className="btn-quiet"
          >
            <IconEye className="h-4 w-4" />
            {showTruth ? "Hide ground truth" : "View ground truth"}
          </button>

          {showTruth && (
            <div className="mt-4 flex flex-wrap items-start gap-5 animate-fade-up">
              <ArcGrid
                grid={groundTruth}
                maxSize={190}
                label="Ground truth"
                interactive
                onExpand={() => setZoom({ grid: groundTruth, title: "Ground truth" })}
              />
              {match !== null && (
                <p className="max-w-xs pt-6 text-[12.5px] leading-relaxed text-muted">
                  {match
                    ? "The prediction matches this task's answer cell for cell."
                    : "The prediction differs from this task's answer."}{" "}
                  This is a single task and says nothing about general ARC accuracy.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {zoom && <GridModal grid={zoom.grid} title={zoom.title} onClose={() => setZoom(null)} />}
    </div>
  );
}

/** Rendered in the Result card header - only when a ground truth existed. */
export function MatchBadge({ result, groundTruth }: Props) {
  if (!groundTruth) return null;
  const match = gridsEqual(result.prediction_grid, groundTruth);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[12px] font-semibold ${
        match
          ? "border-brand-200 bg-brand-50 text-brand-800"
          : "border-warn-200 bg-warn-50 text-warn-600"
      }`}
    >
      <IconCheckCircle className="h-4 w-4" />
      {match ? "Exact Match" : "No Match"}
    </span>
  );
}
