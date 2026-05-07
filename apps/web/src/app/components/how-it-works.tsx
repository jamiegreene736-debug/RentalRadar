import { Bot, Chrome, Code2, MousePointerClick, Puzzle, Sparkles } from "lucide-react";

import { SectionReveal } from "@/app/components/section-reveal";

const steps = [
  {
    icon: Bot,
    title: "AI Agents Analyze & Train",
    copy: "Site Analyzer reads the DOM, then Playwright Trainer generates resilient JavaScript and Python locator strategies.",
    visual: ["const locator = ai.train(dom)", "await page.locator(priceCell)", "confidence: 0.94"],
  },
  {
    icon: Chrome,
    title: "Real Headed Chrome Scrapes Live",
    copy: "RentalRadar sees the same live rates a traveler sees on Airbnb, VRBO, Booking.com, and public comp pages.",
    visual: ["chrome.headed = true", "calendar.scan(365)", "freshness: live"],
  },
  {
    icon: Puzzle,
    title: "Auto-Push via Extension",
    copy: "Chrome and Safari extensions can apply optimized rates directly on host dashboards when no PMS is connected.",
    visual: ["extension.apply(rate)", "minStay.set(2)", "submit.naturalClick()"],
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative border-t border-white/10 bg-[#070b1a] py-24 sm:py-32">
      <div className="container">
        <SectionReveal className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">How it works</p>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-normal text-white sm:text-5xl">
            Adaptive AI scraping, then direct pricing execution.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            Static feeds and generic calendars can miss what travelers see today. RentalRadar trains agents against the page that exists right now.
          </p>
        </SectionReveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {steps.map((step, index) => (
            <SectionReveal key={step.title} className="group rounded-[28px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.25)]">
              <div className="mb-8 flex items-center justify-between">
                <div className="grid size-12 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-200/20">
                  <step.icon className="size-6" />
                </div>
                <span className="text-sm text-slate-500">0{index + 1}</span>
              </div>
              <h3 className="text-2xl font-semibold text-white">{step.title}</h3>
              <p className="mt-3 min-h-24 text-sm leading-7 text-slate-300">{step.copy}</p>
              <div className="mt-6 rounded-2xl border border-cyan-200/[0.12] bg-black/[0.35] p-4 font-mono text-xs text-cyan-100">
                {step.visual.map((line) => (
                  <div key={line} className="flex items-center gap-2 py-1.5">
                    {line.includes("submit") ? <MousePointerClick className="size-3 text-teal-200" /> : <Code2 className="size-3 text-cyan-200" />}
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </SectionReveal>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-cyan-100">
          <Sparkles className="size-4" />
          Self-healing agents retrain locators when a marketplace changes layout.
        </div>
      </div>
    </section>
  );
}
