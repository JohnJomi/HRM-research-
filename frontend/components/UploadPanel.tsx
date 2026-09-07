"use client";

import { useCallback, useRef, useState } from "react";
import { parseArcTask } from "@/lib/validate";
import { IconChevronDown, IconFile, IconUpload } from "./icons";
import type { ARCTask } from "@/lib/types";

interface Props {
  onTask: (task: ARCTask, name: string) => void;
  onError: (message: string) => void;
  fileName: string | null;
  disabled?: boolean;
}

/** Upload logic is unchanged: drag/drop, browse, paste, same client-side
 *  pre-check. The backend remains authoritative for validation. */
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
        className={`group rounded-card border-2 border-dashed px-6 py-8 text-center transition-[background-color,border-color,transform,box-shadow] duration-200 ease-out ${
          dragging
            ? "border-brand-500 bg-brand-50 shadow-ring"
            : "border-line-strong bg-subtle hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50/50 hover:shadow-card"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <span
          className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-200 ease-out group-hover:scale-105 ${
            dragging ? "bg-brand-500 text-white" : "bg-surface text-muted shadow-card"
          }`}
        >
          <IconUpload className="h-6 w-6" />
        </span>

        <p className="text-[15px] font-semibold text-heading">
          {dragging ? "Release to load task" : "Drop your ARC task JSON here"}
        </p>
        <p className="mt-1 text-[13px] text-muted">or click to browse</p>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="btn-primary mt-4"
        >
          <IconFile className="h-4 w-4" />
          Choose File
        </button>

        <p className="mt-3 text-[12px] text-faint">Supports ARC-AGI JSON format</p>

        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Choose an ARC task JSON file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {fileName && (
        <div className="flex items-center gap-2.5 rounded-panel border border-brand-200 bg-brand-50 px-3 py-2.5 animate-fade-in">
          <IconFile className="h-4 w-4 shrink-0 text-brand-600" />
          <span className="truncate font-mono text-[12.5px] text-brand-800">{fileName}</span>
        </div>
      )}

      <div className="rounded-panel border border-line">
        <button
          type="button"
          onClick={() => setPasteOpen((v) => !v)}
          disabled={disabled}
          aria-expanded={pasteOpen}
          className="flex w-full items-center justify-between px-3.5 py-2.5 text-[13px] font-medium text-body transition-colors duration-200 hover:bg-subtle disabled:opacity-50"
        >
          Or paste JSON instead
          <IconChevronDown
            className={`h-4 w-4 text-muted transition-transform duration-200 ${pasteOpen ? "rotate-180" : ""}`}
          />
        </button>

        {pasteOpen && (
          <div className="space-y-2 border-t border-line p-3 animate-fade-in">
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder='{"train": [...], "test": [...]}'
              spellCheck={false}
              aria-label="Paste ARC task JSON"
              className="h-24 w-full resize-y rounded-panel border border-line bg-subtle p-2.5 font-mono text-[12px] text-body outline-none transition-colors duration-200 focus:border-brand-400"
            />
            <button
              type="button"
              disabled={disabled || pasted.trim().length === 0}
              onClick={() => accept(pasted, "pasted-task.json")}
              className="btn-quiet disabled:cursor-not-allowed disabled:opacity-50"
            >
              Load pasted task
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
