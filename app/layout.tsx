import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "InsiderCluster - Code-P Form 4 cluster buys",
  description: "Free SEC Form 4 tracker. Open-market insider purchases only. Clusters of 3+ insiders inside 14 days. No paywall.",
  metadataBase: new URL("https://insidercluster.vercel.app"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
