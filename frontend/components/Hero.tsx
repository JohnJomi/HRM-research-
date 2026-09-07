import { IconCpu, IconPulse, IconShield } from "./icons";

const FEATURES = [
  { Icon: IconCpu, title: "Local Inference", sub: "Runs on your machine" },
  { Icon: IconShield, title: "Private by design", sub: "Data goes only to your local backend" },
  { Icon: IconPulse, title: "Real-time Pipeline", sub: "See the reasoning process" },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden rounded-card border border-line bg-gradient-to-br from-subtle via-brand-50/50 to-surface px-8 py-9">
      {/* A single soft glow instead of an illustration - depth without decoration. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-40 h-[26rem] w-[26rem] rounded-full bg-brand-300/25 blur-3xl"
      />

      <div className="relative flex flex-wrap items-center justify-between gap-x-16 gap-y-8">
        <div className="min-w-[320px] max-w-[560px] flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.11em] text-brand-500">
            Hierarchical Reasoning Model
          </p>
          <h1 className="mt-3.5 font-display text-[40px] font-bold leading-[1.14] tracking-[-0.01em] text-heading">
            Solve ARC Puzzles with
            <br />
            Hierarchical Reasoning
          </h1>
          <p className="mt-4 max-w-[440px] text-[14.5px] leading-relaxed text-brand-600">
            Upload an ARC task, run inference locally, and explore the reasoning process.
          </p>
        </div>

        <ul className="space-y-3.5 pr-2">
          {FEATURES.map(({ Icon, title, sub }) => (
            <li key={title} className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-brand-900 text-surface shadow-card">
                <Icon className="h-[19px] w-[19px]" />
              </span>
              <span className="leading-tight">
                <span className="block text-[13.5px] font-semibold text-heading">{title}</span>
                <span className="block text-[12px] text-muted">{sub}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
