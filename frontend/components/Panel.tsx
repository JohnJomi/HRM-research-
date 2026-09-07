import type { ReactNode } from "react";

interface Props {
  title: string;
  step?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function Panel({ title, step, aside, children, className = "" }: Props) {
  return (
    <section
      className={`rounded-lg border border-ink-700 bg-ink-900/70 p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset] ${className}`}
    >
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="flex items-baseline gap-2.5">
          {step && (
            <span className="font-mono text-[10px] text-slate-600">{step}</span>
          )}
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-300">
            {title}
          </span>
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}
