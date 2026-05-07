"use client";

import { useEffect, useState } from "react";
import { Wifi } from "lucide-react";

export function RealtimeStatus() {
  const [state, setState] = useState<"ready" | "connected" | "offline">("ready");

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_REALTIME_EVENTS_URL;
    if (!url) return;
    const events = new EventSource(url);
    events.onopen = () => setState("connected");
    events.onerror = () => setState("offline");
    return () => events.close();
  }, []);

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-900/10 bg-cyan-50 px-3 py-1.5 text-xs text-cyan-800">
      <Wifi className="size-3.5" />
      Realtime {state}
    </div>
  );
}
