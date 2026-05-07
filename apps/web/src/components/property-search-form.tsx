"use client";

import { useActionState } from "react";
import { MapPin, Plus } from "lucide-react";

import { addPropertyAction } from "@/app/actions";
import { SubmitButton } from "@/components/action-status";
import { LiveScrapeScreens } from "@/components/live-scrape-screens";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ActionState } from "@/lib/types";

const initialState: ActionState = { ok: false, message: "" };

export function PropertySearchForm() {
  const [state, action] = useActionState(addPropertyAction, initialState);

  return (
    <Card className="border-cyan-900/10 bg-white/90 shadow-[0_28px_90px_rgba(14,116,144,0.14)]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <MapPin className="size-5 text-primary" />
          <CardTitle>Add your first property</CardTitle>
        </div>
        <CardDescription>Enter the address you want RentalRadar to analyze first.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" placeholder="123 Beach Road, Lahaina, HI" required />
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
            <Label htmlFor="compUrls">Known competitor URLs</Label>
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
        <LiveScrapeScreens propertyId={state.propertyId} />
      </CardContent>
    </Card>
  );
}
