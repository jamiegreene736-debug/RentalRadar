"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, MapPin, Plus, Search } from "lucide-react";

import { addPropertyAction } from "@/app/actions";
import { SubmitButton } from "@/components/action-status";
import { LiveScrapeScreens } from "@/components/live-scrape-screens";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ActionState, AddressSuggestion } from "@/lib/types";
import { cn } from "@/lib/utils";

const initialState: ActionState = { ok: false, message: "" };

type PropertySearchFormProps = {
  showScrapePreview?: boolean;
  initialAddress?: string;
  title?: string;
  description?: string;
};

export function PropertySearchForm({
  showScrapePreview = true,
  initialAddress = "",
  title = "Add your first property",
  description = "Enter the address you want RentalRadar to analyze first.",
}: PropertySearchFormProps) {
  const router = useRouter();
  const [state, action] = useActionState(addPropertyAction, initialState);
  const [address, setAddress] = useState(initialAddress);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [suggestionStatus, setSuggestionStatus] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const latestQuery = useRef("");

  useEffect(() => {
    const query = address.trim();
    latestQuery.current = query;
    setSelectedPlaceId(null);
    if (query.length < 3) {
      setSuggestions([]);
      setSuggestionStatus("idle");
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        setSuggestionStatus("loading");
        const response = await fetch(`/api/address-suggestions?query=${encodeURIComponent(query)}&limit=5`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Address lookup failed");
        const payload = (await response.json()) as AddressSuggestion[];
        if (latestQuery.current === query) {
          setSuggestions(payload);
          setSuggestionStatus(payload.length ? "ready" : "empty");
        }
      } catch {
        if (latestQuery.current === query) {
          setSuggestions([]);
          setSuggestionStatus("error");
        }
      }
    }, 260);

    return () => window.clearTimeout(timeout);
  }, [address]);

  const propertyId = state.propertyId;

  useEffect(() => {
    setAddress(initialAddress);
  }, [initialAddress]);

  useEffect(() => {
    if (state.ok && state.propertyId) {
      router.refresh();
    }
  }, [router, state.ok, state.propertyId]);

  return (
    <Card className="border-cyan-900/10 bg-white/90 shadow-[0_28px_90px_rgba(14,116,144,0.14)]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <MapPin className="size-5 text-primary" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4" onSubmit={() => setAnalysisStarted(true)}>
          <div className="grid gap-2">
            <Label htmlFor="address">Address</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="address"
                name="address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="123 Beach Road, Lahaina, HI"
                className="pl-10"
                autoComplete="off"
                required
              />
              {suggestionStatus === "loading" ? (
                <LoaderCircle className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-cyan-700" />
              ) : null}
              {suggestions.length ? (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-2xl border border-cyan-900/10 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.18)]">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.place_id}
                      type="button"
                      onClick={() => {
                        setAddress(suggestion.formatted_address);
                        setSelectedPlaceId(suggestion.place_id);
                        setSuggestions([]);
                        setSuggestionStatus("ready");
                      }}
                      className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm transition last:border-b-0 hover:bg-cyan-50"
                    >
                      <MapPin className="mt-0.5 size-4 shrink-0 text-cyan-700" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-slate-950">{primaryAddressLine(suggestion)}</span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">{suggestion.formatted_address}</span>
                      </span>
                      {selectedPlaceId === suggestion.place_id ? <Check className="size-4 text-emerald-600" /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <p
              className={cn(
                "text-xs",
                suggestionStatus === "empty" && address.trim().length >= 3 ? "text-amber-700" : "text-slate-500",
                suggestionStatus === "error" ? "text-rose-700" : null,
              )}
            >
              {suggestionHelpText(suggestionStatus, address)}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="name">Property name</Label>
              <Input id="name" name="name" placeholder="Optional" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sleeps">Sleeps</Label>
              <Input id="sleeps" name="sleeps" type="number" min="1" placeholder="Optional" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="grid gap-2">
              <Label htmlFor="bedrooms">Beds</Label>
              <Input id="bedrooms" name="bedrooms" type="number" min="0" placeholder="0" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bathrooms">Baths</Label>
              <Input id="bathrooms" name="bathrooms" type="number" min="0" step="0.5" placeholder="0" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="baseRate">Base</Label>
              <Input id="baseRate" name="baseRate" type="number" min="0" placeholder="$" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-2">
              <Label htmlFor="minRate">Min</Label>
              <Input id="minRate" name="minRate" type="number" min="0" placeholder="$" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maxRate">Max</Label>
              <Input id="maxRate" name="maxRate" type="number" min="0" placeholder="$" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="compUrls">Known market comp URLs</Label>
            <Textarea
              id="compUrls"
              name="compUrls"
              placeholder={"Optional\nhttps://www.airbnb.com/rooms/..."}
            />
          </div>
          {state.message ? (
            <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{state.message}</p>
          ) : null}
          <div className="flex items-center gap-2">
            <SubmitButton>
              <Plus />
              Analyze my address
            </SubmitButton>
          </div>
        </form>
        {showScrapePreview ? (
          <LiveScrapeScreens propertyId={propertyId} pending={analysisStarted && !propertyId && !state.message} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function primaryAddressLine(suggestion: AddressSuggestion) {
  const cityState = [suggestion.city, suggestion.region].filter(Boolean).join(", ");
  return [suggestion.address_line1 || suggestion.formatted_address.split(",")[0], cityState].filter(Boolean).join(" · ");
}

function suggestionHelpText(status: "idle" | "loading" | "ready" | "empty" | "error", address: string) {
  if (status === "loading") return "Looking up verified address matches...";
  if (status === "error") return "Address lookup is temporarily unavailable. You can still type the full address and analyze it.";
  if (status === "empty" && address.trim().length >= 3) {
    return "No exact match yet. Add the city and state, or type the full address and continue.";
  }
  return "Choose a verified address so the comp search is pointed at the right market.";
}
