"use client";

import { useState } from "react";
import { arcColor } from "@/lib/colors";
import { IconExpand } from "./icons";
import type { Grid } from "@/lib/types";

interface Props {
  grid: Grid | null | undefined;
  /** Longest edge in px. Cells stay square at any dimensions. */
  maxSize?: number;
  label?: string;
  emptyMessage?: string;
  showDimensions?: boolean;
  /** Hover lift + optional expand affordance. */
  interactive?: boolean;
  onExpand?: () => void;
  className?: string;
}

/**
 * Reusable ARC grid renderer - any rectangular grid, values 0-9, centralized
 * palette. Hover uses transform + shadow only, so surrounding layout never
 * shifts. Nothing about any particular task's dimensions is hardcoded.
 */
export default function ArcGrid({
  grid,
  maxSize = 320,
  label,
  emptyMessage = "No grid",
  showDimensions = true,
  interactive = false,
  onExpand,
  className = "",
}: Props) {
  const [hovered, setHovered] = useState(false);

  if (!grid || grid.length === 0 || !grid[0]) {
    return (
      <div
        className="flex items-center justify-center rounded-panel border border-dashed border-line-strong bg-subtle px-6 text-[13px] text-faint"
        style={{ width: maxSize, height: Math.round(maxSize * 0.62) }}
      >
        {emptyMessage}
      </div>
    );
  }

  const rows = grid.length;
  const cols = grid[0].length;
  const cell = Math.max(3, Math.floor(maxSize / Math.max(rows, cols)));

  return (
    <figure className={`inline-flex flex-col gap-2 ${className}`}>
      {label && (
        <figcaption className="text-[13px] font-semibold text-heading">{label}</figcaption>
      )}

      <div
        className="relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ width: "max-content" }}
      >
        <div
          className={`rounded-panel border border-line-strong bg-[#1a1f26] p-1.5 ${
            interactive
              ? "transition-[transform,box-shadow] duration-200 ease-out hover:scale-[1.015] hover:shadow-lift"
              : ""
          }`}
        >
          <div
            className="grid gap-px bg-[#31383f]"
            style={{
              gridTemplateColumns: `repeat(${cols}, ${cell}px)`,
              gridTemplateRows: `repeat(${rows}, ${cell}px)`,
            }}
            role="img"
            aria-label={`ARC grid, ${rows} rows by ${cols} columns`}
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
        </div>

        {interactive && onExpand && (
          <button
            type="button"
            onClick={onExpand}
            aria-label={`Expand ${label ?? "grid"}`}
            className={`absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-muted shadow-card transition-[opacity,transform,color] duration-200 hover:text-brand-600 focus-visible:opacity-100 ${
              hovered ? "opacity-100" : "opacity-0"
            }`}
          >
            <IconExpand className="h-[15px] w-[15px]" />
          </button>
        )}
      </div>

      {showDimensions && (
        <span className="font-mono text-[12px] text-muted">
          {rows} × {cols}
        </span>
      )}
    </figure>
  );
}
