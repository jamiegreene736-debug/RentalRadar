"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Chrome, Clock3, LoaderCircle, RefreshCw, RotateCcw, TimerReset } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { PropertyResponse, ScrapeSession, ScrapeSessionsResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const sourceLabels: Record<string, string> = {
  airbnb: "Airbnb",
  vrbo: "VRBO",
  booking: "Booking.com",
  direct_pms: "PMS",
  guesty: "Guesty",
  hostaway: "Hostaway",
  ownerrez: "OwnerRez",
  manual: "Manual",
  other: "Web",
};

type ScanWithProperty = ScrapeSession & {
  property: PropertyResponse;
};

export function QueuedScansWorkspace({ properties }: { properties: PropertyResponse[] }) {
  const searchParams = useSearchParams();
  const requestedPropertyId = searchParams?.get("property");
  const initialPropertyId = requestedPropertyId && properties.some((property) => property.id === requestedPropertyId)
    ? requestedPropertyId
    : properties.length > 1 ? "all" : properties[0]?.id ?? "";
  const [selectedPropertyId, setSelectedPropertyId] = useState(initialPropertyId);
  const [sessions, setSessions] = useState<ScanWithProperty[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const targetProperties = useMemo(
    () =>
      selectedPropertyId === "all"
        ? properties
        : properties.filter((property) => property.id === selectedPropertyId),
    [properties, selectedPropertyId],
  );
  const activeSessions = useMemo(
    () => sessions.filter((session) => ["queued", "running"].includes(session.status)),
    [sessions],
  );
  const visibleSessions = activeSessions.length ? activeSessions : sessions.slice(0, 8);
  const counts = useMemo(
    () => ({
      queued: sessions.filter((session) => session.status === "queued").length,
      running: sessions.filter((session) => session.status === "running").length,
      complete: sessions.filter((session) => session.status === "succeeded").length,
      review: sessions.filter((session) => ["failed", "needs_review"].includes(session.status)).length,
    }),
    [sessions],
  );

  useEffect(() => {
    if (!targetProperties.length) {
      setSessions([]);
      setStatus("idle");
      return;
    }

    let cancelled = false;
    async function loadSessions() {
      try {
        setStatus((current) => (current === "ready" ? "ready" : "loading"));
        const payloads = await Promise.all(
          targetProperties.map(async (property) => {
            const response = await fetch(`/api/backend/properties/${property.id}/scrape-sessions?limit=60`, {
              headers: { Accept: "application/json" },
              cache: "no-store",
            });
            if (!response.ok) throw new Error(`Queued scans failed: ${response.status}`);
            const payload = (await response.json()) as ScrapeSessionsResponse;
            return payload.sessions.map((session) => ({ ...session, property }));
          }),
        );
        if (!cancelled) {
          setSessions(
            payloads
              .flat()
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
          );
          setStatus("ready");
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
  }, [targetProperties]);

  async function retryScan(session: ScanWithProperty) {
    if (!canRetry(session.status) || retryingIds.has(session.id)) return;
    setRetryingIds((current) => new Set(current).add(session.id));
    setActionMessage(null);
    try {
      const response = await fetch(`/api/backend/properties/${session.property.id}/scrape-sessions/${session.id}/retry`, {
        method: "POST",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Retry failed: ${response.status}`);
      const retrySession = (await response.json()) as ScrapeSession;
      setSessions((current) => [
        { ...retrySession, property: session.property },
        ...current,
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setActionMessage(`${sourceLabels[session.source] ?? session.source} scan retry queued for ${propertyLabel(session.property)}.`);
    } catch {
      setActionMessage("That scan could not be retried right now. Please try again in a moment.");
    } finally {
      setRetryingIds((current) => {
        const next = new Set(current);
        next.delete(session.id);
        return next;
      });
    }
  }

  if (!properties.length) {
    return (
      <section className="rounded-lg border border-cyan-900/10 bg-white p-6 shadow-sm">
        <Chrome className="size-6 text-cyan-700" />
        <h1 className="mt-4 text-2xl font-semibold text-slate-950">Queued scans need a saved property</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Add a property first. Once scans are queued, this page will show the Chrome queue, titles, progress, and screenshots.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Queued Scans</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">Chrome browser queue</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            See each property/source scan, what is waiting, what needs attention, and which scans can be retried.
          </p>
        </div>
        <select
          value={selectedPropertyId}
          onChange={(event) => setSelectedPropertyId(event.target.value)}
          className="h-11 min-w-72 rounded-lg border border-cyan-900/10 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-cyan-500"
        >
          {properties.length > 1 ? <option value="all">All properties</option> : null}
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {propertyLabel(property)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        <Metric icon={TimerReset} label="Queued" value={String(counts.queued)} tone="amber" />
        <Metric icon={Chrome} label="Running Chrome" value={String(counts.running)} tone="cyan" />
        <Metric icon={CheckCircle2} label="Complete" value={String(counts.complete)} tone="emerald" />
        <Metric icon={AlertTriangle} label="Needs review" value={String(counts.review)} tone="rose" />
      </div>

      <div className="rounded-lg border border-cyan-900/10 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-slate-950">
              {selectedPropertyId === "all" ? "All property scan jobs" : propertyLabel(targetProperties[0])}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {activeSessions.length
                ? `${activeSessions.length} active scan${activeSessions.length === 1 ? "" : "s"} in the browser queue`
                : "No active scans right now. Showing the latest saved Chrome runs."}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-900/10 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800">
            {status === "loading" ? <LoaderCircle className="size-3.5 animate-spin" /> : <Clock3 className="size-3.5" />}
            Refreshes every 2.5s
          </span>
        </div>
        {actionMessage ? (
          <div className="mt-4 rounded-lg border border-cyan-900/10 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-900">
            {actionMessage}
          </div>
        ) : null}

        {status === "loading" && !sessions.length ? (
          <div className="mt-5 grid min-h-64 place-items-center rounded-lg border border-dashed border-cyan-900/20 bg-cyan-50/40 text-sm text-slate-600">
            <div className="text-center">
              <LoaderCircle className="mx-auto size-8 animate-spin text-cyan-700" />
              <p className="mt-3 font-medium">Loading Chrome queue</p>
            </div>
          </div>
        ) : status === "error" ? (
          <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            Queued scans are temporarily unreachable.
          </div>
        ) : visibleSessions.length ? (
          <>
            <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
              <div className="grid grid-cols-[minmax(220px,1.1fr)_minmax(170px,0.8fr)_minmax(150px,0.7fr)_minmax(160px,0.8fr)] gap-0 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 max-lg:hidden">
                <span>Property</span>
                <span>Scan</span>
                <span>Status</span>
                <span>Action</span>
              </div>
              <div className="divide-y divide-slate-200 bg-white">
                {visibleSessions.map((session) => (
                  <QueueScanRow
                    key={session.id}
                    session={session}
                    retrying={retryingIds.has(session.id)}
                    onRetry={() => retryScan(session)}
                  />
                ))}
              </div>
            </div>
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {visibleSessions.slice(0, 4).map((session) => (
                <QueuedScanCard
                  key={session.id}
                  session={session}
                  retrying={retryingIds.has(session.id)}
                  onRetry={() => retryScan(session)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="mt-5 rounded-lg border border-dashed border-cyan-900/20 bg-cyan-50/40 p-6 text-sm leading-6 text-slate-600">
            No scan jobs have been created for this property yet. Use the saved property page to scan the property, then return here to watch Chrome.
          </div>
        )}
      </div>
    </section>
  );
}

function QueueScanRow({ session, retrying, onRetry }: { session: ScanWithProperty; retrying: boolean; onRetry: () => void }) {
  const source = sourceLabels[session.source] ?? session.source;
  return (
    <div className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[minmax(220px,1.1fr)_minmax(170px,0.8fr)_minmax(150px,0.7fr)_minmax(160px,0.8fr)] lg:items-center">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 lg:hidden">Property</p>
        <p className="truncate font-semibold text-slate-950">Property: {propertyLabel(session.property)}</p>
        <p className="mt-1 truncate text-xs text-slate-500">{session.property.formatted_address ?? session.property.address_line1}</p>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 lg:hidden">Scan</p>
        <p className="font-semibold text-slate-950">Scan: {source}</p>
        <p className="mt-1 truncate text-xs text-slate-500">{scanWindow(session)}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 lg:hidden">Status</p>
        <StatusBadge status={session.status} variant="light" />
        <p className="mt-1 text-xs text-slate-500">{session.queue_position ? `Queue position ${session.queue_position}` : formatDate(session.started_at ?? session.created_at)}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 lg:hidden">Action</p>
        {canRetry(session.status) ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {retrying ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
            Retry scan
          </button>
        ) : (
          <span className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600">
            {activeCopy(session.status)}
          </span>
        )}
      </div>
    </div>
  );
}

function QueuedScanCard({ session, retrying, onRetry }: { session: ScanWithProperty; retrying: boolean; onRetry: () => void }) {
  const source = sourceLabels[session.source] ?? session.source;
  const title = scanTitle(session, source);
  const displayUrl = session.current_url ?? session.target_url;
  const latestEvent = session.events[0];

  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950 shadow-sm">
      <div className="border-b border-white/10 bg-slate-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-rose-400" />
          <span className="size-2.5 rounded-full bg-amber-300" />
          <span className="size-2.5 rounded-full bg-emerald-400" />
          <div className="ml-2 flex min-w-0 flex-1 items-center gap-2 rounded-t-lg bg-slate-950 px-3 py-1.5">
            <Chrome className="size-3.5 shrink-0 text-cyan-200" />
            <span className="truncate text-xs font-semibold text-white">{title}</span>
            <span className={cn("ml-auto size-2 rounded-full", statusDotClass(session.status))} />
          </div>
        </div>
        <div className="mt-2 truncate rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] text-slate-300">
          {displayUrl}
        </div>
      </div>

      <div className="relative aspect-video overflow-hidden bg-slate-950">
        {session.latest_screenshot_data_url ? (
          <img src={session.latest_screenshot_data_url} alt={`${title} Chrome screenshot`} className="size-full object-contain" />
        ) : (
          <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.18),transparent_32%),linear-gradient(135deg,#0f172a,#020617)]">
            <div className="max-w-[82%] text-center">
              {["queued", "running"].includes(session.status) ? (
                <RefreshCw className="mx-auto size-8 animate-spin text-cyan-200" />
              ) : session.status === "succeeded" ? (
                <CheckCircle2 className="mx-auto size-8 text-emerald-200" />
              ) : (
                <AlertTriangle className="mx-auto size-8 text-rose-200" />
              )}
              <p className="mt-3 text-sm font-semibold text-white">{statusLabel(session.status)}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                {session.status === "queued" ? "Waiting for the browser worker to open Chrome." : "Waiting for the next Chrome screenshot."}
              </p>
            </div>
          </div>
        )}
        <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/10 bg-slate-950/82 px-3 py-2 backdrop-blur">
          <p className="truncate text-xs font-semibold text-white">{session.progress_label}</p>
          <p className="mt-1 truncate text-[11px] text-slate-400">{latestEvent?.message ?? queueCopy(session)}</p>
        </div>
      </div>

      <div className="border-t border-white/10 bg-slate-950 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StatusBadge status={session.status} />
          <span className="text-xs font-medium text-slate-400">
            {session.queue_position ? `Queue position ${session.queue_position}` : formatDate(session.started_at ?? session.created_at)}
          </span>
        </div>
        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
          <p className="truncate text-xs font-semibold text-white">Property: {propertyLabel(session.property)}</p>
          <p className="mt-1 truncate text-xs text-slate-400">Scan: {source} · {scanWindow(session)}</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
          <div className={cn("h-full rounded-full transition-all duration-700", progressBarClass(session.status))} style={{ width: `${clampedProgress(session.progress_percent)}%` }} />
        </div>
        <div className="mt-3 grid gap-1.5">
          {session.events.slice(0, 3).map((event) => (
            <p key={`${event.at}-${event.event}`} className="truncate text-xs text-slate-300">
              <span className={cn("mr-2", event.level === "error" ? "text-rose-200" : "text-cyan-200")}>{event.event}</span>
              {event.message || formatDate(event.at)}
            </p>
          ))}
        </div>
        {canRetry(session.status) ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {retrying ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
            Retry this scan
          </button>
        ) : null}
      </div>
    </article>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: "amber" | "cyan" | "emerald" | "rose" }) {
  return (
    <div className="rounded-lg border border-cyan-900/10 bg-white p-4 shadow-sm">
      <Icon className={cn("size-5", toneClass(tone, "icon"))} />
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{label}</p>
    </div>
  );
}

function StatusBadge({ status, variant = "dark" }: { status: string; variant?: "dark" | "light" }) {
  return (
    <span className={cn("inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold", statusClass(status, variant))}>
      {statusLabel(status)}
    </span>
  );
}

function scanTitle(session: ScrapeSession, source: string) {
  const diagnostics = session.diagnostics ?? {};
  const requestContext = diagnostics.request_context && typeof diagnostics.request_context === "object" ? diagnostics.request_context as Record<string, unknown> : {};
  const season = typeof requestContext.season === "string" ? requestContext.season : null;
  const stayStart = typeof diagnostics.stay_date_start === "string" ? diagnostics.stay_date_start : null;
  const stayEnd = typeof diagnostics.stay_date_end === "string" ? diagnostics.stay_date_end : null;
  if (season) return `${season} ${source} scan`;
  if (stayStart && stayEnd) return `${source} ${shortDate(stayStart)}-${shortDate(stayEnd)} scan`;
  return `${source} market scan`;
}

function queueCopy(session: ScrapeSession) {
  if (session.status === "queued" && session.queue_position) return `Waiting behind ${Math.max(0, session.queue_position - 1)} scan jobs.`;
  if (session.status === "running") return "Chrome is open and the browser worker is updating screenshots.";
  return session.error_message || session.progress_label;
}

function propertyLabel(property?: PropertyResponse) {
  if (!property) return "Unknown property";
  return property.name || property.formatted_address || property.address_line1;
}

function scanWindow(session: ScrapeSession) {
  const diagnostics = session.diagnostics ?? {};
  const stayStart = typeof diagnostics.stay_date_start === "string" ? diagnostics.stay_date_start : null;
  const stayEnd = typeof diagnostics.stay_date_end === "string" ? diagnostics.stay_date_end : null;
  if (stayStart && stayEnd) return `${shortDate(stayStart)} to ${shortDate(stayEnd)}`;
  return scanTitle(session, sourceLabels[session.source] ?? session.source);
}

function canRetry(status: string) {
  return ["failed", "needs_review", "canceled"].includes(status);
}

function activeCopy(status: string) {
  if (status === "queued") return "Already queued";
  if (status === "running") return "Running now";
  if (status === "succeeded") return "Complete";
  return "No action needed";
}

function statusLabel(status: string) {
  if (status === "queued") return "Queued";
  if (status === "running") return "Chrome running";
  if (status === "succeeded") return "Complete";
  if (status === "failed") return "Failed";
  if (status === "needs_review") return "Needs review";
  if (status === "canceled") return "Canceled";
  return status.replaceAll("_", " ");
}

function statusClass(status: string, variant: "dark" | "light" = "dark") {
  if (variant === "light") {
    if (status === "queued") return "border-amber-200 bg-amber-50 text-amber-700";
    if (status === "running") return "border-cyan-200 bg-cyan-50 text-cyan-700";
    if (status === "succeeded") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (status === "failed" || status === "needs_review") return "border-rose-200 bg-rose-50 text-rose-700";
    return "border-slate-200 bg-slate-50 text-slate-600";
  }
  if (status === "queued") return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  if (status === "running") return "border-cyan-300/30 bg-cyan-300/10 text-cyan-100";
  if (status === "succeeded") return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  if (status === "failed" || status === "needs_review") return "border-rose-300/30 bg-rose-300/10 text-rose-100";
  return "border-slate-300/20 bg-slate-300/10 text-slate-200";
}

function progressBarClass(status: string) {
  if (status === "succeeded") return "bg-emerald-300";
  if (status === "failed" || status === "needs_review") return "bg-rose-300";
  if (status === "running") return "bg-cyan-300";
  return "bg-amber-300";
}

function statusDotClass(status: string) {
  if (status === "running") return "animate-pulse bg-cyan-300";
  if (status === "queued") return "animate-pulse bg-amber-300";
  if (status === "succeeded") return "bg-emerald-300";
  if (status === "failed" || status === "needs_review") return "bg-rose-300";
  return "bg-slate-500";
}

function toneClass(tone: "amber" | "cyan" | "emerald" | "rose", part: "icon") {
  if (part === "icon" && tone === "amber") return "text-amber-600";
  if (part === "icon" && tone === "cyan") return "text-cyan-700";
  if (part === "icon" && tone === "emerald") return "text-emerald-700";
  return "text-rose-700";
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

function shortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}
