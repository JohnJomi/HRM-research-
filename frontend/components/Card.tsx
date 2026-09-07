import type { ComponentType, ReactNode, SVGProps } from "react";

interface Props {
  step?: string;
  title: string;
  Icon?: ComponentType<SVGProps<SVGSVGElement>>;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** Consistent workspace card: numbered step, icon tile, optional right-hand slot. */
export default function Card({
  step, title, Icon, aside, children, className = "", bodyClassName = "",
}: Props) {
  return (
    <section className={`card flex flex-col ${className}`}>
      <header className="flex items-center gap-3 px-5 pb-4 pt-5">
        {Icon && (
          <span className="icon-tile">
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
        <h2 className="flex items-baseline gap-2">
          {step && <span className="font-mono text-[13px] text-faint">{step}</span>}
          <span className="card-title">{title}</span>
        </h2>
        {aside && <div className="ml-auto flex items-center gap-2">{aside}</div>}
      </header>
      <div className={`flex-1 px-5 pb-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
