"use client";

import { motion } from "framer-motion";
import { Bot, Chrome, Code2, Compass, MousePointer2, Radar } from "lucide-react";

const locatorLines = [
  "agent.scan('calendar-grid')",
  "trainer.patch(locator.priceCell)",
  "chrome.headed(true)",
  "push.rate('$286', minStay=2)",
];

const rateRows = [
  ["Airbnb", "$286", "+12%"],
  ["VRBO", "$274", "+8%"],
  ["Booking", "$301", "+15%"],
];

export function AnimatedBrowserDemo() {
  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <motion.div
        className="absolute -left-6 top-10 hidden rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-100 shadow-[0_0_50px_rgba(34,211,238,0.18)] md:block"
        animate={{ y: [0, -16, 0], rotate: [-2, 2, -2] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <Bot className="size-6" />
      </motion.div>
      <motion.div
        className="absolute -right-5 bottom-20 hidden rounded-2xl border border-teal-300/20 bg-teal-300/10 p-3 text-teal-100 shadow-[0_0_50px_rgba(45,212,191,0.16)] md:block"
        animate={{ y: [0, 14, 0], rotate: [2, -2, 2] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <MousePointer2 className="size-6" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative overflow-hidden rounded-[28px] border border-white/[0.12] bg-slate-950/[0.88] shadow-[0_40px_120px_rgba(0,0,0,0.55),0_0_80px_rgba(34,211,238,0.12)]"
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-5 py-4">
          <div className="flex gap-2">
            <span className="size-3 rounded-full bg-red-400" />
            <span className="size-3 rounded-full bg-amber-300" />
            <span className="size-3 rounded-full bg-emerald-300" />
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-900 px-4 py-2 text-xs text-slate-300">
            <Chrome className="size-4 text-cyan-200" />
            Real headed Chrome session
          </div>
          <Compass className="size-5 text-slate-400" />
        </div>

        <div className="grid gap-0 lg:grid-cols-[1fr_0.9fr]">
          <div className="relative min-h-[360px] border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
            <div className="rounded-2xl border border-cyan-200/[0.14] bg-[#07111f] p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Host Calendar</p>
                  <p className="text-xs text-slate-400">Airbnb.com hosting/pricing</p>
                </div>
                <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">live DOM</span>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 28 }).map((_, index) => (
                  <motion.div
                    key={index}
                    className="aspect-square rounded-lg border border-white/[0.08] bg-slate-900 p-2"
                    animate={{
                      borderColor: index % 6 === 0 ? "rgba(34,211,238,0.6)" : "rgba(255,255,255,0.08)",
                      boxShadow: index % 6 === 0 ? "0 0 24px rgba(34,211,238,0.22)" : "0 0 0 rgba(0,0,0,0)",
                    }}
                    transition={{ duration: 1.6, delay: (index % 6) * 0.18, repeat: Infinity, repeatType: "reverse" }}
                  >
                    <div className="h-1.5 w-8 rounded-full bg-slate-700" />
                    <div className="mt-3 h-2 w-10 rounded-full bg-cyan-300/50" />
                  </motion.div>
                ))}
              </div>
            </div>

            <motion.div
              className="absolute left-16 top-36 rounded-full border border-cyan-200/40 bg-cyan-200/15 p-2 text-cyan-100"
              animate={{ x: [0, 220, 250, 90, 20], y: [0, 32, 132, 180, 62] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              <MousePointer2 className="size-4" />
            </motion.div>
          </div>

          <div className="p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-cyan-100">
              <Code2 className="size-4" />
              AI locator training
            </div>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-black/[0.38] p-4 font-mono text-xs text-cyan-100">
              {locatorLines.map((line, index) => (
                <motion.div
                  key={line}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0.35 }}
                  animate={{ opacity: [0.35, 1, 0.35] }}
                  transition={{ duration: 2.2, delay: index * 0.28, repeat: Infinity }}
                >
                  <span className="text-slate-500">0{index + 1}</span>
                  <span>{line}</span>
                </motion.div>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              {rateRows.map(([source, price, lift], index) => (
                <motion.div
                  key={source}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
                  animate={{ x: [0, 6, 0] }}
                  transition={{ duration: 3, delay: index * 0.4, repeat: Infinity }}
                >
                  <span className="flex items-center gap-2 text-sm text-slate-300">
                    <Radar className="size-4 text-cyan-200" />
                    {source}
                  </span>
                  <span className="font-semibold text-white">{price}</span>
                  <span className="text-xs text-emerald-200">{lift}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
