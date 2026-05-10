"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CalendarDays, DollarSign, LoaderCircle, Save, SlidersHorizontal, ToggleLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { PricingControls, PropertyResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PricingControlsWorkspace({ properties }: { properties: PropertyResponse[] }) {
  const [selectedPropertyId, setSelectedPropertyId] = useState(properties[0]?.id ?? "");
  const [controls, setControls] = useState<PricingControls | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId) ?? properties[0],
    [properties, selectedPropertyId],
  );

  useEffect(() => {
    if (!selectedPropertyId) return;
    let cancelled = false;
    async function loadControls() {
      setStatus("loading");
      setMessage("");
      try {
        const response = await fetch(`/api/backend/properties/${selectedPropertyId}/pricing-controls`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) throw new Error(await readError(response));
        const payload = (await response.json()) as PricingControls;
        if (!cancelled) {
          setControls(payload);
          setStatus("idle");
        }
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "Unable to load pricing controls.");
        }
      }
    }
    void loadControls();
    return () => {
      cancelled = true;
    };
  }, [selectedPropertyId]);

  async function saveControls() {
    if (!controls) return;
    setStatus("saving");
    setMessage("");
    const { property_id: _propertyId, ...payload } = controls;
    try {
      const response = await fetch(`/api/backend/properties/${controls.property_id}/pricing-controls`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readError(response));
      setControls((await response.json()) as PricingControls);
      setStatus("saved");
      setMessage("Pricing controls saved.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to save pricing controls.");
    }
  }

  function updateControl<K extends keyof PricingControls>(key: K, value: PricingControls[K]) {
    setControls((current) => (current ? { ...current, [key]: value } : current));
  }

  if (!properties.length) {
    return (
      <section className="rounded-lg border border-cyan-900/10 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-950">Add a property before configuring pricing controls.</p>
      </section>
    );
  }

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Pricing Controls</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">Rate rules and guardrails</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {selectedProperty?.formatted_address ?? selectedProperty?.address_line1 ?? "Select a property"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          <button
            type="button"
            onClick={saveControls}
            disabled={!controls || status === "saving" || status === "loading"}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "saving" ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </button>
        </div>
      </div>

      {message ? (
        <div
          className={cn(
            "rounded-lg border p-3 text-sm",
            status === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700",
          )}
        >
          {message}
        </div>
      ) : null}

      {status === "loading" || !controls ? (
        <div className="grid min-h-72 place-items-center rounded-lg border border-cyan-900/10 bg-white text-slate-600 shadow-sm">
          <div className="text-center">
            <LoaderCircle className="mx-auto size-8 animate-spin text-cyan-700" />
            <p className="mt-3 text-sm font-medium">Loading pricing controls</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Panel icon={DollarSign} eyebrow="Core ADR" title="Base rate, floor, and ceiling">
              <div className="grid gap-3 md:grid-cols-2">
                <MoneyInput label="Base rate" value={controls.base_price_cents} onChange={(value) => updateControl("base_price_cents", value)} />
                <MoneyInput label="Floor price" value={controls.min_price_cents} onChange={(value) => updateControl("min_price_cents", value)} />
                <MoneyInput label="Ceiling price" value={controls.max_price_cents} onChange={(value) => updateControl("max_price_cents", value)} />
                <MoneyInput
                  label="Absolute minimum"
                  value={controls.absolute_min_price_cents}
                  onChange={(value) => updateControl("absolute_min_price_cents", value)}
                />
              </div>
            </Panel>

            <Panel icon={SlidersHorizontal} eyebrow="Market stack" title="Active layers">
              <div className="grid gap-2">
                <Toggle label="Seasonal rules" checked={controls.seasonal_rules_enabled} onChange={(value) => updateControl("seasonal_rules_enabled", value)} />
                <Toggle label="Event rules" checked={controls.event_rules_enabled} onChange={(value) => updateControl("event_rules_enabled", value)} />
                <Toggle label="Pacing adjustments" checked={controls.pacing_adjustments_enabled} onChange={(value) => updateControl("pacing_adjustments_enabled", value)} />
                <Toggle label="Review adjustments" checked={controls.review_adjustments_enabled} onChange={(value) => updateControl("review_adjustments_enabled", value)} />
                <Toggle label="Availability yielding" checked={controls.availability_yielding_enabled} onChange={(value) => updateControl("availability_yielding_enabled", value)} />
                <Toggle label="Channel fee preview" checked={controls.channel_fee_preview_enabled} onChange={(value) => updateControl("channel_fee_preview_enabled", value)} />
              </div>
            </Panel>
          </div>

          <div className="grid gap-4 2xl:grid-cols-3">
            <Panel icon={CalendarDays} eyebrow="Minimum stays" title="Length-of-stay rules">
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberInput label="Global min stay" suffix="nights" value={controls.global_min_stay} onChange={(value) => updateControl("global_min_stay", value)} />
                <NumberInput label="Weekday min stay" suffix="nights" value={controls.weekday_min_stay} onChange={(value) => updateControl("weekday_min_stay", value)} />
                <NumberInput label="Weekend min stay" suffix="nights" value={controls.weekend_min_stay} onChange={(value) => updateControl("weekend_min_stay", value)} />
                <NumberInput label="Gap-night min stay" suffix="nights" value={controls.gap_night_min_stay} onChange={(value) => updateControl("gap_night_min_stay", value)} />
              </div>
            </Panel>

            <Panel icon={ToggleLeft} eyebrow="Vacancy risk" title="Gap and last-minute rules">
              <div className="grid gap-3">
                <Toggle label="Orphan-gap rules" checked={controls.orphan_gap_enabled} onChange={(value) => updateControl("orphan_gap_enabled", value)} />
                <NumberInput
                  label="Gap-night discount"
                  suffix="%"
                  value={controls.gap_night_discount_percent}
                  onChange={(value) => updateControl("gap_night_discount_percent", value)}
                />
                <NumberInput
                  label="Last-minute window"
                  suffix="days"
                  value={controls.last_minute_window_days}
                  onChange={(value) => updateControl("last_minute_window_days", value)}
                />
                <NumberInput
                  label="Last-minute discount"
                  suffix="%"
                  value={controls.last_minute_discount_percent}
                  onChange={(value) => updateControl("last_minute_discount_percent", value)}
                />
              </div>
            </Panel>

            <Panel icon={SlidersHorizontal} eyebrow="Forward demand" title="Far-future protection">
              <div className="grid gap-3">
                <NumberInput
                  label="Far-future window"
                  suffix="days"
                  value={controls.far_future_window_days}
                  onChange={(value) => updateControl("far_future_window_days", value)}
                />
                <NumberInput
                  label="Far-future premium"
                  suffix="%"
                  value={controls.far_future_premium_percent}
                  onChange={(value) => updateControl("far_future_premium_percent", value)}
                />
                <div className="rounded-lg border border-cyan-900/10 bg-cyan-50/70 p-3 text-sm leading-6 text-cyan-950">
                  Base rate is fed by visible OTA samples, then these rules adjust the nightly rate before channel or PMS publishing.
                </div>
              </div>
            </Panel>
          </div>
        </>
      )}
    </section>
  );
}

