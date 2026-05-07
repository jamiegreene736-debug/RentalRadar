import Link from "next/link";
import { CheckCircle2, Chrome, Compass, KeyRound, PlugZap } from "lucide-react";

import { connectionCards } from "@/app/(dashboard)/components/dashboard-data";
import { GlassCard, PanelTitle } from "@/app/(dashboard)/components/glass-card";
import { PmsConnectPanel } from "@/components/pms-connect-panel";
import { Button } from "@/components/ui/button";

export default function ConnectionsHubPage() {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">Connections Hub</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal text-white sm:text-5xl">Official APIs plus direct OTA mode</h1>
        <p className="mt-3 max-w-3xl text-slate-400">
          Connect Hostaway, Streamline, CiiRUS, Guesty, OwnerRez, and Lodgify with official API keys. Use browser extensions for direct OTA pushing when no PMS is connected.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="[&_section]:border-white/[0.12] [&_section]:bg-white/[0.045] [&_section]:text-white">
          <PmsConnectPanel />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {connectionCards.map((connection) => (
            <GlassCard key={connection.name} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xl font-semibold text-white">{connection.name}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{connection.detail}</p>
                </div>
                <span className={connection.tone === "live" ? "text-emerald-200" : "text-cyan-200"}>
                  <CheckCircle2 className="size-5" />
                </span>
              </div>
              <div className="mt-5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300">
                {connection.status}
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      <GlassCard className="p-6">
        <PanelTitle eyebrow="Direct OTA Mode" title="Install the browser extension" copy="Use your real logged-in Chrome or Safari session to apply approved rates on Airbnb, VRBO, and Booking.com host dashboards." />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <ExtensionInstallCard icon={Chrome} title="Install Chrome Extension" href="/extension/chrome" status="Connected to Airbnb via Extension ✓" />
          <ExtensionInstallCard icon={Compass} title="Install Safari Extension" href="/extension/safari" status="Safari support ready for macOS hosts" />
        </div>
      </GlassCard>
    </div>
  );
}

function ExtensionInstallCard({ icon: Icon, title, href, status }: { icon: typeof Chrome; title: string; href: string; status: string }) {
  return (
    <div className="rounded-3xl border border-cyan-200/20 bg-cyan-300/10 p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-white text-slate-950">
          <Icon className="size-6" />
        </span>
        <div>
          <p className="text-lg font-semibold text-white">{title}</p>
          <p className="text-sm text-slate-400">{status}</p>
        </div>
      </div>
      <Button asChild className="mt-6 h-12 rounded-full bg-cyan-300 text-slate-950 hover:bg-cyan-200">
        <Link href={href}>
          <KeyRound />
          Install in 30 seconds
        </Link>
      </Button>
    </div>
  );
}
