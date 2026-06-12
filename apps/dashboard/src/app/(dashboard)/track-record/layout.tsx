import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Track Record & Analytics — Growth Engines",
  description: "Track AI engine performance with equity curves, win rates, P&L analytics and full paper trading history.",
};

export default function TrackRecordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
