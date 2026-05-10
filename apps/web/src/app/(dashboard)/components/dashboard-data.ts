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

export const liveCompRows = [
  {
    comp: "Beachfront 4BR",
    platform: "Airbnb",
    rate: "$438",
    move: "-18%",
    availability: "3 nights open",
    evidence: "Changed 22 min ago",
    tone: "alert",
  },
  {
    comp: "Canal View Villa",
    platform: "VRBO",
    rate: "$512",
    move: "+9%",
    availability: "Weekend sold",
    evidence: "Event compression",
    tone: "up",
  },
  {
    comp: "Heated Pool Home",
    platform: "Booking",
    rate: "$397",
    move: "-6%",
    availability: "Gap opened",
    evidence: "Calendar delta",
    tone: "neutral",
  },
  {
    comp: "Direct Site Cluster",
    platform: "Direct",
    rate: "$476",
    move: "+12%",
    availability: "Low supply",
    evidence: "Search spike",
    tone: "up",
  },
];

export const marketAlerts = [
  { label: "Comp price drop", detail: "2 nearby 4BR homes dropped more than 15% for May 24-27.", action: "Review last-minute gap" },
  { label: "Demand velocity", detail: "Weekend search pace is 31% above the trailing 14-day baseline.", action: "Hold floor rate" },
  { label: "Availability gap", detail: "Your Tuesday-Wednesday gap is now cheaper than 6 of 8 closest comps.", action: "Push +7%" },
];

export const pricingExplanations = [
  {
    date: "May 24",
    current: "$420",
    recommended: "$449",
    lift: "+$29",
    confidence: "94%",
    evidence: ["4 live comps sold out", "Direct search intent up 31%", "No matching 4BR under $455"],
    action: "Raise price and keep 2-night minimum",
  },
  {
    date: "May 28",
    current: "$389",
    recommended: "$365",
    lift: "Protect occupancy",
    confidence: "88%",
    evidence: ["3 comparable calendars reopened", "Midweek pickup slowed", "Your rate is 11% above median"],
    action: "Lower for 18 hours, then recheck",
  },
];

export const extensionPushQueue = [
  { channel: "Airbnb", dates: "May 24-27", change: "+7%", status: "Ready" },
  { channel: "VRBO", dates: "May 28-30", change: "-6%", status: "Needs review" },
  { channel: "Booking", dates: "Jun 01-03", change: "+11%", status: "Ready" },
];

export const triggerRules = [
  "If 2+ comps drop over 15% in 24 hours, protect occupancy within floor.",
  "If search velocity beats baseline by 25%, hold or raise event dates.",
  "If orphan gap is under 3 nights, prioritize fill-rate over ADR.",
];

export const whatIfScenarios = [
  { label: "Conservative", revenue: "$8.7k", lift: "+6%", risk: "Low" },
  { label: "Balanced AI", revenue: "$9.4k", lift: "+14%", risk: "Medium" },
  { label: "Aggressive events", revenue: "$10.1k", lift: "+21%", risk: "High" },
];

export const portfolioInsights = [
  { label: "ADR vs live comps", value: "+8.4%", note: "Above median without losing pace" },
  { label: "Occupancy risk", value: "2 dates", note: "Need live-trigger review today" },
  { label: "Owner report delta", value: "+$1,240", note: "Projected monthly upside" },
];

export const connectionCards = [
  { name: "Hostaway", status: "Available", detail: "Official REST API for rates and availability.", tone: "ready" },
  { name: "Streamline", status: "Available", detail: "Open API key validation.", tone: "ready" },
  { name: "CiiRUS", status: "Available", detail: "Official API connection.", tone: "ready" },
  { name: "Guesty", status: "Available", detail: "Open API sync for rates and availability.", tone: "ready" },
  { name: "OwnerRez", status: "Available", detail: "Availability and rates endpoint.", tone: "ready" },
  { name: "Lodgify", status: "Available", detail: "Calendar and pricing API.", tone: "ready" },
];
