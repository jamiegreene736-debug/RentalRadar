import type { HTMLAttributes, SVGProps } from "react";

import { cn } from "@/lib/utils";

export function BrandMark({ className, title = "RentalRadar.AI" }: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      className={cn("shrink-0", className)}
      viewBox="0 0 84 56"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="brand-mark-shell" x1="8" y1="7" x2="78" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0F172A" />
          <stop offset="0.48" stopColor="#07111F" />
          <stop offset="1" stopColor="#050816" />
        </linearGradient>
        <radialGradient id="brand-mark-radar" cx="0" cy="0" r="1" gradientTransform="matrix(24 0 0 24 31 29)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#164E63" stopOpacity="0.72" />
          <stop offset="0.64" stopColor="#0E7490" stopOpacity="0.18" />
          <stop offset="1" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="brand-mark-sweep" x1="31" y1="29" x2="61" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#67E8F9" />
          <stop offset="0.56" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#2DD4BF" />
        </linearGradient>
        <linearGradient id="brand-mark-sweep-fade" x1="31" y1="29" x2="58" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#67E8F9" stopOpacity="0.5" />
          <stop offset="0.72" stopColor="#22D3EE" stopOpacity="0.2" />
          <stop offset="1" stopColor="#2DD4BF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="brand-mark-home" x1="18" y1="41" x2="44" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#CFFAFE" />
          <stop offset="1" stopColor="#67E8F9" />
        </linearGradient>
        <linearGradient id="brand-mark-ai" x1="55" y1="38" x2="70" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A" />
          <stop offset="1" stopColor="#FBBF24" />
        </linearGradient>
        <filter id="brand-mark-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.133 0 0 0 0 0.827 0 0 0 0 0.933 0 0 0 0.8 0"
          />
          <feBlend in="SourceGraphic" mode="screen" />
        </filter>
      </defs>
      <rect width="84" height="56" rx="16" fill="url(#brand-mark-shell)" />
      <rect x="1" y="1" width="82" height="54" rx="15" fill="none" stroke="#67E8F9" strokeOpacity="0.22" />
      <circle cx="31" cy="29" r="23" fill="url(#brand-mark-radar)" />
      <circle cx="31" cy="29" r="22" fill="none" stroke="#67E8F9" strokeOpacity="0.22" strokeWidth="1.8" />
      <circle cx="31" cy="29" r="15.5" fill="none" stroke="#67E8F9" strokeOpacity="0.2" strokeWidth="1.4" />
      <circle cx="31" cy="29" r="8.5" fill="none" stroke="#67E8F9" strokeOpacity="0.18" strokeWidth="1.2" />
      <path d="M31 7v44M9 29h44" stroke="#67E8F9" strokeOpacity="0.12" strokeWidth="1" />
      <path d="M31 29 53 11a28 28 0 0 1 6 23Z" fill="url(#brand-mark-sweep-fade)" filter="url(#brand-mark-glow)" />
      <path d="M45 13.5a22 22 0 0 1 8 9.5" stroke="url(#brand-mark-sweep)" strokeLinecap="round" strokeWidth="2.4" filter="url(#brand-mark-glow)" />
      <path d="M18.5 31.5 31 21.2l12.5 10.3" fill="none" stroke="url(#brand-mark-home)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.4" />
      <path d="M22.8 31.8v12.4h16.4V31.8" fill="#07111F" fillOpacity="0.78" stroke="url(#brand-mark-home)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.4" />
      <path d="M31 44.2v-8.4h7.2" fill="none" stroke="url(#brand-mark-ai)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.4" />
      <circle cx="31" cy="29" r="2.4" fill="#67E8F9" filter="url(#brand-mark-glow)" />
      <path d="M55.5 33.5 63 26l7.5 7.5" fill="none" stroke="url(#brand-mark-ai)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
      <circle cx="55.5" cy="33.5" r="3" fill="#22D3EE" />
      <circle cx="63" cy="26" r="3.2" fill="#FBBF24" />
      <circle cx="70.5" cy="33.5" r="3" fill="#2DD4BF" />
      <circle cx="63" cy="26" r="1.2" fill="#FFFBEB" />
    </svg>
  );
}

type BrandLogoProps = HTMLAttributes<HTMLDivElement> & {
  markClassName?: string;
  showText?: boolean;
  textClassName?: string;
};

export function BrandLogo({ className, markClassName, showText = true, textClassName, ...props }: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)} {...props}>
      <BrandMark className={cn("h-10 w-14", markClassName)} />
      {showText ? (
        <span className={cn("min-w-0 whitespace-nowrap leading-none", textClassName)}>
          <span className="text-base font-semibold tracking-normal text-white">RentalRadar</span>
          <span className="text-base font-semibold tracking-normal text-cyan-200">.AI</span>
        </span>
      ) : null}
    </div>
  );
}
