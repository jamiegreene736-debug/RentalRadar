"use client";

import { useActionState } from "react";
import { Building2, MapPin, Plus } from "lucide-react";

import { addPropertyAction } from "@/app/actions";
import { SubmitButton } from "@/components/action-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState = { ok: false, message: "" };

export function PropertySearchForm() {
  const [state, action] = useActionState(addPropertyAction, initialState);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <MapPin className="size-5 text-primary" />
          <CardTitle>Property Scan</CardTitle>
        </div>
        <CardDescription>Add an address and start a live comp scan.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" defaultValue="1250 Ocean Drive, Miami Beach, FL" required />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="name">Property Name</Label>
              <Input id="name" name="name" defaultValue="Oceanview Two Bedroom" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sleeps">Sleeps</Label>
              <Input id="sleeps" name="sleeps" type="number" min="1" defaultValue="6" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="grid gap-2">
              <Label htmlFor="bedrooms">Beds</Label>
              <Input id="bedrooms" name="bedrooms" type="number" min="0" defaultValue="2" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bathrooms">Baths</Label>
              <Input id="bathrooms" name="bathrooms" type="number" min="0" step="0.5" defaultValue="2" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="baseRate">Base</Label>
              <Input id="baseRate" name="baseRate" type="number" min="0" defaultValue="219" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-2">
              <Label htmlFor="minRate">Min</Label>
              <Input id="minRate" name="minRate" type="number" min="0" defaultValue="149" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maxRate">Max</Label>
              <Input id="maxRate" name="maxRate" type="number" min="0" defaultValue="549" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="compUrls">Comp URLs</Label>
            <Textarea
              id="compUrls"
              name="compUrls"
              placeholder="https://www.airbnb.com/rooms/..."
              defaultValue={"https://www.airbnb.com/s/Miami-Beach/homes\nhttps://www.vrbo.com/search/keywords:Miami-Beach\nhttps://www.booking.com/searchresults.html?ss=Miami+Beach"}
            />
          </div>
          {state.message ? (
            <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{state.message}</p>
          ) : null}
          <div className="flex items-center gap-2">
            <SubmitButton>
              <Plus />
              Start Scan
            </SubmitButton>
            <Button type="button" variant="outline">
              <Building2 />
              Import PMS
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
