"use client";

import { UserProfile } from "@clerk/nextjs";

export function AccountProfile() {
  return (
    <UserProfile
      path="/dashboard/account"
      routing="path"
      appearance={{
        elements: {
          rootBox: "w-full",
          cardBox: "w-full shadow-none",
          card: "w-full border border-cyan-900/10 bg-white/92 text-slate-950 shadow-[0_28px_90px_rgba(14,116,144,0.14)]",
          navbar: "bg-cyan-50/60",
          navbarButton: "text-slate-600 hover:text-cyan-900",
          navbarButtonActive: "bg-cyan-100 text-cyan-900",
          headerTitle: "text-slate-950",
          headerSubtitle: "text-slate-500",
          profileSectionTitleText: "text-slate-950",
          profileSectionContent: "text-slate-600",
          formFieldLabel: "text-slate-700",
          formFieldInput: "border-slate-200 bg-white text-slate-950",
          formButtonPrimary: "bg-cyan-300 text-slate-950 hover:bg-cyan-200",
        },
      }}
    />
  );
}
