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

export function PmsConnectPanel() {
  const [state, action] = useActionState(connectPmsAction, initialState);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <PlugZap className="size-5 text-primary" />
          <CardTitle>PMS Connections</CardTitle>
        </div>
        <CardDescription>Guesty, Hostaway, OwnerRez, Lodgify, and direct channels.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Provider</Label>
            <Select name="provider" defaultValue="guesty">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="guesty">Guesty</SelectItem>
                <SelectItem value="hostaway">Hostaway</SelectItem>
                <SelectItem value="ownerrez">OwnerRez</SelectItem>
                <SelectItem value="lodgify">Lodgify</SelectItem>
                <SelectItem value="airbnb">Airbnb</SelectItem>
                <SelectItem value="vrbo">VRBO</SelectItem>
                <SelectItem value="booking">Booking.com</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input id="displayName" name="displayName" defaultValue="Guesty Production" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="accountRef">Account Ref</Label>
            <Input id="accountRef" name="accountRef" defaultValue="rr-demo-account" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input id="apiKey" name="apiKey" type="password" placeholder="••••••••••••••••" required />
          </div>
          {state.message ? (
            <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{state.message}</p>
          ) : null}
          <div className="flex gap-2">
            <SubmitButton>
              <KeyRound />
              Save connection
            </SubmitButton>
            <a
              href="/api/auth/pms/oauth"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
            >
              <Link2 className="size-4" />
              OAuth
            </a>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
