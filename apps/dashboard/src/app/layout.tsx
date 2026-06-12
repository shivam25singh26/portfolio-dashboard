import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Growth Engines — Premium Global Equity Dashboard",
  description: "A professional-grade equity research dashboard covering 223 NSE & BSE listed Indian equities across 11 sectors with live pricing and qualitative analysis.",
  keywords: "stocks, equity, dashboard, finance, investing, NIFTY, S&P 500, screener",
};

import { Viewport } from "next";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import { Providers } from "./providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,900&family=Archivo:wght@400;500;600;700&family=Spline+Sans+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
