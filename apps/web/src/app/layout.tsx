import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "@/app/globals.css";
import { afterAuthPath, isClerkEnabled, signInPath, signUpPath } from "@/lib/auth-config";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://rentalradar.ai"),
  title: {
    default: "RentalRadar.ai | Your Personal Army of AI Agents for Smarter Vacation Rental Pricing",
    template: "%s | RentalRadar.ai",
  },
  description:
    "RentalRadar's AI agents browse Airbnb, VRBO, Booking.com, and comp listings live, then combine that market view with your bookings, occupancy, and revenue data.",
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
    title: "RentalRadar.ai | Your Personal Army of AI Agents for Smarter Vacation Rental Pricing",
    description:
      "AI agents browse live vacation rental comps the way guests see them, then combine that evidence with your real booking and revenue data.",
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
    title: "RentalRadar.ai | Your Personal Army of AI Agents for Smarter Vacation Rental Pricing",
    description:
      "Live AI market checks, real headed Chrome, and your actual booking data in one smarter vacation rental pricing engine.",
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
