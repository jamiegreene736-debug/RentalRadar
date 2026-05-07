import type { HTMLAttributes, SVGProps } from "react";

import { cn } from "@/lib/utils";

export function BrandMark({ className, title = "RentalRadar.AI" }: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      className={cn("shrink-0", className)}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="brand-mark-shell" x1="9" y1="8" x2="57" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0F172A" />
          <stop offset="0.48" stopColor="#07111F" />
          <stop offset="1" stopColor="#050816" />
        </linearGradient>
        <linearGradient id="brand-mark-sweep" x1="16" y1="15" x2="48" y2="49" gradientUnits="userSpaceOnUse">
          <stop stopColor="#67E8F9" />
          <stop offset="0.56" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#2DD4BF" />
        </linearGradient>
        <linearGradient id="brand-mark-home" x1="20" y1="39" x2="45" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#CFFAFE" />
          <stop offset="1" stopColor="#67E8F9" />
        </linearGradient>
        <filter id="brand-mark-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.8" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.133 0 0 0 0 0.827 0 0 0 0 0.933 0 0 0 0.8 0"
          />
          <feBlend in="SourceGraphic" mode="screen" />
        </filter>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#brand-mark-shell)" />
      <rect x="1" y="1" width="62" height="62" rx="13" fill="none" stroke="#67E8F9" strokeOpacity="0.2" />
      <path d="M14 35a18 18 0 1 1 35.8 2.7" fill="none" stroke="#67E8F9" strokeOpacity="0.28" strokeWidth="2" />
      <path d="M20 35a12 12 0 1 1 23.5 3.4" fill="none" stroke="#67E8F9" strokeOpacity="0.2" strokeWidth="1.6" />
      <path
        d="M32 34 50 16c4.7 6.7 4.1 16-1.6 22.2C42.5 44.7 32.7 46 25.3 41.4"
        fill="none"
        stroke="url(#brand-mark-sweep)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
        filter="url(#brand-mark-glow)"
      />
      <path d="M19.5 33.2 32 23l12.5 10.2" fill="none" stroke="url(#brand-mark-home)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" />
      <path d="M24 33v12h16V33" fill="none" stroke="url(#brand-mark-home)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" />
      <path d="M33.5 45V34h6.7" fill="none" stroke="#FBBF24" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" />
      <circle cx="48.6" cy="16.6" r="4.2" fill="#FBBF24" />
      <circle cx="48.6" cy="16.6" r="2" fill="#FFFBEB" />
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
      <BrandMark className={cn("size-10", markClassName)} />
      {showText ? (
        <span className={cn("min-w-0 leading-none", textClassName)}>
          <span className="block text-base font-semibold tracking-normal text-white">RentalRadar</span>
          <span className="mt-1 block text-xs font-semibold uppercase text-cyan-200">.AI</span>
        </span>
      ) : null}
    </div>
  );
}
