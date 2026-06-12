import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings — Growth Engines",
  description: "Manage your account profile, security settings, API keys, and notification preferences on Growth Engines.",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
