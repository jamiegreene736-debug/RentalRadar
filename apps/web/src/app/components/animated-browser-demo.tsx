"use client";

import { motion } from "framer-motion";
import { Bot, Chrome, Compass, House, MousePointer2, Radar } from "lucide-react";

const agents = [
  {
    channel: "VRBO",
    property: "Oceanfront villa",
    action: "calendar open",
    price: "$318",
    accent: "text-emerald-700",
    dot: "bg-emerald-300",
    cursor: { x: [0, 74, 110, 38, 88], y: [0, 14, 82, 112, 42] },
  },
  {
    channel: "Airbnb",
    property: "Downtown loft",
    action: "guest rate",
    price: "$286",
    accent: "text-rose-600",
    dot: "bg-rose-300",
    cursor: { x: [0, 82, 42, 116, 70], y: [0, 52, 94, 102, 22] },
  },
  {
    channel: "Booking.com",
    property: "Resort suite",
    action: "availability",
    price: "$301",
    accent: "text-blue-700",
    dot: "bg-blue-300",
    cursor: { x: [0, 96, 120, 48, 82], y: [0, 28, 92, 104, 58] },
  },
  {
    channel: "PM Website",
    property: "Direct booking",
    action: "checkout page",
    price: "$274",
    accent: "text-amber-700",
    dot: "bg-amber-300",
    cursor: { x: [0, 58, 118, 86, 28], y: [0, 86, 64, 18, 108] },
  },
];

export function AnimatedBrowserDemo() {
  return (
    <div className="relative mx-auto w-full max-w-xl self-start lg:-mt-8 xl:-mt-12 2xl:max-w-2xl">
      <motion.div
        className="absolute -left-6 top-12 hidden rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-100 shadow-[0_0_50px_rgba(34,211,238,0.18)] md:block"
        animate={{ y: [0, -16, 0], rotate: [-2, 2, -2] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <Bot className="size-6" />
      </motion.div>
      <motion.div
        className="absolute bottom-20 right-2 hidden rounded-2xl border border-teal-300/20 bg-teal-300/10 p-3 text-teal-100 shadow-[0_0_50px_rgba(45,212,191,0.16)] md:block"
        animate={{ y: [0, 14, 0], rotate: [2, -2, 2] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <MousePointer2 className="size-6" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative aspect-square overflow-hidden rounded-[28px] border border-cyan-900/10 bg-white/90 shadow-[0_34px_110px_rgba(14,116,144,0.16),0_0_70px_rgba(34,211,238,0.12)]"
      >
        <div className="flex items-center justify-between border-b border-cyan-900/10 bg-white/70 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex gap-2">
            <span className="size-3 rounded-full bg-red-400" />
            <span className="size-3 rounded-full bg-amber-300" />
            <span className="size-3 rounded-full bg-emerald-300" />
          </div>
          <div className="flex items-center gap-2 rounded-full border border-cyan-900/10 bg-cyan-50 px-4 py-2 text-xs text-slate-600">
            <Chrome className="size-4 text-cyan-700" />
            Live market check
          </div>
          <Compass className="size-5 text-slate-500" />
        </div>

        <div className="grid h-[calc(100%-56px)] grid-cols-2 gap-3 p-3 sm:h-[calc(100%-65px)] sm:gap-4 sm:p-4">
          {agents.map((agent, index) => (
            <motion.div
              key={agent.channel}
              className="relative overflow-hidden rounded-2xl border border-cyan-900/10 bg-slate-50 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]"
              animate={{ y: [0, index % 2 === 0 ? -3 : 3, 0] }}
              transition={{ duration: 4.5, delay: index * 0.22, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`size-2.5 shrink-0 rounded-full ${agent.dot}`} />
                  <span className="truncate text-xs font-semibold text-slate-950 sm:text-sm">{agent.channel}</span>
                </div>
                <span className="rounded-full bg-cyan-100 px-2 py-1 text-[10px] font-medium text-cyan-800">AI agent</span>
              </div>

              <div className="relative min-h-[68%] rounded-xl border border-slate-950/10 bg-white p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <House className="size-4 shrink-0 text-cyan-700" />
                    <span className="truncate text-[11px] font-semibold text-slate-700 sm:text-xs">{agent.property}</span>
                  </div>
                  <span className={`text-xs font-semibold sm:text-sm ${agent.accent}`}>{agent.price}</span>
                </div>
                <div className="space-y-2">
                  <div className="h-2 rounded-full bg-slate-200" />
                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-10 rounded-lg bg-cyan-50" />
                    <div className="h-10 rounded-lg bg-slate-100" />
                    <div className="h-10 rounded-lg border border-cyan-200 bg-cyan-50" />
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-slate-950 px-2.5 py-2 text-[10px] text-cyan-100 sm:text-xs">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Radar className="size-3 shrink-0" />
                      <span className="truncate">{agent.action}</span>
                    </span>
                    <span className="text-emerald-300">live</span>
                  </div>
                </div>

                <motion.div
                  className="absolute left-5 top-12 rounded-full border border-cyan-600/30 bg-cyan-100/90 p-1.5 text-cyan-800 shadow-[0_12px_34px_rgba(14,116,144,0.2)]"
                  animate={{ x: agent.cursor.x, y: agent.cursor.y }}
                  transition={{ duration: 5.2, delay: index * 0.35, repeat: Infinity, ease: "easeInOut" }}
                >
                  <MousePointer2 className="size-3.5" />
                  <motion.span
                    className="absolute -right-1 -top-1 size-3 rounded-full border border-cyan-500"
                    animate={{ scale: [0.4, 1.9, 0.4], opacity: [0, 0.72, 0] }}
                    transition={{ duration: 1.2, delay: index * 0.35, repeat: Infinity, repeatDelay: 1.1 }}
                  />
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
