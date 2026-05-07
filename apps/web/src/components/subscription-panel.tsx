"use client";

import { useActionState } from "react";
import { Check, CreditCard, Gauge, Zap } from "lucide-react";

import { subscribeAction } from "@/app/actions";
import { SubmitButton } from "@/components/action-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { plans } from "@/lib/demo-data";

const initialState = { ok: false, message: "" };

export function SubscriptionPanel() {
  const [state, action] = useActionState(subscribeAction, initialState);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CreditCard className="size-5 text-primary" />
          <CardTitle>Subscription</CardTitle>
        </div>
        <CardDescription>Per-property pricing for live scans and channel pushes.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {plans.map((plan) => (
            <form
              key={plan.code}
              action={action}
              className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <input type="hidden" name="planCode" value={plan.code} />
              <input type="hidden" name="propertyQuantity" value="1" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{plan.name}</p>
                  <Badge variant={plan.code === "growth_6" ? "warning" : "secondary"}>
                    {plan.price === 0 ? "Free" : `$${plan.price}/property`}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Gauge className="size-4" />
                    {plan.scrapes}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Check className="size-4" />
                    {plan.comps}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Zap className="size-4" />
                    {plan.push ? "PMS push" : "Rate intelligence"}
                  </span>
                </div>
              </div>
              <SubmitButton>{plan.price === 0 ? "Start" : "Checkout"}</SubmitButton>
            </form>
          ))}
          {state.message ? (
            <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{state.message}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
