"use client";

import { SessionProvider } from "next-auth/react";
import { WatchlistProvider } from "./components/WatchlistContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <WatchlistProvider>
        {children}
      </WatchlistProvider>
    </SessionProvider>
  );
}
