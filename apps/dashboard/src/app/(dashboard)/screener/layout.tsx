import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stock Screener — Growth Engines",
  description: "Filter 223 NSE & BSE stocks by Market Cap, PE, EPS, ROE, ROCE, Debt/Equity, Dividend Yield and more with a natural-language query engine.",
};

export default function ScreenerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
