"use client";

import { useEffect } from "react";
import ArcGrid from "./ArcGrid";
import { IconClose } from "./icons";
import type { Grid } from "@/lib/types";

interface Props {
  grid: Grid;
  title: string;
  onClose: () => void;
}

export default function GridModal({ grid, title, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-heading/40 p-6 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-full overflow-auto rounded-card border border-line bg-surface p-6 shadow-modal"
      >
        <div className="mb-4 flex items-center justify-between gap-8">
          <h3 className="text-[15px] font-semibold text-heading">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted transition-colors duration-200 hover:bg-subtle hover:text-heading"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
        <ArcGrid grid={grid} maxSize={620} interactive={false} />
      </div>
    </div>
  );
}
