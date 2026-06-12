import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Trade Signals — Growth Engines",
  description: "Real-time AI-generated trade setups for Indian equities and crypto markets, powered by an autonomous scanning engine.",
};

export default function SignalsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
