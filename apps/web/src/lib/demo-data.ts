import { Plan } from "@/lib/types";

export const plans: Plan[] = [
  { code: "free_1", name: "Free", price: 0, scrapes: "Limited", comps: "5 comps", push: false },
  { code: "starter_3", name: "Starter", price: 3, scrapes: "Daily", comps: "10 comps", push: false },
  { code: "growth_6", name: "Growth", price: 6, scrapes: "4x daily", comps: "25 comps", push: true },
  { code: "pro_9", name: "Pro", price: 9, scrapes: "Hourly", comps: "50 comps", push: true },
];
