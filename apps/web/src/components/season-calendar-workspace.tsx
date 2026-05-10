"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, LoaderCircle, MapPinned, Sparkles, SunMedium } from "lucide-react";

import type { PropertyResponse, SeasonCalendarResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SeasonCalendarWorkspace({ properties }: { properties: PropertyResponse[] }) {
  const [selectedPropertyId, setSelectedPropertyId] = useState(properties[0]?.id ?? "");
  const [calendar, setCalendar] = useState<SeasonCalendarResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId) ?? properties[0],
    [properties, selectedPropertyId],
  );

  useEffect(() => {
    if (!selectedPropertyId) return;
    let cancelled = false;
    async function loadCalendar() {
      setStatus("loading");
      setMessage("");
      try {
        const response = await fetch(`/api/backend/properties/${selectedPropertyId}/season-calendar`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) throw new Error(await readError(response));
        const payload = (await response.json()) as SeasonCalendarResponse;
        if (!cancelled) {
          setCalendar(payload);
          setStatus("idle");
        }
      } catch (error) {
        if (!cancelled) {
          setCalendar(null);
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "Unable to load the season calendar.");
        }
      }
    }
    void loadCalendar();
    return () => {
      cancelled = true;
    };
  }, [selectedPropertyId]);

  if (!properties.length) {
    return (
      <section className="rounded-lg border border-cyan-900/10 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-950">Add a property before configuring market seasons.</p>
      </section>
    );
  }

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Season Calendar</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">Low, middle, high, and holiday demand</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {selectedProperty?.formatted_address ?? selectedProperty?.address_line1 ?? "Select a property"}
          </p>
        </div>
        <select
          value={selectedPropertyId}
          onChange={(event) => setSelectedPropertyId(event.target.value)}
          className="h-11 min-w-72 rounded-lg border border-cyan-900/10 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-cyan-500"
        >
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name || property.formatted_address || property.address_line1}
            </option>
          ))}
        </select>
      </div>

      {status === "error" ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{message}</div>
      ) : null}

      {status === "loading" || !calendar ? (
        <div className="grid min-h-72 place-items-center rounded-lg border border-cyan-900/10 bg-white text-slate-600 shadow-sm">
          <div className="text-center">
            <LoaderCircle className="mx-auto size-8 animate-spin text-cyan-700" />
            <p className="mt-3 text-sm font-medium">Loading market season rules</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="rounded-lg border border-cyan-900/10 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-cyan-50 text-cyan-700">
                  <MapPinned className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Inferred Market</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-normal text-slate-950">{calendar.market_label}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{calendar.basis}</p>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 size-5 shrink-0" />
                <p className="text-sm leading-6">{calendar.current_model_note}</p>
              </div>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {calendar.seasons.map((season) => (
              <section key={season.code} className="rounded-lg border border-cyan-900/10 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className={cn("text-xs font-semibold uppercase tracking-[0.18em]", toneText(season.code))}>{season.label}</p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">{formatMultiplier(season.multiplier)}</h2>
                  </div>
                  <span className={cn("grid size-11 place-items-center rounded-lg", toneBg(season.code))}>
                    <CalendarRange className="size-5" />
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {season.month_labels.map((month) => (
                    <span key={month} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {month}
                    </span>
                  ))}
                </div>
                <dl className="mt-5 grid gap-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">Minimum stay</dt>
                    <dd className="font-semibold text-slate-950">{season.minimum_stay_nights} nights</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Posture</dt>
                    <dd className="mt-1 leading-6 text-slate-700">{season.booking_posture}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Notes</dt>
                    <dd className="mt-1 leading-6 text-slate-700">{season.notes}</dd>
                  </div>
                </dl>
              </section>
            ))}
          </div>

          <section className="rounded-lg border border-cyan-900/10 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-rose-50 text-rose-700">
                <SunMedium className="size-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Holiday Overrides</p>
                <h2 className="text-xl font-semibold tracking-normal text-slate-950">Dates that should override normal season rules</h2>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[760px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="py-3 pr-4 font-semibold">Window</th>
                    <th className="py-3 pr-4 font-semibold">Dates</th>
                    <th className="py-3 pr-4 font-semibold">Multiplier</th>
                    <th className="py-3 pr-4 font-semibold">Min stay</th>
                    <th className="py-3 font-semibold">Rule note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calendar.holidays.map((holiday) => (
                    <tr key={holiday.label}>
                      <td className="py-3 pr-4 font-semibold text-slate-950">{holiday.label}</td>
                      <td className="py-3 pr-4 text-slate-600">{holiday.date_window}</td>
                      <td className="py-3 pr-4 font-semibold text-slate-950">{formatMultiplier(holiday.multiplier)}</td>
                      <td className="py-3 pr-4 text-slate-600">{holiday.minimum_stay_nights} nights</td>
                      <td className="py-3 leading-6 text-slate-600">{holiday.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </section>
  );
}

function formatMultiplier(value: number) {
  const percent = Math.round((value - 1) * 100);
  return percent === 0 ? "Base rate" : `${percent > 0 ? "+" : ""}${percent}%`;
}

function toneText(code: string) {
  if (code === "low") return "text-sky-700";
  if (code === "middle") return "text-teal-700";
  if (code === "high") return "text-amber-700";
  return "text-slate-700";
}

function toneBg(code: string) {
  if (code === "low") return "bg-sky-50 text-sky-700";
  if (code === "middle") return "bg-teal-50 text-teal-700";
  if (code === "high") return "bg-amber-50 text-amber-700";
  return "bg-slate-50 text-slate-700";
}

async function readError(response: Response) {
  const text = await response.text();
  if (!text) return `Request failed: ${response.status}`;
  try {
    const payload = JSON.parse(text) as { detail?: string; message?: string };
    return payload.detail ?? payload.message ?? text;
  } catch {
    return text;
  }
}
