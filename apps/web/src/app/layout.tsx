import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "@/app/globals.css";
import { afterAuthPath, isClerkEnabled, signInPath, signUpPath } from "@/lib/auth-config";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://rentalradar.ai"),
  title: {
    default: "RentalRadar.ai | AI Agents for Live Vacation Rental Pricing",
    template: "%s | RentalRadar.ai",
  },
  description:
    "The next-generation AI dynamic pricing tool for vacation rentals. AI agents train Playwright in real headed Chrome to scrape live Airbnb, VRBO, Booking.com, and PMS market data.",
  keywords: [
    "vacation rental dynamic pricing",
    "Airbnb pricing",
    "VRBO pricing",
    "AI pricing tool",
    "Playwright scraping",
    "PMS revenue management",
  ],
  openGraph: {
    title: "RentalRadar.ai | The Only Pricing Tool That Finally Gets It",
    description:
      "AI agents train Playwright in real headed Chrome, scrape live market rates, and auto-push optimized prices to Airbnb, VRBO, Booking.com, and PMS channels.",
    url: "https://rentalradar.ai",
    siteName: "RentalRadar.ai",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "RentalRadar AI agents training real headed Chrome for live vacation rental pricing",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RentalRadar.ai | AI Agents for Live Vacation Rental Pricing",
    description:
      "Real headed Chrome. Adaptive AI scraping. Direct rate pushing with browser extensions.",
    images: ["/opengraph-image"],
  },
  alternates: {
    canonical: "https://rentalradar.ai",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const body = <body className={inter.className}>{children}</body>;

  return (
    <html lang="en" className="dark">
      {isClerkEnabled ? (
        <ClerkProvider
          signInUrl={signInPath}
          signUpUrl={signUpPath}
          signInFallbackRedirectUrl={afterAuthPath}
          signUpFallbackRedirectUrl={afterAuthPath}
          afterSignOutUrl="/"
        >
          {body}
        </ClerkProvider>
      ) : (
        body
      )}
    </html>
  );
}
