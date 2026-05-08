import { MessageSquareText, Sparkles, Star, TrendingUp } from "lucide-react";

import { SectionReveal } from "@/app/components/section-reveal";

const reviewSignals = [
  ["Guest sentiment", "Review themes show where a listing earns pricing power or needs a conversion assist."],
  ["Star strength", "Cleanliness, communication, location, and overall score inform how confidently rates can stretch."],
  ["Recent momentum", "Fresh praise or recurring feedback can shift recommendations before the calendar even changes."],
];

export function ReviewSignalStrip() {
  return (
    <section className="relative bg-[#050816] pb-8">
      <div className="container">
        <SectionReveal className="rounded-[32px] border border-cyan-200/[0.14] bg-gradient-to-br from-cyan-300/[0.1] via-white/[0.045] to-teal-300/[0.07] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.34)] sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[0.84fr_1.16fr] lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-slate-900/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-50">
                <Star className="size-3.5" />
                Review-aware pricing
              </div>
              <h3 className="text-2xl font-semibold tracking-normal text-white sm:text-3xl">
                Listing reviews are part of the pricing signal.
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
                RentalRadar does not just look at calendars and comps. It weighs how guests actually describe your
                property. Stronger reviews mean more pricing power, and recurring feedback can change recommendations
                before the calendar even moves.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {reviewSignals.map(([title, copy], index) => {
                const Icon = index === 0 ? MessageSquareText : index === 1 ? Sparkles : TrendingUp;
                return (
                  <div key={title} className="rounded-3xl border border-white/[0.1] bg-black/[0.22] p-4">
                    <div className="mb-4 grid size-10 place-items-center rounded-2xl bg-white/[0.08] text-cyan-100">
                      <Icon className="size-5" />
                    </div>
                    <p className="font-semibold text-white">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
