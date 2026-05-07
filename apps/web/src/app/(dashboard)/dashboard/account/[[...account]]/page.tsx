import Link from "next/link";

import { AccountProfile } from "@/app/(dashboard)/components/account-profile";
import { GlassCard, PanelTitle } from "@/app/(dashboard)/components/glass-card";
import { Button } from "@/components/ui/button";
import { isClerkEnabled } from "@/lib/auth-config";

export const metadata = {
  title: "Account",
  description: "Manage your RentalRadar account profile.",
};

export default function AccountPage() {
  if (!isClerkEnabled) {
    return (
      <GlassCard className="p-6">
        <PanelTitle
          eyebrow="Account"
          title="Account settings need Clerk"
          copy="Add the Clerk keys in Railway to enable profile editing, connected login methods, and sign out."
        />
        <Button asChild className="mt-6 h-12 rounded-full bg-cyan-300 px-6 text-slate-950 hover:bg-cyan-200">
          <Link href="/sign-in">Go to sign in</Link>
        </Button>
      </GlassCard>
    );
  }

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-700">Account</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">Profile and sign-in details</h1>
        <p className="mt-3 max-w-3xl text-slate-600">
          Update your name, email addresses, connected Google login, password, and security settings.
        </p>
      </div>
      <AccountProfile />
    </div>
  );
}
