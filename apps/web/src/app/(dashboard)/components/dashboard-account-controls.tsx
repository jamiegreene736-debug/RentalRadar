"use client";

import Link from "next/link";
import { SignOutButton, UserButton, useUser } from "@clerk/nextjs";
import { LogOut, UserCircle } from "lucide-react";

export function DashboardAccountControls({ clerkEnabled }: { clerkEnabled: boolean }) {
  if (!clerkEnabled) {
    return (
      <Link
        href="/sign-in"
        className="inline-flex h-10 items-center gap-2 rounded-full border border-cyan-900/10 bg-white/80 px-4 text-sm font-medium text-slate-700 transition hover:bg-cyan-50 hover:text-cyan-900"
      >
        <UserCircle className="size-4" />
        Sign in
      </Link>
    );
  }

  return <ClerkDashboardAccountControls />;
}

function ClerkDashboardAccountControls() {
  const { user } = useUser();
  const displayName = user?.firstName || user?.primaryEmailAddress?.emailAddress || "Account";

  return (
    <div className="flex items-center gap-2">
      <UserButton
        userProfileMode="navigation"
        userProfileUrl="/dashboard/account"
        appearance={{
          elements: {
            userButtonAvatarBox: "size-9 border border-cyan-900/10 shadow-[0_10px_26px_rgba(14,116,144,0.12)]",
            userButtonPopoverCard: "border border-cyan-900/10 bg-white text-slate-950 shadow-[0_24px_80px_rgba(14,116,144,0.18)]",
          },
        }}
      />
      <Link
        href="/dashboard/account"
        className="hidden h-10 items-center gap-2 rounded-full border border-cyan-900/10 bg-white/80 px-4 text-sm font-medium text-slate-700 transition hover:bg-cyan-50 hover:text-cyan-900 sm:inline-flex"
      >
        <UserCircle className="size-4" />
        <span className="max-w-32 truncate">{displayName}</span>
      </Link>
      <SignOutButton redirectUrl="/">
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-full border border-cyan-900/10 bg-white/80 px-4 text-sm font-medium text-slate-700 transition hover:bg-cyan-50 hover:text-cyan-900"
        >
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </SignOutButton>
    </div>
  );
}
