import { IconCpu, IconPulse, IconShield } from "./icons";

const FEATURES = [
  { Icon: IconCpu, title: "Local Inference", sub: "Runs on your machine" },
  { Icon: IconShield, title: "Private by design", sub: "Data goes only to your local backend" },
  { Icon: IconPulse, title: "Real-time Pipeline", sub: "See the reasoning process" },
];

/** Layered translucent plates standing in for hierarchical reasoning. */
function LayeredVisual() {
  return (
    <div aria-hidden className="relative h-[168px] w-[210px] shrink-0">
      <div className="absolute inset-0 rounded-full bg-brand-300/25 blur-3xl" />
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="absolute left-1/2 h-[86px] w-[150px] -translate-x-1/2 rounded-[14px] border border-white/60 animate-float"
          style={{
            top: 18 + i * 26,
            transform: "translateX(-50%) rotateX(58deg) rotateZ(45deg)",
            background: `linear-gradient(135deg, rgba(255,255,255,${0.55 - i * 0.08}), rgba(66,185,124,${0.22 + i * 0.12}))`,
            boxShadow: "0 8px 20px -10px rgba(10,59,37,0.45)",
            animationDelay: `${i * 0.5}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function Hero() {
  return (
    <section className="relative overflow-hidden rounded-card border border-brand-100 bg-gradient-to-br from-brand-50 via-brand-50/60 to-surface px-7 py-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-200/30 blur-3xl"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-8">
        <div className="min-w-[300px] max-w-[520px] flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-brand-600">
            Hierarchical Reasoning Model
          </p>
          <h1 className="mt-3 text-[34px] font-bold leading-[1.12] tracking-tight text-heading">
            Solve ARC Puzzles with
            <br />
            Hierarchical Reasoning
          </h1>
          <p className="mt-3 max-w-[440px] text-[14px] leading-relaxed text-muted">
            Upload an ARC task, run inference locally, and explore the reasoning process.
          </p>
        </div>

        <div className="flex items-center gap-8">
          <LayeredVisual />
          <ul className="space-y-3">
            {FEATURES.map(({ Icon, title, sub }) => (
              <li key={title} className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-gradient-to-br from-brand-700 to-brand-900 text-white shadow-card">
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
      </div>
    </section>
  );
}
