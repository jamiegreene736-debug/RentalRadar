"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

export function DataStreamBackground() {
  const [pointer, setPointer] = useState({ x: 50, y: 35 });
  const streams = useMemo(
    () =>
      Array.from({ length: 34 }).map((_, index) => ({
        id: index,
        left: `${(index * 29) % 100}%`,
        height: 100 + ((index * 37) % 210),
        delay: (index % 9) * 0.38,
        opacity: 0.08 + (index % 5) * 0.035,
      })),
    [],
  );

  return (
    <motion.div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden"
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPointer({
          x: ((event.clientX - rect.left) / rect.width) * 100,
          y: ((event.clientY - rect.top) / rect.height) * 100,
        });
      }}
      style={{
        background: `radial-gradient(circle at ${pointer.x}% ${pointer.y}%, rgba(34, 211, 238, 0.13), transparent 28%), radial-gradient(circle at 70% 20%, rgba(45, 212, 191, 0.08), transparent 34%)`,
      }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(14,116,144,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(14,116,144,0.04)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_86%)]" />
      {streams.map((stream) => (
        <motion.span
          key={stream.id}
          className="absolute top-[-25%] w-px rounded-full bg-gradient-to-b from-transparent via-cyan-200 to-transparent"
          style={{ left: stream.left, height: stream.height, opacity: stream.opacity }}
          animate={{ y: ["0vh", "145vh"] }}
          transition={{ duration: 8 + (stream.id % 7), delay: stream.delay, repeat: Infinity, ease: "linear" }}
        />
      ))}
      <motion.div
        className="absolute size-72 rounded-full border border-cyan-200/20"
        animate={{ x: `${pointer.x - 50}%`, y: `${pointer.y - 50}%`, rotate: 360 }}
        transition={{ type: "spring", stiffness: 32, damping: 18 }}
        style={{ left: "45%", top: "20%", boxShadow: "0 0 80px rgba(34, 211, 238, 0.13)" }}
      />
    </motion.div>
  );
}
