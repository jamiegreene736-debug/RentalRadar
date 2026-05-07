"use client";

import { motion } from "framer-motion";
import { Bot, Code2, Cpu, Play } from "lucide-react";

const events = [
  "Site Analyzer inspecting Airbnb calendar",
  "Playwright Trainer generating locator patch",
  "Executor running headed Chrome validation",
  "Self-Healing Agent approving strategy v12",
];

export function AiAgentsWidget() {
  return (
    <div className="rounded-[28px] border border-cyan-200/[0.14] bg-cyan-300/[0.06] p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">AI Agents at Work</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Live training stream</h3>
        </div>
        <div className="grid size-12 place-items-center rounded-2xl bg-cyan-300 text-slate-950">
          <Bot className="size-6" />
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {events.map((event, index) => (
          <motion.div
            key={event}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/[0.24] px-4 py-3"
            animate={{ opacity: [0.48, 1, 0.48], x: [0, 6, 0] }}
            transition={{ duration: 3, delay: index * 0.4, repeat: Infinity }}
          >
            <span className="grid size-8 place-items-center rounded-full bg-white/[0.06] text-cyan-100">
              {index % 2 === 0 ? <Cpu className="size-4" /> : <Code2 className="size-4" />}
            </span>
            <span className="text-sm text-slate-300">{event}</span>
          </motion.div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-2 text-xs text-slate-400">
        <Play className="size-3.5 text-emerald-200" />
        Placeholder-ready for SSE or WebSocket event stream.
      </div>
    </div>
  );
}
