"use client";

import { useActionState } from "react";
import { KeyRound, Link2, PlugZap } from "lucide-react";

import { connectPmsAction } from "@/app/actions";
import { SubmitButton } from "@/components/action-status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState = { ok: false, message: "" };

const providers = [
  { value: "hostaway", label: "Hostaway" },
  { value: "streamline", label: "Streamline" },
  { value: "ciirus", label: "CiiRUS" },
  { value: "guesty", label: "Guesty" },
  { value: "ownerrez", label: "OwnerRez" },
  { value: "lodgify", label: "Lodgify" },
  { value: "hostfully", label: "Hostfully" },
  { value: "airbnb", label: "Airbnb OAuth (partner)" },
  { value: "vrbo", label: "VRBO OAuth (partner)" },
  { value: "booking", label: "Booking.com Connectivity" },
];

export function PmsConnectPanel() {
  const [state, action] = useActionState(connectPmsAction, initialState);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <PlugZap className="size-5 text-primary" />
          <CardTitle>PMS Connections</CardTitle>
        </div>
        <CardDescription>Official API connections for user-owned properties. No PMS passwords are stored.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Provider</Label>
            <Select name="provider" defaultValue="hostaway">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider.value} value={provider.value}>
                    {provider.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input id="displayName" name="displayName" placeholder="Your PMS account name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="accountRef">Account Ref</Label>
            <Input id="accountRef" name="accountRef" placeholder="Optional account identifier" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="apiKey">Official API Key / Access Token</Label>
            <Input id="apiKey" name="apiKey" type="password" placeholder="Paste official API key" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="apiSecret">API Secret</Label>
            <Input id="apiSecret" name="apiSecret" type="password" placeholder="Optional client secret" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="webhookSecret">Webhook Secret</Label>
            <Input id="webhookSecret" name="webhookSecret" type="password" placeholder="Optional signing secret" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="baseUrl">API Base URL</Label>
            <Input id="baseUrl" name="baseUrl" placeholder="Optional for partner/sandbox accounts" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="validationPath">Validation Path</Label>
            <Input id="validationPath" name="validationPath" placeholder="/listings or provider-specific test endpoint" />
          </div>
          <p className="text-xs text-muted-foreground">
            We never store PMS passwords. RentalRadar encrypts official API keys, OAuth tokens, API secrets, and webhook secrets in Postgres.
          </p>
          {state.message ? (
            <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{state.message}</p>
          ) : null}
          <div className="flex gap-2">
            <SubmitButton>
              <KeyRound />
              Save connection
            </SubmitButton>
            <a
              href="/api/auth/pms/oauth?provider=airbnb"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
            >
              <Link2 className="size-4" />
              Airbnb OAuth
            </a>
            <a
              href="/api/auth/pms/oauth?provider=vrbo"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
            >
              <Link2 className="size-4" />
              VRBO OAuth
            </a>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
