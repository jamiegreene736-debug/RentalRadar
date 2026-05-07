import { Bot } from "lucide-react";

export function AiAgentsWidget() {
  return (
    <div className="rounded-[28px] border border-cyan-900/10 bg-white/78 p-5 shadow-[0_24px_90px_rgba(14,116,144,0.13)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">AI Agents</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">No live training yet</h3>
        </div>
        <div className="grid size-12 place-items-center rounded-2xl bg-cyan-100 text-cyan-800">
          <Bot className="size-6" />
        </div>
      </div>
      <p className="mt-5 text-sm leading-6 text-slate-600">
        Agent activity will appear after a real property scan starts. No placeholder stream is shown for new accounts.
      </p>
    </div>
  );
}
