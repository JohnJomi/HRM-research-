"use client";

import { useCallback, useRef, useState } from "react";
import { parseArcTask } from "@/lib/validate";
import type { ARCTask } from "@/lib/types";

interface Props {
  onTask: (task: ARCTask, name: string) => void;
  onError: (message: string) => void;
  fileName: string | null;
  disabled?: boolean;
}

export default function UploadPanel({ onTask, onError, fileName, disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = useCallback(
    (raw: string, name: string) => {
      const { task, error } = parseArcTask(raw);
      if (error || !task) {
        onError(error ?? "Could not read that ARC task.");
        return;
      }
      onTask(task, name);
    },
    [onTask, onError],
  );

  const readFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => accept(String(reader.result), file.name);
      reader.onerror = () => onError(`Could not read ${file.name}.`);
      reader.readAsText(file);
    },
    [accept, onError],
  );

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (disabled) return;
          const file = e.dataTransfer.files?.[0];
          if (file) readFile(file);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border border-dashed px-5 py-7 text-center transition-colors ${
          dragging
            ? "border-accent bg-accent/5"
            : "border-ink-600 bg-ink-850 hover:border-ink-500"
        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">
          Drop ARC task
        </div>
        <div className="mt-1.5 text-xs text-slate-500">
          drag a <span className="font-mono text-slate-400">.json</span> file here, or click to browse
        </div>
        {fileName && (
          <div className="mt-3 inline-block rounded border border-ink-600 bg-ink-800 px-2 py-1 font-mono text-[11px] text-emerald-300">
            {fileName}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readFile(file);
            e.target.value = "";
          }}
        />
      </div>

      <button
        type="button"
        onClick={() => setPasteOpen((v) => !v)}
        disabled={disabled}
        className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500 hover:text-slate-300 disabled:opacity-40"
      >
        {pasteOpen ? "− hide paste" : "+ paste JSON instead"}
      </button>

      {pasteOpen && (
        <div className="space-y-2">
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder='{"train": [...], "test": [...]}'
            spellCheck={false}
            className="h-28 w-full resize-y rounded border border-ink-700 bg-ink-950 p-2 font-mono text-[11px] text-slate-300 outline-none focus:border-accent-dim"
          />
          <button
            type="button"
            disabled={disabled || pasted.trim().length === 0}
            onClick={() => accept(pasted, "pasted-task.json")}
            className="rounded border border-ink-600 bg-ink-800 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-slate-300 hover:border-ink-500 disabled:opacity-40"
          >
            Load pasted task
          </button>
        </div>
      )}
    </div>
  );
}
