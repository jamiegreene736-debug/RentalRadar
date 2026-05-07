"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, ChevronDown, Code2 } from "lucide-react";

import { agentEvents } from "@/app/(dashboard)/components/dashboard-data";
import { cn } from "@/lib/utils";

export function AgentLogTimeline() {
  const [open, setOpen] = useState<string>(agentEvents[0].title);

  return (
    <div className="space-y-4">
      {agentEvents.map((event, index) => {
        const expanded = open === event.title;
        return (
          <motion.div
            key={event.title}
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08 }}
            className="relative rounded-[28px] border border-white/[0.12] bg-white/[0.045] p-5"
          >
            <div className="absolute -left-2 top-7 grid size-4 place-items-center rounded-full bg-cyan-300 shadow-[0_0_26px_rgba(34,211,238,0.75)]" />
            <button type="button" onClick={() => setOpen(expanded ? "" : event.title)} className="flex w-full items-start justify-between gap-4 text-left">
              <div className="flex gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-100">
                  <Bot className="size-6" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{event.time}</p>
                  <h3 className="mt-1 text-xl font-semibold text-white">{event.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{event.detail}</p>
                </div>
              </div>
              <ChevronDown className={cn("mt-2 size-5 shrink-0 text-slate-500 transition", expanded && "rotate-180 text-cyan-200")} />
            </button>
            {expanded ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-5 overflow-hidden rounded-2xl border border-cyan-200/20 bg-black/[0.36] p-4"
              >
                <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-cyan-200">
                  <Code2 className="size-4" />
                  Playwright patch
                </div>
                <pre className="overflow-x-auto text-sm leading-7 text-cyan-50">
                  <code>{event.code}</code>
                </pre>
              </motion.div>
            ) : null}
          </motion.div>
        );
      })}
    </div>
  );
}
