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
        <linearGradient id="brand-mark-sweep" x1="25" y1="35" x2="72" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#67E8F9" />
          <stop offset="0.56" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#2DD4BF" />
        </linearGradient>
        <linearGradient id="brand-mark-home" x1="18" y1="42" x2="43" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#CFFAFE" />
          <stop offset="1" stopColor="#67E8F9" />
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
      <path d="M18 35a18 18 0 0 1 35.6-3.7" fill="none" stroke="#67E8F9" strokeOpacity="0.18" strokeWidth="2" />
      <path d="M25 35a11 11 0 0 1 21.6-3" fill="none" stroke="#67E8F9" strokeOpacity="0.22" strokeWidth="1.8" />
      <path d="M48 28c6.6-7.3 15.8-12.1 25.4-13.2" fill="none" stroke="#67E8F9" strokeOpacity="0.22" strokeLinecap="round" strokeWidth="2.2" />
      <path
        d="M36 33c8.9-9.7 21-16 34.6-18.2"
        fill="none"
        stroke="url(#brand-mark-sweep)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4.4"
        filter="url(#brand-mark-glow)"
      />
      <path d="M17.5 33 30 22.5 42.5 33" fill="none" stroke="url(#brand-mark-home)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.4" />
      <path d="M22 33v11h16V33" fill="none" stroke="url(#brand-mark-home)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.4" />
      <path d="M31 44v-8h7" fill="none" stroke="#FBBF24" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.4" />
      <circle cx="70.8" cy="14.8" r="4.4" fill="#FBBF24" />
      <circle cx="70.8" cy="14.8" r="1.9" fill="#FFFBEB" />
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
