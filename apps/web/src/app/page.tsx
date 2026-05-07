import { RefreshCcw, SatelliteDish } from "lucide-react";

import { refreshPricingAction } from "@/app/actions";
import { AddressMap } from "@/components/address-map";
import { CompetitiveInsight } from "@/components/competitive-insight";
import { MarketRateChart } from "@/components/market-rate-chart";
import { MetricsStrip } from "@/components/metrics-strip";
import { PmsConnectPanel } from "@/components/pms-connect-panel";
import { PropertySearchForm } from "@/components/property-search-form";
import { RecommendationsTable } from "@/components/recommendations-table";
import { SourceBreakdown } from "@/components/source-breakdown";
import { SubscriptionPanel } from "@/components/subscription-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { demoProperty } from "@/lib/demo-data";
import { getMarketRates } from "@/lib/api";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ propertyId?: string }>;
}) {
  const params = await searchParams;
  const propertyId = params?.propertyId ?? demoProperty.id;
  const market = await getMarketRates(propertyId);
  const property = demoProperty.id === propertyId ? demoProperty : { ...demoProperty, id: propertyId };
  const nextRecommendation = market.recommendations[0];

  return (
    <main className="min-h-screen">
      <div className="border-b bg-white/82 backdrop-blur">
        <div className="container flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">RentalRadar.ai</h1>
              <Badge variant="success">
                <SatelliteDish className="mr-1 size-3" />
                Live market scan
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{property.formatted_address ?? property.address_line1}</p>
          </div>
          <form action={refreshPricingAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="propertyId" value={property.id} />
            <Button type="submit" variant="outline">
              <RefreshCcw />
              Refresh rates
            </Button>
          </form>
        </div>
      </div>

      <div className="container grid gap-5 py-5">
        <MetricsStrip market={market} />

        <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
          <div className="grid content-start gap-5">
            <PropertySearchForm />
            <AddressMap address={property.formatted_address ?? property.address_line1} />
          </div>

          <div className="grid gap-5">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Live Market Rates</CardTitle>
                  <CardDescription>Airbnb, VRBO, Booking.com, and direct PMS comps.</CardDescription>
                </div>
                <Badge variant={market.cached ? "warning" : "success"}>{market.cached ? "Cached" : "Fresh"}</Badge>
              </CardHeader>
              <CardContent>
                <MarketRateChart market={market} />
              </CardContent>
            </Card>
            <SourceBreakdown market={market} />
            <CompetitiveInsight recommendation={nextRecommendation} />
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <Card id="recommendations">
            <CardContent className="pt-5">
              <RecommendationsTable propertyId={property.id} recommendations={market.recommendations} />
            </CardContent>
          </Card>
          <div className="grid content-start gap-5">
            <PmsConnectPanel />
            <SubscriptionPanel />
          </div>
        </div>
      </div>
    </main>
  );
}
