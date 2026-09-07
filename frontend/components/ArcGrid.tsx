"use client";

import { arcColor } from "@/lib/colors";
import type { Grid } from "@/lib/types";

interface Props {
  grid: Grid | null | undefined;
  /** Longest edge in px the grid should occupy. Cells stay square. */
  maxSize?: number;
  label?: string;
  emptyMessage?: string;
  showDimensions?: boolean;
}

/**
 * Reusable ARC grid renderer. Works for any rectangular grid of values 0-9 at
 * any dimensions - nothing about the smoke-test sample is hardcoded.
 */
export default function ArcGrid({
  grid,
  maxSize = 360,
  label,
  emptyMessage = "No grid",
  showDimensions = true,
}: Props) {
  if (!grid || grid.length === 0 || !grid[0]) {
    return (
      <div
        className="flex items-center justify-center rounded border border-dashed border-ink-700 text-xs text-slate-500"
        style={{ width: maxSize, height: maxSize * 0.6 }}
      >
        {emptyMessage}
      </div>
    );
  }

  const rows = grid.length;
  const cols = grid[0].length;
  // Cells stay square; the longer axis is what hits maxSize.
  const cell = Math.max(3, Math.floor(maxSize / Math.max(rows, cols)));

  return (
    <figure className="inline-flex flex-col gap-2">
      {label && (
        <figcaption className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">
          {label}
        </figcaption>
      )}
      <div
        className="grid gap-px rounded-sm bg-ink-700 p-px ring-1 ring-ink-600"
        style={{
          gridTemplateColumns: `repeat(${cols}, ${cell}px)`,
          gridTemplateRows: `repeat(${rows}, ${cell}px)`,
          width: "max-content",
        }}
        role="img"
        aria-label={`${rows} by ${cols} ARC grid`}
      >
        {grid.map((row, r) =>
          row.map((value, c) => (
            <div
              key={`${r}-${c}`}
              style={{ backgroundColor: arcColor(value) }}
              title={`(${r}, ${c}) = ${value}`}
            />
          )),
        )}
      </div>
      {showDimensions && (
        <span className="font-mono text-[11px] text-slate-500">
          {rows} × {cols}
        </span>
      )}
    </figure>
  );
}
