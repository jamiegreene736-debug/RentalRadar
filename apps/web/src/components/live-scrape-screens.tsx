"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Chrome, Circle, Clock3, LoaderCircle, RefreshCw, Terminal } from "lucide-react";

import { ScrapeSession, ScrapeSessionsResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const sourceLabels: Record<string, string> = {
  airbnb: "Airbnb",
  vrbo: "VRBO",
  booking: "Booking.com",
  direct_pms: "PMS",
  other: "Web",
};

export function LiveScrapeScreens({ propertyId, pending = false }: { propertyId?: string; pending?: boolean }) {
  const [sessions, setSessions] = useState<ScrapeSession[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "live" | "error">("idle");

  useEffect(() => {
    if (!propertyId) {
      setSessions([]);
      setStatus("idle");
      return;
    }

    let cancelled = false;
    async function loadSessions() {
      try {
        setStatus((current) => (current === "live" ? "live" : "loading"));
        const response = await fetch(`/api/backend/properties/${propertyId}/scrape-sessions`, {
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Scrape sessions failed: ${response.status}`);
        const payload = (await response.json()) as ScrapeSessionsResponse;
        if (!cancelled) {
          setSessions(payload.sessions);
          setStatus("live");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void loadSessions();
    const interval = window.setInterval(loadSessions, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [propertyId]);

  if (!propertyId && !pending) return null;

  const activeCount = sessions.filter((session) => ["queued", "running"].includes(session.status)).length;
  const completeCount = sessions.filter((session) => session.status === "succeeded").length;
  const failedCount = sessions.filter((session) => ["failed", "needs_review"].includes(session.status)).length;
  const progressPercent = aggregateProgress(sessions, pending);
  const statusCopy = progressCopy(sessions, pending);
  const progressTone = aggregateProgressTone(sessions, status);

  return (
    <section className="mt-5 w-full rounded-[22px] border border-cyan-900/10 bg-slate-950 p-4 shadow-[0_24px_80px_rgba(8,47,73,0.22)] xl:w-[min(920px,calc(100vw-36rem))]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-cyan-300 text-slate-950">
            <Chrome className="size-5" />
          </span>
          <div>
            <p className="font-semibold text-white">Live Google Chrome scrape</p>
            <p className="text-sm text-slate-400">
              {propertyId
                ? activeCount
                  ? `${activeCount} tab${activeCount === 1 ? "" : "s"} active`
                  : "Watching the latest rate search"
                : "Preparing Airbnb, VRBO, and Booking.com tabs"}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
            status === "error"
              ? "border-rose-300/25 bg-rose-400/10 text-rose-100"
              : "border-cyan-200/20 bg-cyan-300/10 text-cyan-100",
          )}
        >
          {status === "loading" || pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Circle className="size-2 fill-current" />}
          {status === "error" ? "Preview unavailable" : status === "loading" || pending ? "Opening tabs" : "Live"}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-white">{statusCopy}</p>
          <p className="text-xs font-medium text-slate-300">
            {sessions.length ? `${completeCount}/${sessions.length} complete${failedCount ? ` · ${failedCount} needs review` : ""}` : "Preparing queue"}
          </p>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
          <div
            className={cn("h-full rounded-full transition-all duration-700", progressTone)}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          {sessions.length
            ? "Progress is based on evidence captured: queue pickup, browser events, screenshots, and successful extraction. Review states do not count as completed scans."
            : "RentalRadar will update this bar as soon as the property is created and scan jobs are returned by the API."}
        </p>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {sessions.length ? sessions.map((session) => <BrowserMiniScreen key={session.id} session={session} />) : <PendingScreens />}
      </div>
    </section>
  );
}

function PendingScreens() {
  return (
    <>
      {["Airbnb", "VRBO", "Booking.com"].map((source) => (
        <div key={source} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
          <BrowserChrome source={source} status="queued" url="about:blank" />
          <div className="grid aspect-video place-items-center bg-[radial-gradient(circle_at_35%_25%,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,#0f172a,#020617)]">
            <div className="text-center">
              <LoaderCircle className="mx-auto size-8 animate-spin text-cyan-200" />
              <p className="mt-3 text-xs font-medium text-cyan-100">Creating scan jobs</p>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

function BrowserMiniScreen({ session }: { session: ScrapeSession }) {
  const latestEvent = session.events[0];
  const timeline = useMemo(() => session.events.slice(0, 4), [session.events]);
  const source = sourceLabels[session.source] ?? session.source;
  const displayUrl = session.current_url ?? session.target_url;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
      <BrowserChrome source={source} status={session.status} url={displayUrl} />
      <div className="relative aspect-video overflow-hidden bg-slate-950">
        {session.latest_screenshot_data_url ? (
          <img src={session.latest_screenshot_data_url} alt={`${source} scrape screen`} className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.18),transparent_32%),linear-gradient(135deg,#0f172a,#020617)]">
            <div className="max-w-[82%] text-center">
              {session.status === "failed" || session.status === "needs_review" ? (
                <AlertTriangle className="mx-auto size-8 text-rose-200" />
              ) : session.status === "succeeded" ? (
                <CheckCircle2 className="mx-auto size-8 text-emerald-200" />
              ) : (
                <RefreshCw className="mx-auto size-8 animate-spin text-cyan-200" />
              )}
              <p className="mt-3 text-sm font-medium text-white">{statusLabel(session.status)}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                {session.status === "failed" || session.status === "needs_review"
                  ? "No Chrome screenshot was captured for this scan."
                  : "Waiting for the browser to send its first screen."}
              </p>
            </div>
          </div>
        )}
        <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/10 bg-slate-950/82 px-3 py-2 backdrop-blur">
          <p className="truncate text-xs font-medium text-white">{latestEvent?.message ?? statusLabel(session.status)}</p>
          <p className="mt-1 truncate text-[11px] text-slate-400">{displayUrl}</p>
        </div>
      </div>
      <div className="border-t border-white/10 bg-slate-950/92 p-3">
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-slate-400">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Clock3 className="size-3.5 shrink-0 text-cyan-200" />
              <span className="truncate">{session.progress_label}</span>
            </span>
            <span className="shrink-0 text-slate-300">{clampedProgress(session.progress_percent)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className={cn("h-full rounded-full transition-all duration-700", progressBarClass(session.status))}
              style={{ width: `${clampedProgress(session.progress_percent)}%` }}
            />
          </div>
        </div>
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
          <Terminal className="size-3.5" />
          Scrape Log
        </div>
        <div className="space-y-1.5">
          {timeline.length ? (
            timeline.map((event) => (
              <p key={`${event.at}-${event.event}`} className="truncate text-xs text-slate-300">
                <span className={cn("mr-2", event.level === "error" ? "text-rose-200" : "text-cyan-200")}>{event.event}</span>
                {event.message}
              </p>
            ))
          ) : (
            <p className="text-xs text-slate-400">Waiting for Chrome to emit its first browser event.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function BrowserChrome({ source, status, url }: { source: string; status: string; url: string }) {
  return (
    <div className="border-b border-white/10 bg-slate-800/92 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full bg-rose-400" />
        <span className="size-2.5 rounded-full bg-amber-300" />
        <span className="size-2.5 rounded-full bg-emerald-400" />
        <div className="ml-2 flex min-w-0 flex-1 items-center gap-2 rounded-t-lg bg-slate-950 px-3 py-1.5">
          <Chrome className="size-3.5 shrink-0 text-cyan-200" />
          <span className="truncate text-xs font-medium text-white">{source}</span>
          <span className={cn("ml-auto size-2 rounded-full", statusDotClass(status))} />
        </div>
      </div>
      <div className="mt-2 truncate rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] text-slate-300">
        {url}
      </div>
    </div>
  );
}

function statusLabel(status: string) {
  if (status === "queued") return "Queued for Chrome";
  if (status === "running") return "Actively scraping";
  if (status === "succeeded") return "Rates captured";
  if (status === "failed") return "Needs review";
  if (status === "needs_review") return "No screen captured";
  return status.replaceAll("_", " ");
}

function statusDotClass(status: string) {
  if (status === "running") return "animate-pulse bg-cyan-300";
  if (status === "queued") return "animate-pulse bg-amber-300";
  if (status === "succeeded") return "bg-emerald-300";
  if (status === "failed") return "bg-rose-300";
  return "bg-slate-500";
}

function aggregateProgress(sessions: ScrapeSession[], pending: boolean) {
  if (!sessions.length) return pending ? 6 : 0;
  const total = sessions.reduce((sum, session) => sum + clampedProgress(session.progress_percent), 0);
  return Math.round(total / sessions.length);
}

function aggregateProgressTone(sessions: ScrapeSession[], status: "idle" | "loading" | "live" | "error") {
  if (status === "error") return "bg-rose-300";
  const failed = sessions.some((session) => ["failed", "needs_review"].includes(session.status));
  const succeeded = sessions.length > 0 && sessions.every((session) => session.status === "succeeded");
  if (failed) return "bg-rose-300";
  if (succeeded) return "bg-emerald-300";
  return "bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300";
}

function clampedProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function progressCopy(sessions: ScrapeSession[], pending: boolean) {
  if (!sessions.length) return pending ? "Submitting property and preparing browser queue" : "Waiting for scan jobs";
  const running = sessions.filter((session) => session.status === "running").length;
  const succeeded = sessions.filter((session) => session.status === "succeeded").length;
  const failed = sessions.filter((session) => ["failed", "needs_review"].includes(session.status)).length;
  const queued = sessions.filter((session) => session.status === "queued").length;
  if (running) return `${running} Chrome tab${running === 1 ? "" : "s"} actively scraping`;
  if (queued && !succeeded && !failed) return `${queued} scan${queued === 1 ? "" : "s"} queued, waiting for the browser worker`;
  if (succeeded === sessions.length) return "All browser scans complete";
  if (failed) return `${failed} scan${failed === 1 ? "" : "s"} need review`;
  return `${succeeded} scan${succeeded === 1 ? "" : "s"} complete, ${queued} still queued`;
}

function progressBarClass(status: string) {
  if (status === "succeeded") return "bg-emerald-300";
  if (status === "failed" || status === "needs_review") return "bg-rose-300";
  if (status === "running") return "bg-cyan-300";
  return "bg-amber-300";
}
