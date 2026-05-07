export type ChannelStatus = {
  name: "Airbnb" | "VRBO" | "Booking" | "Direct";
  status: "live" | "syncing" | "stale";
  rate: number;
};

export type DashboardProperty = {
  id: string;
  name: string;
  address: string;
  image: string;
  recommendedRate: number;
  currentRate: number;
  lastScrapedMinutes: number;
  occupancy: number;
  confidence: number;
  channels: ChannelStatus[];
};

export const properties: DashboardProperty[] = [];

export const marketPulse: Array<{ date: string; airbnb?: number; vrbo?: number; booking?: number; direct?: number; optimized?: number }> = [];

export const scrapedRows: Array<{ date: string; source: string; rate: string; available: string; confidence: string }> = [];

export const recommendations: Array<{ date: string; current: string; recommended: string; reason: string; confidence: string }> = [];

export const agentEvents: Array<{ time: string; title: string; detail: string; code: string; status: string }> = [];

export const connectionCards = [
  { name: "Hostaway", status: "Available", detail: "Official REST API for rates and availability.", tone: "ready" },
  { name: "Streamline", status: "Available", detail: "Open API key validation.", tone: "ready" },
  { name: "CiiRUS", status: "Available", detail: "Official API connection.", tone: "ready" },
  { name: "Guesty", status: "Available", detail: "Open API sync for rates and availability.", tone: "ready" },
  { name: "OwnerRez", status: "Available", detail: "Availability and rates endpoint.", tone: "ready" },
  { name: "Lodgify", status: "Available", detail: "Calendar and pricing API.", tone: "ready" },
];
