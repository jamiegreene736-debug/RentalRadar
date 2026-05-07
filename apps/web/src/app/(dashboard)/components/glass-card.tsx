import { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function GlassCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-white/[0.12] bg-white/[0.045] shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-cyan-200/[0.24] hover:shadow-[0_28px_100px_rgba(34,211,238,0.12)]",
        className,
      )}
      {...props}
    />
  );
}

export function PanelTitle({ eyebrow, title, copy }: { eyebrow?: string; title: string; copy?: string }) {
  return (
    <div>
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">{eyebrow}</p> : null}
      <h2 className="mt-2 text-2xl font-semibold tracking-normal text-white">{title}</h2>
      {copy ? <p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p> : null}
    </div>
  );
}
