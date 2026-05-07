import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "@/app/globals.css";
import { afterAuthPath, isClerkEnabled, signInPath, signUpPath } from "@/lib/auth-config";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://rentalradar.ai"),
  title: {
    default: "RentalRadar.ai | AI Agents for Next-Generation Vacation Rental Pricing",
    template: "%s | RentalRadar.ai",
  },
  description:
    "RentalRadar combines Playwright AI agents running real headed Chrome with booking, pacing, occupancy, and PMS revenue data for next-generation vacation rental pricing.",
  keywords: [
    "vacation rental dynamic pricing",
    "Airbnb pricing",
    "VRBO pricing",
    "Playwright pricing agents",
    "headed Chrome scraping",
    "vacation rental revenue management",
    "PMS pricing",
  ],
  openGraph: {
    title: "RentalRadar.ai | AI Agents for Next-Generation Vacation Rental Pricing",
    description:
      "RentalRadar combines AI agents running Playwright in real headed Chrome with real booking and revenue data for next-generation vacation rental pricing.",
    url: "https://rentalradar.ai",
    siteName: "RentalRadar.ai",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "RentalRadar AI agents using headed Chrome and booking data for vacation rental pricing",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RentalRadar.ai | AI Agents for Next-Generation Vacation Rental Pricing",
    description:
      "Playwright AI agents, real headed Chrome, live market evidence, and actual booking data in one pricing engine.",
    images: ["/opengraph-image"],
  },
  alternates: {
    canonical: "https://rentalradar.ai",
  },
  icons: {
    icon: [
      {
        url: "/favicon.svg",
        type: "image/svg+xml",
      },
    ],
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const layout = (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );

  if (!isClerkEnabled) {
    return layout;
  }

  return (
    <ClerkProvider
      signInUrl={signInPath}
      signUpUrl={signUpPath}
      signInFallbackRedirectUrl={afterAuthPath}
      signUpFallbackRedirectUrl={afterAuthPath}
      afterSignOutUrl="/"
    >
      {layout}
    </ClerkProvider>
  );
}
