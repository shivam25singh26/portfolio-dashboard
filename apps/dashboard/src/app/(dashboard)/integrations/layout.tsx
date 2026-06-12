import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Broker Integrations — Growth Engines",
  description: "Connect your AngelOne SmartAPI account to enable 1-click trade execution directly from the AI Signals dashboard.",
};

export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
