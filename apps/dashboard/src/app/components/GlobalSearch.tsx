"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, TrendingUp, BarChart2, Zap } from "lucide-react";

interface Stock {
  t: string;
  c: string;
  sector?: string;
  type?: string;
  cap?: string;
}

interface GlobalSearchProps {
  allStocks: Stock[];
}

export default function GlobalSearch({ allStocks }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = query.trim().length < 1 ? [] : allStocks.filter(s => {
    const q = query.toLowerCase();
    return (
      s.t.toLowerCase().includes(q) ||
      s.c.toLowerCase().includes(q) ||
      (s.sector || "").toLowerCase().includes(q)
    );
  }).slice(0, 12);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelected(0);
  }, []);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [close]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard nav
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[selected]) {
      handleSelect(results[selected]);
    }
  };

  const handleSelect = (stock: Stock) => {
    // Dispatch a custom event that the dashboard page listens to
    window.dispatchEvent(new CustomEvent("global-search-select", { detail: stock }));
    close();
  };

  const typeColor: Record<string, string> = {
    established: "var(--established)",
    aggressive: "var(--aggressive)",
    speculative: "var(--speculative)",
  };

  const recentSearches = ["RELIANCE", "HDFC", "INFY", "TCS", "ICICIBANK"];

  return (
    <>
      {/* Trigger Button in Sidebar or Header */}
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          width: "100%",
          padding: "8px 12px",
          background: "var(--panel-2)",
          border: "1px solid var(--line)",
          borderRadius: "8px",
          color: "var(--dim)",
          cursor: "pointer",
          fontSize: "13px",
          fontFamily: "'Archivo', sans-serif",
          transition: "var(--transition-fast)",
        }}
        onMouseOver={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--ink)"; }}
        onMouseOut={e => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.color = "var(--dim)"; }}
      >
        <Search size={14} />
        <span style={{ flex: 1, textAlign: "left" }}>Search stocks...</span>
        <kbd style={{ fontSize: "10px", padding: "2px 6px", background: "var(--panel)", borderRadius: "4px", border: "1px solid var(--line)", fontFamily: "inherit" }}>⌘K</kbd>
      </button>

      {/* Modal Overlay */}
      {open && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", zIndex: 9000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "80px" }}
          onClick={close}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: "100%", maxWidth: "580px", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "16px", boxShadow: "0 24px 80px rgba(0,0,0,0.7)", overflow: "hidden" }}
          >
            {/* Search Input */}
            <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--line)", gap: "12px" }}>
              <Search size={20} color="var(--accent)" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setSelected(0); }}
                onKeyDown={handleKeyDown}
                placeholder="Search ticker, company, sector…"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--ink)", fontSize: "18px", fontFamily: "'Archivo', sans-serif" }}
              />
              {query && <button onClick={() => setQuery("")} style={{ background: "transparent", border: "none", color: "var(--dim)", cursor: "pointer" }}><X size={16} /></button>}
              <kbd onClick={close} style={{ fontSize: "11px", padding: "3px 8px", background: "var(--panel-2)", borderRadius: "6px", border: "1px solid var(--line)", color: "var(--dim)", cursor: "pointer" }}>ESC</kbd>
            </div>

            {/* Results */}
            <div ref={listRef} style={{ maxHeight: "420px", overflowY: "auto" }}>
              {query.trim().length === 0 ? (
                <div style={{ padding: "20px" }}>
                  <div style={{ fontSize: "11px", color: "var(--dim)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Recent</div>
                  {recentSearches.map(s => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "8px", cursor: "pointer", color: "var(--ink)", fontSize: "14px" }}
                      onMouseOver={e => e.currentTarget.style.background = "var(--panel-2)"}
                      onMouseOut={e => e.currentTarget.style.background = "transparent"}
                      onClick={() => setQuery(s)}
                    >
                      <TrendingUp size={14} color="var(--dim)" />
                      <span style={{ fontFamily: "'Spline Sans Mono', monospace" }}>{s}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: "20px", fontSize: "11px", color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>Quick Nav</div>
                  {[
                    { label: "Screener", href: "/screener", icon: BarChart2 },
                    { label: "AI Signals", href: "/signals", icon: Zap },
                  ].map(({ label, href, icon: Icon }) => (
                    <div key={href} onClick={() => { window.location.href = href; close(); }}
                      style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "8px", cursor: "pointer", color: "var(--ink)", fontSize: "14px" }}
                      onMouseOver={e => e.currentTarget.style.background = "var(--panel-2)"}
                      onMouseOut={e => e.currentTarget.style.background = "transparent"}
                    >
                      <Icon size={14} color="var(--dim)" />
                      {label}
                    </div>
                  ))}
                </div>
              ) : results.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--dim)" }}>
                  No stocks found for &quot;{query}&quot;
                </div>
              ) : (
                <div style={{ padding: "8px" }}>
                  {results.map((stock, i) => (
                    <div
                      key={stock.t}
                      onClick={() => handleSelect(stock)}
                      style={{
                        display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px",
                        borderRadius: "8px", cursor: "pointer",
                        background: i === selected ? "var(--panel-2)" : "transparent",
                        border: i === selected ? "1px solid var(--line)" : "1px solid transparent",
                        transition: "var(--transition-fast)",
                        marginBottom: "2px",
                      }}
                      onMouseOver={() => setSelected(i)}
                    >
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: typeColor[stock.type || "established"], flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontWeight: 600, color: "var(--ink)", fontSize: "14px" }}>
                            {stock.t.split(".")[0]}
                          </span>
                          {stock.cap && (
                            <span style={{ fontSize: "10px", padding: "1px 6px", background: "var(--panel)", borderRadius: "4px", color: "var(--dim)", border: "1px solid var(--line)" }}>
                              {stock.cap}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--dim)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {stock.c}
                        </div>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--dim)", textAlign: "right", flexShrink: 0 }}>
                        {stock.sector?.split(" ")[0]}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", display: "flex", gap: "16px", fontSize: "11px", color: "var(--dim)" }}>
              <span><kbd style={{ padding: "1px 5px", background: "var(--panel-2)", borderRadius: "3px", border: "1px solid var(--line)" }}>↑↓</kbd> Navigate</span>
              <span><kbd style={{ padding: "1px 5px", background: "var(--panel-2)", borderRadius: "3px", border: "1px solid var(--line)" }}>↵</kbd> Select</span>
              <span><kbd style={{ padding: "1px 5px", background: "var(--panel-2)", borderRadius: "3px", border: "1px solid var(--line)" }}>ESC</kbd> Close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
