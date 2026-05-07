"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Chrome, Circle, LoaderCircle, RefreshCw, Terminal } from "lucide-react";

import { ScrapeSession, ScrapeSessionsResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const ORG_ID = process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? "00000000-0000-0000-0000-000000000001";
const USER_ID = process.env.NEXT_PUBLIC_USER_ID ?? "00000000-0000-0000-0000-000000000002";

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
            "X-Organization-Id": ORG_ID,
            "X-User-Id": USER_ID,
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

  return (
    <section className="mt-5 rounded-[22px] border border-cyan-900/10 bg-slate-950 p-4 shadow-[0_24px_80px_rgba(8,47,73,0.22)]">
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
            <LoaderCircle className="size-8 animate-spin text-cyan-200" />
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
            <div className="text-center">
              {session.status === "failed" ? (
                <AlertTriangle className="mx-auto size-8 text-rose-200" />
              ) : session.status === "succeeded" ? (
                <CheckCircle2 className="mx-auto size-8 text-emerald-200" />
              ) : (
                <RefreshCw className="mx-auto size-8 animate-spin text-cyan-200" />
              )}
              <p className="mt-3 text-sm font-medium text-white">{statusLabel(session.status)}</p>
            </div>
          </div>
        )}
        <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/10 bg-slate-950/82 px-3 py-2 backdrop-blur">
          <p className="truncate text-xs font-medium text-white">{latestEvent?.message ?? statusLabel(session.status)}</p>
          <p className="mt-1 truncate text-[11px] text-slate-400">{displayUrl}</p>
        </div>
      </div>
      <div className="border-t border-white/10 bg-slate-950/92 p-3">
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
  return status.replaceAll("_", " ");
}

function statusDotClass(status: string) {
  if (status === "running") return "animate-pulse bg-cyan-300";
  if (status === "queued") return "animate-pulse bg-amber-300";
  if (status === "succeeded") return "bg-emerald-300";
  if (status === "failed") return "bg-rose-300";
  return "bg-slate-500";
}
