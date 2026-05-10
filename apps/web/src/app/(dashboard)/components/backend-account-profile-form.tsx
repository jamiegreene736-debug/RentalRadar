"use client";

import { useActionState } from "react";
import { Save, ShieldCheck } from "lucide-react";

import { updateAccountProfileAction } from "@/app/actions";
import { SubmitButton } from "@/components/action-status";
import { GlassCard, PanelTitle } from "@/app/(dashboard)/components/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountProfileResponse } from "@/lib/types";

const initialState = { ok: false, message: "" };

const timezones = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Pacific/Honolulu", "Europe/London"];
const locales = ["en-US", "en-GB", "es-US", "fr-FR", "de-DE"];

export function BackendAccountProfileForm({
  profile,
  clerkDefaults,
}: {
  profile: AccountProfileResponse | null;
  clerkDefaults: {
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
}) {
  const [state, action] = useActionState(updateAccountProfileAction, initialState);
  const email = profile?.email || clerkDefaults.email;
  const firstName = profile?.first_name || clerkDefaults.firstName;
  const lastName = profile?.last_name || clerkDefaults.lastName;

  return (
    <GlassCard className="p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PanelTitle
          eyebrow="Backend profile"
          title="RentalRadar account details"
          copy="These fields power billing contact, owner reports, alerts, and account-level revenue workflows."
        />
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-700/15 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
          <ShieldCheck className="size-4" />
          Stored in app_users
        </div>
      </div>

      <form action={action} className="mt-6 grid gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="First name" id="firstName" defaultValue={firstName} required />
          <Field label="Last name" id="lastName" defaultValue={lastName} required />
          <Field label="Email" id="email" type="email" defaultValue={email} required />
          <Field label="Notification email" id="notificationEmail" type="email" defaultValue={profile?.notification_email || email} />
          <Field label="Phone number" id="phoneNumber" type="tel" defaultValue={profile?.phone_number || ""} />
          <Field label="Company" id="companyName" defaultValue={profile?.company_name || ""} />
          <Field label="Job title" id="jobTitle" defaultValue={profile?.job_title || ""} />
          <div className="grid gap-2">
            <Label htmlFor="timezone" className="text-slate-700">
              Timezone
            </Label>
            <select
              id="timezone"
              name="timezone"
              defaultValue={profile?.timezone || "America/New_York"}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            >
              {timezones.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="locale" className="text-slate-700">
              Locale
            </Label>
            <select
              id="locale"
              name="locale"
              defaultValue={profile?.locale || "en-US"}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            >
              {locales.map((locale) => (
                <option key={locale} value={locale}>
                  {locale}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-cyan-900/10 bg-cyan-50/50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="marketingOptIn"
            defaultChecked={profile?.marketing_opt_in ?? false}
            className="size-4 rounded border-slate-300 text-cyan-700"
          />
          Send product updates and revenue-management tips
        </label>

        {state.message ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p> : null}

        <div className="flex justify-end">
          <SubmitButton className="h-11 rounded-full bg-cyan-300 px-6 text-slate-950 hover:bg-cyan-200">
            <Save />
            Save backend profile
          </SubmitButton>
        </div>
      </form>
    </GlassCard>
  );
}

function Field({
  label,
  id,
  defaultValue,
  type = "text",
  required = false,
}: {
  label: string;
  id: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-slate-700">
        {label}
      </Label>
      <Input
        id={id}
        name={id}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="border-slate-200 bg-white text-slate-950 placeholder:text-slate-400"
      />
    </div>
  );
}
