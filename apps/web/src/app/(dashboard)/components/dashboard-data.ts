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

export const properties: DashboardProperty[] = [
  {
    id: "oceanview-miami",
    name: "Oceanview Two Bedroom",
    address: "1250 Ocean Drive, Miami Beach, FL",
    image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
    recommendedRate: 286,
    currentRate: 249,
    lastScrapedMinutes: 4,
    occupancy: 0.78,
    confidence: 0.91,
    channels: [
      { name: "Airbnb", status: "live", rate: 286 },
      { name: "VRBO", status: "live", rate: 274 },
      { name: "Booking", status: "syncing", rate: 301 },
      { name: "Direct", status: "live", rate: 263 },
    ],
  },
  {
    id: "desert-pool-palm",
    name: "Desert Pool House",
    address: "742 Camino Sol, Palm Springs, CA",
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
    recommendedRate: 412,
    currentRate: 365,
    lastScrapedMinutes: 8,
    occupancy: 0.83,
    confidence: 0.88,
    channels: [
      { name: "Airbnb", status: "live", rate: 419 },
      { name: "VRBO", status: "live", rate: 397 },
      { name: "Booking", status: "live", rate: 421 },
      { name: "Direct", status: "live", rate: 388 },
    ],
  },
  {
    id: "aspen-chalet",
    name: "Aspen Chalet",
    address: "88 Ridge Run, Aspen, CO",
    image: "https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=1200&q=80",
    recommendedRate: 729,
    currentRate: 660,
    lastScrapedMinutes: 13,
    occupancy: 0.69,
    confidence: 0.84,
    channels: [
      { name: "Airbnb", status: "live", rate: 742 },
      { name: "VRBO", status: "stale", rate: 701 },
      { name: "Booking", status: "live", rate: 760 },
      { name: "Direct", status: "syncing", rate: 694 },
    ],
  },
  {
    id: "savannah-loft",
    name: "Historic District Loft",
    address: "19 Barnard Street, Savannah, GA",
    image: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80",
    recommendedRate: 219,
    currentRate: 199,
    lastScrapedMinutes: 22,
    occupancy: 0.74,
    confidence: 0.86,
    channels: [
      { name: "Airbnb", status: "live", rate: 224 },
      { name: "VRBO", status: "live", rate: 215 },
      { name: "Booking", status: "live", rate: 232 },
      { name: "Direct", status: "live", rate: 205 },
    ],
  },
];

export const marketPulse = [
  { date: "May 7", airbnb: 248, vrbo: 236, booking: 261, direct: 229, optimized: 258 },
  { date: "May 8", airbnb: 252, vrbo: 241, booking: 268, direct: 232, optimized: 266 },
  { date: "May 9", airbnb: 286, vrbo: 274, booking: 301, direct: 263, optimized: 286 },
  { date: "May 10", airbnb: 310, vrbo: 298, booking: 322, direct: 276, optimized: 309 },
  { date: "May 11", airbnb: 268, vrbo: 251, booking: 280, direct: 240, optimized: 272 },
  { date: "May 12", airbnb: 255, vrbo: 246, booking: 271, direct: 233, optimized: 263 },
  { date: "May 13", airbnb: 244, vrbo: 235, booking: 258, direct: 228, optimized: 251 },
];

export const scrapedRows = [
  { date: "2026-05-09", source: "Airbnb", rate: "$286", available: "Available", confidence: "94%" },
  { date: "2026-05-09", source: "VRBO", rate: "$274", available: "Available", confidence: "91%" },
  { date: "2026-05-09", source: "Booking", rate: "$301", available: "2 rooms left", confidence: "88%" },
  { date: "2026-05-10", source: "Airbnb", rate: "$310", available: "Available", confidence: "93%" },
  { date: "2026-05-10", source: "Direct", rate: "$276", available: "Available", confidence: "96%" },
];

export const recommendations = [
  { date: "Fri May 9", current: "$249", recommended: "$286", reason: "Weekend compression + live Airbnb premium", confidence: "91%" },
  { date: "Sat May 10", current: "$259", recommended: "$309", reason: "Booking.com scarcity signal", confidence: "88%" },
  { date: "Sun May 11", current: "$229", recommended: "$272", reason: "VRBO comps moving up", confidence: "84%" },
  { date: "Mon May 12", current: "$219", recommended: "$263", reason: "Gap-fill discount removed", confidence: "86%" },
];

export const agentEvents = [
  {
    time: "12 sec ago",
    title: "Self-Healing Agent trained new VRBO calendar locators",
    detail: "Detected shifted date-cell attributes and patched three resilient selectors.",
    code: "await page.locator('[data-qa=\"calendar-day\"], .DayPicker-Day').filter({ hasText: '$' })",
    status: "trained",
  },
  {
    time: "2 min ago",
    title: "Scraper Executor verified headed Chrome run",
    detail: "Real user-like scroll and hover path completed on Airbnb host calendar.",
    code: "await human.scroll(page); await page.mouse.move(420, 620, { steps: 38 })",
    status: "verified",
  },
  {
    time: "7 min ago",
    title: "Site Analyzer mapped Booking.com price cards",
    detail: "Found new nested rate blocks and updated extraction hints.",
    code: "const priceCards = document.querySelectorAll('[data-testid*=price]')",
    status: "analyzed",
  },
];

export const connectionCards = [
  { name: "Hostaway", status: "Connected", detail: "Official REST API • rates + availability", tone: "live" },
  { name: "Streamline", status: "Ready", detail: "Open API key validation", tone: "ready" },
  { name: "CiiRUS", status: "Ready", detail: "Official API connection", tone: "ready" },
  { name: "Guesty", status: "Connected", detail: "Open API sync every 30 min", tone: "live" },
  { name: "OwnerRez", status: "Ready", detail: "Availability/rates endpoint", tone: "ready" },
  { name: "Lodgify", status: "Ready", detail: "Calendar + pricing API", tone: "ready" },
];
