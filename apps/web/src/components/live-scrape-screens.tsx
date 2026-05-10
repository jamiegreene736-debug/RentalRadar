"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Chrome, Circle, Clipboard, Clock3, LoaderCircle, RefreshCw, Square, Terminal, X } from "lucide-react";

import { ScrapeSession, ScrapeSessionsResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const sourceLabels: Record<string, string> = {
  airbnb: "Airbnb",
  vrbo: "VRBO",
  booking: "Booking.com",
  direct_pms: "PMS",
  other: "Web",
};

type LiveScrapeScreensProps = {
  propertyId?: string;
  pending?: boolean;
  className?: string;
};

export function LiveScrapeScreens({ propertyId, pending = false, className }: LiveScrapeScreensProps) {
  const [sessions, setSessions] = useState<ScrapeSession[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [cancelStatus, setCancelStatus] = useState<"idle" | "stopping" | "stopped" | "error">("idle");
  const [diagnosticSession, setDiagnosticSession] = useState<ScrapeSession | null>(null);
  const autoOpenedDiagnostics = useRef<Set<string>>(new Set());
  const observedActiveSessionIds = useRef<Set<string>>(new Set());
  const mountedAt = useRef(Date.now());

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
        const response = await fetch(`/api/backend/properties/${propertyId}/scrape-sessions?limit=12`, {
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
          if (payload.sessions.some((session) => ["queued", "running"].includes(session.status))) {
            setCancelStatus("idle");
          }
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

  useEffect(() => {
    sessions.forEach((session) => {
      if (["queued", "running"].includes(session.status)) observedActiveSessionIds.current.add(session.id);
    });
    const failedSession = sessions.find((session) => isDiagnosticSession(session) && shouldAutoOpenDiagnostic(session, observedActiveSessionIds.current, mountedAt.current));
    if (!failedSession || autoOpenedDiagnostics.current.has(failedSession.id)) return;
    autoOpenedDiagnostics.current.add(failedSession.id);
    setDiagnosticSession(failedSession);
  }, [sessions]);

  if (!propertyId && !pending) return null;

  const activeSessions = sessions.filter((session) => ["queued", "running"].includes(session.status));
  const runningSessions = activeSessions.filter((session) => session.status === "running");
  const queuedSessions = activeSessions.filter((session) => session.status === "queued");
  const visibleSessions = (runningSessions.length ? runningSessions : queuedSessions).slice(0, 4);
  const hiddenActiveCount = Math.max(0, activeSessions.length - visibleSessions.length);
  const hasActiveSessions = activeSessions.length > 0;
  const latestSavedSession = sessions[0];
  const progressPercent = hasActiveSessions || pending ? aggregateProgress(activeSessions, pending) : 0;
  const statusCopy = progressCopy(activeSessions, pending, sessions.length);
  const progressTone = hasActiveSessions || pending ? aggregateProgressTone(activeSessions, status) : "bg-slate-700";
  const failedSession = sessions.find(isDiagnosticSession);

  async function stopScan() {
    if (!propertyId || !hasActiveSessions || cancelStatus === "stopping") return;
    setCancelStatus("stopping");
    try {
      const response = await fetch(`/api/backend/properties/${propertyId}/market-scan/cancel`, {
        method: "POST",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Stop scan failed: ${response.status}`);
      const payload = (await response.json()) as { canceled_job_ids?: string[] };
      const canceledIds = new Set(payload.canceled_job_ids ?? []);
      setSessions((current) =>
        current.map((session) =>
          canceledIds.has(session.id)
            ? { ...session, status: "canceled", progress_percent: 0, progress_label: "Scan stopped by user" }
            : session,
        ),
      );
      setCancelStatus("stopped");
    } catch {
      setCancelStatus("error");
    }
  }

  return (
    <>
      <section
        className={cn(
          "mt-5 w-full rounded-[22px] border border-cyan-900/10 bg-slate-950 p-4 shadow-[0_24px_80px_rgba(8,47,73,0.22)]",
          className,
        )}
      >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-cyan-300 text-slate-950">
            <Chrome className="size-5" />
          </span>
          <div>
            <p className="font-semibold text-white">Live Google Chrome scrape</p>
            <p className="text-sm text-slate-400">
              {propertyId
                ? hasActiveSessions
                  ? `${runningSessions.length} running, ${queuedSessions.length} queued`
                  : "No active browser scan right now"
                : "Preparing Airbnb, VRBO, and Booking.com tabs"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasActiveSessions ? (
            <button
              type="button"
              onClick={stopScan}
              disabled={cancelStatus === "stopping"}
              className="inline-flex items-center gap-2 rounded-full border border-rose-300/30 bg-rose-400/12 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/20 disabled:cursor-wait disabled:opacity-70"
            >
              {cancelStatus === "stopping" ? <LoaderCircle className="size-3.5 animate-spin" /> : <Square className="size-3.5 fill-current" />}
              {cancelStatus === "stopping" ? "Stopping" : "Stop scan"}
            </button>
          ) : null}
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
              status === "error" || cancelStatus === "error"
                ? "border-rose-300/25 bg-rose-400/10 text-rose-100"
                : "border-cyan-200/20 bg-cyan-300/10 text-cyan-100",
            )}
          >
            {status === "loading" || pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Circle className="size-2 fill-current" />}
            {cancelStatus === "error"
              ? "Stop failed"
              : cancelStatus === "stopped"
                ? "Stopped"
                : status === "error"
                  ? "Preview unavailable"
                  : status === "loading" || pending
                    ? "Opening tabs"
                    : hasActiveSessions
                      ? "Live"
                      : "Idle"}
          </span>
        </div>
      </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-white">{statusCopy}</p>
          <p className="text-xs font-medium text-slate-300">
            {hasActiveSessions
              ? `${runningSessions.length} live Chrome window${runningSessions.length === 1 ? "" : "s"} · ${queuedSessions.length} queued`
              : latestSavedSession
                ? `Last saved run: ${statusLabel(latestSavedSession.status)}`
                : "No scans queued"}
          </p>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
          <div
            className={cn("h-full rounded-full transition-all duration-700", progressTone)}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          {hasActiveSessions
            ? "Progress is based on queue position, browser pickup, live screenshots, and extraction. Only running jobs are shown as Chrome windows; queued season scans wait their turn."
            : sessions.length
              ? "Past scan results are saved in Scan History. This panel only shows scans that are actively queued or running."
            : "RentalRadar will update this bar as soon as the property is created and scan jobs are returned by the API."}
        </p>
        </div>

        {failedSession && !hasActiveSessions ? (
          <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-rose-50">Saved diagnostic from prior scan</p>
                <p className="mt-1 text-sm leading-6 text-rose-100/80">
                  {failedSession.error_message || failedSession.progress_label || "Open the saved report, or run a new scan to test the current deployment."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDiagnosticSession(failedSession)}
                className="inline-flex w-fit items-center gap-2 rounded-full border border-rose-200/30 bg-white/10 px-3 py-1.5 text-xs font-semibold text-rose-50 transition hover:bg-white/15"
              >
                <AlertTriangle className="size-3.5" />
                Open saved diagnostic
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {hasActiveSessions ? (
          <>
            {visibleSessions.map((session) => (
              <BrowserMiniScreen key={session.id} session={session} onOpenDiagnostic={() => setDiagnosticSession(session)} />
            ))}
            {hiddenActiveCount ? <QueuedSummary count={hiddenActiveCount} running={runningSessions.length} queued={queuedSessions.length} /> : null}
          </>
        ) : pending ? (
          <PendingScreens />
        ) : (
          <NoActiveScreens />
        )}
        </div>
      </section>
      {diagnosticSession ? <DiagnosticModal session={diagnosticSession} onClose={() => setDiagnosticSession(null)} /> : null}
    </>
  );
}

function NoActiveScreens() {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-5 lg:col-span-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-white">No active Chrome windows</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Use Run new scan on the saved property above. Once the browser worker picks it up, Airbnb, VRBO, and Booking.com
            windows will appear here.
          </p>
        </div>
        <span className="w-fit rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
          History preserved
        </span>
      </div>
    </div>
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

function QueuedSummary({ count, running, queued }: { count: number; running: number; queued: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
      <p className="font-semibold text-white">{count} more scan job{count === 1 ? "" : "s"} waiting</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        RentalRadar is keeping the Chrome view readable: {running} running now, {queued} queued behind it. Queued jobs will appear as
        larger browser windows when the worker starts them.
      </p>
    </div>
  );
}

function BrowserMiniScreen({ session, onOpenDiagnostic }: { session: ScrapeSession; onOpenDiagnostic?: () => void }) {
  const latestEvent = session.events[0];
  const timeline = useMemo(() => session.events.slice(0, 4), [session.events]);
  const source = sourceLabels[session.source] ?? session.source;
  const displayUrl = session.current_url ?? session.target_url;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
      <BrowserChrome source={source} status={session.status} url={displayUrl} />
      <div className="relative aspect-video overflow-hidden bg-slate-950">
        {session.latest_screenshot_data_url ? (
          <img src={session.latest_screenshot_data_url} alt={`${source} scrape screen`} className="size-full object-contain" />
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
        {isDiagnosticSession(session) && onOpenDiagnostic ? (
          <button
            type="button"
            onClick={onOpenDiagnostic}
            className="mb-3 inline-flex items-center gap-2 rounded-full border border-rose-300/25 bg-rose-400/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/20"
          >
            <AlertTriangle className="size-3.5" />
            Open diagnostic
          </button>
        ) : null}
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

function DiagnosticModal({ session, onClose }: { session: ScrapeSession; onClose: () => void }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const bundle = useMemo(() => diagnosticBundle(session), [session]);
  const reportText = useMemo(() => JSON.stringify(bundle, null, 2), [bundle]);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/72 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[24px] border border-rose-200/20 bg-slate-950 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 p-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-200">Temporary diagnostic report</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">{sourceLabels[session.source] ?? session.source} scan failed</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              {session.error_message || session.progress_label || "Share this report so the scraper can be adjusted against the exact failure."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full border border-white/10 text-slate-300 hover:bg-white/10">
            <X className="size-4" />
          </button>
        </div>
        <div className="grid max-h-[calc(92vh-108px)] gap-4 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
              <BrowserChrome source={sourceLabels[session.source] ?? session.source} status={session.status} url={session.current_url ?? session.target_url} />
              <div className="grid aspect-video place-items-center bg-slate-950">
                {session.latest_screenshot_data_url ? (
                  <img src={session.latest_screenshot_data_url} alt="Chrome diagnostic screenshot" className="size-full object-contain" />
                ) : (
                  <div className="p-8 text-center">
                    <AlertTriangle className="mx-auto size-10 text-rose-200" />
                    <p className="mt-3 font-semibold text-white">No Chrome screenshot was captured</p>
                    <p className="mt-1 text-sm text-slate-400">The report still includes job state and backend events.</p>
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="font-semibold text-white">Recent event trail</p>
              <div className="mt-3 space-y-2">
                {session.events.slice(0, 8).map((event) => (
                  <div key={`${event.at}-${event.event}`} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={cn("font-semibold", event.level === "error" ? "text-rose-200" : "text-cyan-200")}>{event.event}</span>
                      <span className="text-xs text-slate-500">{new Date(event.at).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-slate-300">{event.message || "No message"}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-white">Copy for Codex</p>
              <button
                type="button"
                onClick={copyReport}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/15"
              >
                <Clipboard className="size-3.5" />
                {copyStatus === "copied" ? "Copied" : copyStatus === "error" ? "Copy failed" : "Copy report"}
              </button>
            </div>
            <textarea
              readOnly
              value={reportText}
              className="mt-3 h-[520px] w-full resize-none rounded-2xl border border-white/10 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-300 outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function diagnosticBundle(session: ScrapeSession) {
  return {
    report_type: "rentalradar_chrome_scrape_failure",
    generated_at: new Date().toISOString(),
    session: {
      id: session.id,
      source: session.source,
      status: session.status,
      target_url: session.target_url,
      current_url: session.current_url,
      started_at: session.started_at,
      completed_at: session.completed_at,
      progress_percent: session.progress_percent,
      progress_label: session.progress_label,
      error_code: session.error_code,
      error_message: session.error_message,
      has_screenshot: Boolean(session.latest_screenshot_data_url),
    },
    diagnostics: session.diagnostics,
    events: session.events.slice(0, 12),
  };
}

function isDiagnosticSession(session: ScrapeSession) {
  return ["failed", "needs_review"].includes(session.status) || Boolean(session.error_code || session.error_message);
}

function shouldAutoOpenDiagnostic(session: ScrapeSession, observedActiveSessionIds: Set<string>, mountedAt: number) {
  if (!isDiagnosticSession(session)) return false;
  if (observedActiveSessionIds.has(session.id)) return true;
  const eventTime = Date.parse(session.completed_at ?? session.started_at ?? session.created_at);
  return Number.isFinite(eventTime) && eventTime >= mountedAt - 5000;
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

function progressCopy(sessions: ScrapeSession[], pending: boolean, savedSessionCount: number) {
  if (!sessions.length) {
    if (pending) return "Submitting property and preparing browser queue";
    if (savedSessionCount) return "No active scan running";
    return "Waiting for scan jobs";
  }
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
