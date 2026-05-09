"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Chrome, Clock3, History, LoaderCircle, RotateCw } from "lucide-react";

import { ScrapeSession, ScrapeSessionsResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const sourceLabels: Record<string, string> = {
  airbnb: "Airbnb",
  vrbo: "VRBO",
  booking: "Booking.com",
  direct_pms: "PMS",
  other: "Web",
};

type ScanHistoryProps = {
  propertyId?: string;
  limit?: number;
  compact?: boolean;
};

export function ScanHistory({ propertyId, limit = 36, compact = false }: ScanHistoryProps) {
  const [sessions, setSessions] = useState<ScrapeSession[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (!propertyId) {
      setSessions([]);
      setStatus("idle");
      return;
    }

    let cancelled = false;
    async function loadHistory() {
      try {
        setStatus((current) => (current === "ready" ? "ready" : "loading"));
        const response = await fetch(`/api/backend/properties/${propertyId}/scrape-sessions?limit=${limit}`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Scan history failed: ${response.status}`);
        const payload = (await response.json()) as ScrapeSessionsResponse;
        if (!cancelled) {
          setSessions(payload.sessions);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void loadHistory();
    const interval = window.setInterval(loadHistory, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [propertyId, limit]);

  const counts = useMemo(() => {
    const active = sessions.filter((session) => ["queued", "running"].includes(session.status)).length;
    const complete = sessions.filter((session) => session.status === "succeeded").length;
    const review = sessions.filter((session) => ["failed", "needs_review"].includes(session.status)).length;
    return { active, complete, review };
  }, [sessions]);

  if (!propertyId) {
    return (
      <section className="rounded-[28px] border border-cyan-900/10 bg-white/80 p-6 shadow-[0_28px_80px_rgba(14,116,144,0.10)]">
        <History className="size-6 text-cyan-800" />
        <h2 className="mt-4 text-2xl font-semibold text-slate-950">Scan history will appear here</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Add a property first. RentalRadar will keep the scan jobs and browser evidence saved even if you leave the tab.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[28px] border border-cyan-900/10 bg-white/85 p-5 shadow-[0_28px_80px_rgba(14,116,144,0.12)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-700">Scan History</p>
          <h2 className={cn("mt-2 font-semibold tracking-normal text-slate-950", compact ? "text-2xl" : "text-4xl")}>
            Saved browser runs
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            These sessions are loaded from the backend job log, so progress and screenshots remain visible after navigation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HistoryPill label="Active" value={counts.active} tone="cyan" />
          <HistoryPill label="Complete" value={counts.complete} tone="emerald" />
          <HistoryPill label="Review" value={counts.review} tone="rose" />
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-950/10">
        <div className="hidden grid-cols-[1.2fr_1fr_1fr_1fr_0.8fr] gap-4 border-b border-slate-950/10 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 md:grid">
          <span>Source</span>
          <span>Status</span>
          <span>Started</span>
          <span>Latest Evidence</span>
          <span className="text-right">Progress</span>
        </div>
        <div className="divide-y divide-slate-950/10 bg-white">
          {status === "loading" && !sessions.length ? <LoadingRow /> : null}
          {status === "error" ? <ErrorRow /> : null}
          {sessions.length
            ? sessions.map((session) => <HistoryRow key={session.id} session={session} />)
            : status !== "loading" && status !== "error"
              ? <EmptyRow />
              : null}
        </div>
      </div>
    </section>
  );
}

function HistoryRow({ session }: { session: ScrapeSession }) {
  const source = sourceLabels[session.source] ?? session.source;
  const latestEvent = session.events[0];
  const evidenceTime = latestEvent?.at ?? session.completed_at ?? session.started_at ?? session.created_at;

  return (
    <div className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1.2fr_1fr_1fr_1fr_0.8fr] md:items-center md:gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-cyan-100 text-cyan-800">
          {session.latest_screenshot_data_url ? (
            <img src={session.latest_screenshot_data_url} alt="" className="size-full rounded-2xl object-cover" />
          ) : (
            <Chrome className="size-5" />
          )}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-slate-950">{source}</p>
          <p className="truncate text-xs text-slate-500">{session.current_url ?? session.target_url}</p>
        </div>
      </div>
      <StatusBadge status={session.status} />
      <span className="text-slate-600">{formatDate(session.started_at ?? session.created_at)}</span>
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-700">{latestEvent?.event ?? session.progress_label}</p>
        <p className="truncate text-xs text-slate-500">{latestEvent?.message ?? formatDate(evidenceTime)}</p>
      </div>
      <div className="md:text-right">
        <p className="font-semibold text-slate-950">{clampedProgress(session.progress_percent)}%</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={cn("h-full rounded-full", progressBarClass(session.status))} style={{ width: `${clampedProgress(session.progress_percent)}%` }} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const Icon = status === "succeeded" ? CheckCircle2 : status === "running" || status === "queued" ? RotateCw : AlertTriangle;
  return (
    <span className={cn("inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold", statusClass(status))}>
      <Icon className={cn("size-3.5", status === "running" || status === "queued" ? "animate-spin" : null)} />
      {statusLabel(status)}
    </span>
  );
}

function HistoryPill({ label, value, tone }: { label: string; value: number; tone: "cyan" | "emerald" | "rose" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold",
        tone === "cyan" ? "border-cyan-200 bg-cyan-50 text-cyan-800" : null,
        tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : null,
        tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-800" : null,
      )}
    >
      {value}
      <span className="text-xs font-medium">{label}</span>
    </span>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-8 text-sm text-slate-600">
      <LoaderCircle className="size-5 animate-spin text-cyan-700" />
      Loading saved scan history...
    </div>
  );
}

function ErrorRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-8 text-sm text-rose-700">
      <AlertTriangle className="size-5" />
      Scan history is temporarily unreachable.
    </div>
  );
}

function EmptyRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-8 text-sm text-slate-600">
      <Clock3 className="size-5 text-cyan-800" />
      No scan jobs have been saved for this property yet.
    </div>
  );
}

function statusLabel(status: string) {
  if (status === "queued") return "Queued";
  if (status === "running") return "Running";
  if (status === "succeeded") return "Complete";
  if (status === "failed") return "Failed";
  if (status === "needs_review") return "Needs review";
  return status.replaceAll("_", " ");
}

function statusClass(status: string) {
  if (status === "queued") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "running") return "border-cyan-200 bg-cyan-50 text-cyan-800";
  if (status === "succeeded") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "failed" || status === "needs_review") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function progressBarClass(status: string) {
  if (status === "succeeded") return "bg-emerald-400";
  if (status === "failed" || status === "needs_review") return "bg-rose-400";
  if (status === "running") return "bg-cyan-400";
  return "bg-amber-300";
}

function clampedProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatDate(value: string | null) {
  if (!value) return "Not started";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
