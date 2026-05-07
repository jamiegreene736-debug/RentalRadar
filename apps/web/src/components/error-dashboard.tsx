import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorDashboardResponse } from "@/lib/types";

export function ErrorDashboard({ dashboard }: { dashboard: ErrorDashboardResponse | null }) {
  const total = dashboard ? Object.values(dashboard.counts).reduce((sum, count) => sum + count, 0) : 0;
  const latest = dashboard?.recent_errors[0];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {total ? <AlertTriangle className="size-5 text-amber-600" /> : <CheckCircle2 className="size-5 text-emerald-600" />}
            <CardTitle>Ops Health</CardTitle>
          </div>
          <Badge variant={total ? "warning" : "success"}>{total ? `${total} open` : "Clear"}</Badge>
        </div>
        <CardDescription>Scrape, PMS sync, rate push, and billing failures.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="grid grid-cols-2 gap-2 text-muted-foreground">
          {Object.entries(dashboard?.counts ?? { failed_scrapes: 0, failed_pms_syncs: 0, failed_rate_pushes: 0, failed_billing_events: 0 }).map(
            ([key, value]) => (
              <div key={key} className="rounded-md border px-3 py-2">
                <p className="font-medium text-foreground">{value}</p>
                <p className="capitalize">{key.replaceAll("_", " ")}</p>
              </div>
            ),
          )}
        </div>
        {latest ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            <p className="font-medium">{latest.source}</p>
            <p>{latest.message ?? latest.status}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