function Panel({
  icon: Icon,
  eyebrow,
  title,
  children,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-cyan-900/10 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-cyan-50 text-cyan-700">
          <Icon className="size-4" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">{eyebrow}</p>
          <h2 className="mt-1 text-lg font-semibold leading-tight text-slate-950">{title}</h2>
        </div>
      </div>
      {children}
    </div>
  );
}

function MoneyInput({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 focus-within:border-cyan-500">
        <span className="text-sm font-semibold text-slate-500">$</span>
        <input
          type="number"
          min="0"
          step="1"
          value={value === null ? "" : Math.round(value / 100)}
          onChange={(event) => onChange(event.target.value === "" ? null : Math.round(Number(event.target.value) * 100))}
          className="min-w-0 flex-1 bg-transparent px-2 text-sm font-semibold text-slate-950 outline-none"
        />
      </div>
    </label>
  );
}

function NumberInput({ label, suffix, value, onChange }: { label: string; suffix: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 focus-within:border-cyan-500">
        <input
          type="number"
          min="0"
          step={suffix === "%" ? "0.5" : "1"}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-950 outline-none"
        />
        <span className="text-xs font-medium text-slate-500">{suffix}</span>
      </div>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-cyan-600"
      />
    </label>
  );
}

async function readError(response: Response) {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (typeof payload.detail === "string") return payload.detail;
    if (Array.isArray(payload.detail)) {
      return payload.detail
        .map((item) => (item && typeof item === "object" && "msg" in item && typeof item.msg === "string" ? item.msg : null))
        .filter(Boolean)
        .join(" ");
    }
  } catch {
    return `Request failed: ${response.status}`;
  }
  return `Request failed: ${response.status}`;
}
