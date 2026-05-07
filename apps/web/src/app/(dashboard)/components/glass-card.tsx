import { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function GlassCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-cyan-900/10 bg-white/78 shadow-[0_24px_90px_rgba(14,116,144,0.13)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-cyan-700/20 hover:shadow-[0_28px_100px_rgba(34,211,238,0.16)]",
        className,
      )}
      {...props}
    />
  );
}

export function PanelTitle({ eyebrow, title, copy }: { eyebrow?: string; title: string; copy?: string }) {
  return (
    <div>
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">{eyebrow}</p> : null}
      <h2 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">{title}</h2>
      {copy ? <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p> : null}
    </div>
  );
}
