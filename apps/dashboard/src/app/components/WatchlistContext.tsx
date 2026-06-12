"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface WatchlistContextType {
  watchlist: Set<string>;
  toggle: (ticker: string) => void;
  isWatched: (ticker: string) => boolean;
}

const WatchlistContext = createContext<WatchlistContextType>({
  watchlist: new Set(),
  toggle: () => {},
  isWatched: () => false,
});

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ge_watchlist");
      if (saved) setWatchlist(new Set(JSON.parse(saved)));
    } catch {}
  }, []);

  const toggle = useCallback((ticker: string) => {
    setWatchlist(prev => {
      const next = new Set(prev);
      if (next.has(ticker)) {
        next.delete(ticker);
      } else {
        next.add(ticker);
      }
      localStorage.setItem("ge_watchlist", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const isWatched = useCallback((ticker: string) => watchlist.has(ticker), [watchlist]);

  return (
    <WatchlistContext.Provider value={{ watchlist, toggle, isWatched }}>
      {children}
    </WatchlistContext.Provider>
  );
}

export const useWatchlist = () => useContext(WatchlistContext);
