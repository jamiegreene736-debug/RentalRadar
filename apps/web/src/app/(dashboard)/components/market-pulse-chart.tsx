"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { marketPulse } from "@/app/(dashboard)/components/dashboard-data";

export function MarketPulseChart() {
  return (
    <div className="h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={marketPulse} margin={{ left: 0, right: 12, top: 18, bottom: 0 }}>
          <defs>
            <linearGradient id="optimized" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.42} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="scraped" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(148,163,184,0.13)" vertical={false} />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(value) => `$${value}`} />
          <Tooltip
            contentStyle={{
              background: "rgba(5,8,22,0.92)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 18,
              color: "#fff",
            }}
            formatter={(value) => [`$${value}`, ""]}
          />
          <Legend iconType="circle" wrapperStyle={{ color: "#cbd5e1", fontSize: 12 }} />
          <Area type="monotone" dataKey="booking" stroke="#64748b" fill="url(#scraped)" strokeWidth={1.5} name="Scraped comps" />
          <Area type="monotone" dataKey="optimized" stroke="#22d3ee" fill="url(#optimized)" strokeWidth={3} name="AI optimized" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
