"use client";

import { useState } from "react";
import { Chrome, Send } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ExtensionPushButton() {
  const [state, setState] = useState<"idle" | "sent">("idle");

  return (
    <div className="rounded-3xl border border-cyan-200/20 bg-cyan-300/10 p-5">
      <Chrome className="size-7 text-cyan-100" />
      <p className="mt-4 text-lg font-semibold text-white">Push Rates Now</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        Sends approved pricing to the RentalRadar browser extension. The extension applies rates inside the real host dashboard.
      </p>
      <Button
        type="button"
        className="mt-5 h-12 w-full rounded-full bg-cyan-300 text-slate-950 hover:bg-cyan-200"
        onClick={() => {
          window.postMessage(
            {
              source: "rentalradar-dashboard",
              type: "RENTALRADAR_EXTENSION_PUSH_RATES",
              payload: { propertyId: "oceanview-miami", mode: "approved-recommendations" },
            },
            window.location.origin,
          );
          setState("sent");
        }}
      >
        <Send />
        {state === "sent" ? "Sent to extension" : "Push Rates Now"}
      </Button>
    </div>
  );
}
