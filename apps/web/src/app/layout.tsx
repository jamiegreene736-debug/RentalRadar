import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "@/app/globals.css";
import { afterAuthPath, isClerkEnabled, signInPath, signUpPath } from "@/lib/auth-config";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://rentalradar.ai"),
  title: {
    default: "RentalRadar.ai | Vacation Rental Pricing That Follows the Market",
    template: "%s | RentalRadar.ai",
  },
  description:
    "RentalRadar helps property managers compare live vacation rental rates, understand local demand, and publish smarter nightly prices.",
  keywords: [
    "vacation rental dynamic pricing",
    "Airbnb pricing",
    "VRBO pricing",
    "vacation rental pricing software",
    "vacation rental revenue management",
    "PMS pricing",
  ],
  openGraph: {
    title: "RentalRadar.ai | Vacation Rental Pricing That Follows the Market",
    description:
      "RentalRadar checks live Airbnb, VRBO, and Booking.com rates, then helps property managers choose smarter nightly prices.",
    url: "https://rentalradar.ai",
    siteName: "RentalRadar.ai",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "RentalRadar vacation rental pricing dashboard with live market rate recommendations",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RentalRadar.ai | Vacation Rental Pricing That Follows the Market",
    description:
      "Compare live market rates, review suggested prices, and publish approved updates.",
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
