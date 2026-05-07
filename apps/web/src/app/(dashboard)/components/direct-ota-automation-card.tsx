"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertTriangle, Eye, EyeOff, KeyRound, LockKeyhole, RadioTower, ShieldAlert, Trash2 } from "lucide-react";

import {
  connectDirectOtaAction,
  pushDirectPricingAction,
  revokeDirectOtaAction,
  submitDirectOta2faAction,
} from "@/app/actions";
import { SubmitButton } from "@/components/action-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OtaDirectCredential } from "@/lib/types";

const initialState = { ok: false, message: "" };

const statusTone: Record<string, string> = {
  pending: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  active: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  "2fa_required": "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  failed: "border-red-300/30 bg-red-400/10 text-red-100",
  revoked: "border-slate-300/20 bg-slate-500/10 text-slate-300",
};

export function DirectOtaAutomationCard({
  propertyId,
  credentials,
  highRiskNotice,
}: {
  propertyId: string;
  credentials: OtaDirectCredential[];
  highRiskNotice: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [connectState, connectAction] = useActionState(connectDirectOtaAction, initialState);
  const [twoFaState, twoFaAction] = useActionState(submitDirectOta2faAction, initialState);
  const [pushState, pushAction] = useActionState(pushDirectPricingAction, initialState);
  const [revokeState, revokeAction] = useActionState(revokeDirectOtaAction, initialState);
  const latest = credentials[0];
  const sampleRates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() + index + 1);
        return {
          stay_date: date.toISOString().slice(0, 10),
          rate_cents: 28900 + index * 400,
        };
      }),
    [],
  );

  return (
    <section className="overflow-hidden rounded-[2rem] border border-red-300/25 bg-red-950/20 shadow-[0_0_60px_rgba(248,113,113,0.14)]">
      <div className="border-b border-red-300/15 bg-red-400/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-red-100">
              <ShieldAlert className="size-5" />
              <p className="text-sm font-semibold uppercase tracking-[0.22em]">Advanced / High-Risk</p>
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-normal text-white">Direct Server-Side Automation (High-Risk)</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-red-100/80">
              {highRiskNotice} Use this only when you refuse to install the Chrome/Safari extension.
            </p>
          </div>
          <Badge className={statusTone[latest?.status ?? "pending"] ?? statusTone.pending}>
            {latest ? latest.status.replace("_", " ") : "Not connected"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 p-5 xl:grid-cols-[1.1fr_0.9fr]">
        <form action={connectAction} className="grid gap-4 rounded-3xl border border-white/10 bg-slate-950/60 p-5">
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="dryRun" value="on" />
          <div className="rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-sm leading-6 text-red-50">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-200" />
              <span>
                This may violate Airbnb, VRBO, or Booking.com terms and risks account suspension. RentalRadar strongly recommends official APIs or the browser extension.
              </span>
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-slate-200">Platform</Label>
            <Select name="platform" defaultValue="airbnb">
              <SelectTrigger className="border-white/10 bg-white/[0.04] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="airbnb">Airbnb</SelectItem>
                <SelectItem value="vrbo">VRBO</SelectItem>
                <SelectItem value="booking">Booking.com</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="directEmail" className="text-slate-200">
              Account Email
            </Label>
            <Input id="directEmail" name="email" type="email" className="border-white/10 bg-white/[0.04] text-white" required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="directPassword" className="text-slate-200">
              Password
            </Label>
            <div className="flex rounded-md border border-white/10 bg-white/[0.04]">
              <Input
                id="directPassword"
                name="password"
                type={showPassword ? "text" : "password"}
                className="border-0 bg-transparent text-white focus-visible:ring-0"
                required
              />
              <Button type="button" variant="ghost" size="icon" className="text-slate-300" onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </div>

          <label className="flex gap-3 rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-sm leading-6 text-red-50">
            <input name="consentAccepted" type="checkbox" className="mt-1 size-4 accent-red-400" required />
            <span>I understand this may violate Airbnb/VRBO/Booking.com terms and risks account suspension.</span>
          </label>

          {connectState.message ? (
            <p className={connectState.ok ? "text-sm text-emerald-200" : "text-sm text-red-200"}>{connectState.message}</p>
          ) : null}

          <SubmitButton className="h-12 rounded-full bg-red-300 text-slate-950 hover:bg-red-200">
            <LockKeyhole />
            Save encrypted credentials + Test Login
          </SubmitButton>
        </form>

        <div className="grid gap-4">
          <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
            <div className="flex items-center gap-2 text-white">
              <RadioTower className="size-5 text-cyan-200" />
              <p className="font-semibold">Status & 2FA</p>
            </div>
            <div className="mt-4 grid gap-3">
              {credentials.length ? (
                credentials.map((credential) => (
                  <div key={credential.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium capitalize text-white">{credential.platform}</p>
                        <p className="text-xs text-slate-400">
                          Last login {credential.last_successful_login ? new Date(credential.last_successful_login).toLocaleString() : "not verified yet"}
                        </p>
                      </div>
                      <Badge className={statusTone[credential.status]}>{credential.status.replace("_", " ")}</Badge>
                    </div>
                    {credential.last_error ? <p className="mt-3 text-sm text-red-200">{credential.last_error}</p> : null}
                    <form action={revokeAction} className="mt-3">
                      <input type="hidden" name="credentialId" value={credential.id} />
                      <SubmitButton className="h-9 rounded-full border border-red-300/25 bg-transparent px-3 text-red-100 hover:bg-red-400/10">
                        <Trash2 />
                        Revoke Access & Delete Credentials
                      </SubmitButton>
                    </form>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
                  No server-side direct credentials stored. Extension mode is still the recommended path.
                </p>
              )}
            </div>
            {revokeState.message ? (
              <p className={revokeState.ok ? "mt-3 text-sm text-emerald-200" : "mt-3 text-sm text-red-200"}>{revokeState.message}</p>
            ) : null}
          </div>

          <form action={twoFaAction} className="rounded-3xl border border-cyan-200/15 bg-cyan-300/10 p-5">
            <input type="hidden" name="propertyId" value={propertyId} />
            <div className="grid gap-2">
              <Label className="text-cyan-50">2FA Code</Label>
              <Input name="code" inputMode="numeric" maxLength={6} placeholder="123456" className="border-cyan-200/20 bg-slate-950/60 text-white" />
            </div>
            <SubmitButton className="mt-4 h-11 rounded-full bg-cyan-300 text-slate-950 hover:bg-cyan-200">
              <KeyRound />
              Submit Code to Live Browser
            </SubmitButton>
            {twoFaState.message ? (
              <p className={twoFaState.ok ? "mt-3 text-sm text-emerald-200" : "mt-3 text-sm text-red-200"}>{twoFaState.message}</p>
            ) : null}
          </form>

          <form action={pushAction} className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
            <input type="hidden" name="propertyId" value={propertyId} />
            <input type="hidden" name="rates" value={JSON.stringify(sampleRates)} />
            <label className="flex gap-3 text-sm leading-6 text-red-100">
              <input name="consentAccepted" type="checkbox" className="mt-1 size-4 accent-red-400" required />I accept the high-risk direct push warning for this manual run.
            </label>
            <SubmitButton className="mt-4 h-11 rounded-full bg-white text-slate-950 hover:bg-slate-200">
              Push sample rates in headed Chrome
            </SubmitButton>
            {pushState.message ? (
              <p className={pushState.ok ? "mt-3 text-sm text-emerald-200" : "mt-3 text-sm text-red-200"}>{pushState.message}</p>
            ) : null}
          </form>
        </div>
      </div>
    </section>
  );
}
