"use client";

import { useState } from "react";
import { Search, Zap, TrendingUp, Shield, Percent, BarChart2, Landmark } from "lucide-react";

const QUERY_TEMPLATES = [
  {
    label: "Deep Value",
    icon: Landmark,
    color: "var(--established)",
    query: "PE < 12 AND Market Cap > 5000 AND ROE > 12",
    description: "Large caps trading cheap with solid returns",
  },
  {
    label: "High Growth",
    icon: TrendingUp,
    color: "var(--accent)",
    query: "Sales Growth > 20 AND Profit Growth > 20 AND Market Cap > 2000",
    description: "Companies growing revenue and profit >20%",
  },
  {
    label: "Quality Compounders",
    icon: Shield,
    color: "var(--aggressive)",
    query: "ROE > 20 AND ROCE > 20 AND Debt to Equity < 0.5",
    description: "High ROE/ROCE with clean balance sheets",
  },
  {
    label: "Dividend Champions",
    icon: Percent,
    color: "var(--speculative)",
    query: "Dividend Yield > 3 AND Market Cap > 5000 AND PE < 25",
    description: "Large caps paying generous dividends",
  },
  {
    label: "Mid Cap Momentum",
    icon: Zap,
    color: "var(--accent-2)",
    query: "Market Cap > 1000 AND Market Cap < 25000 AND ROE > 15 AND Profit Growth > 15",
    description: "Mid caps with strong fundamentals and growth",
  },
  {
    label: "Debt-Free Leaders",
    icon: BarChart2,
    color: "var(--established)",
    query: "Debt to Equity < 0.1 AND ROE > 15 AND Market Cap > 3000",
    description: "Near-zero debt businesses with high ROE",
  },
];

export default function ScreenerPage() {
  const [query, setQuery] = useState("Market Cap > 5000 AND PE < 15 AND Price > 100");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);

  const runQuery = async (q?: string) => {
    const finalQuery = q ?? query;
    setLoading(true);
    setError(null);
    setHasRun(true);
    
    try {
      const res = await fetch('/go-api/screen/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: finalQuery })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to execute query');
      }
      setResults(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (template: typeof QUERY_TEMPLATES[0]) => {
    setQuery(template.query);
    setActiveTemplate(template.label);
    runQuery(template.query);
  };

  return (
    <>
      <header>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Search size={28} color="var(--accent)" />
            Advanced Equity Screener
          </h1>
          <p>Run complex financial queries across 2,100+ NSE & BSE equities. Values: Market Cap in ₹Cr.</p>
        </div>
      </header>
      
      <div className="macro-section" style={{ padding: '0 48px', marginTop: '24px' }}>
        
        {/* Query Templates */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '12px', color: 'var(--dim)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Quick Templates
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {QUERY_TEMPLATES.map((t) => {
              const Icon = t.icon;
              const isActive = activeTemplate === t.label;
              return (
                <button
                  key={t.label}
                  onClick={() => applyTemplate(t)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                    gap: '6px', padding: '14px 16px', borderRadius: '10px', cursor: 'pointer',
                    background: isActive ? `${t.color}15` : 'var(--panel)',
                    border: `1px solid ${isActive ? t.color : 'var(--line)'}`,
                    textAlign: 'left', transition: 'var(--transition-fast)',
                  }}
                  onMouseOver={e => { if (!isActive) { e.currentTarget.style.borderColor = t.color; e.currentTarget.style.background = `${t.color}08`; } }}
                  onMouseOut={e => { if (!isActive) { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--panel)'; } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon size={14} color={t.color} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{t.label}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--dim)', lineHeight: 1.4 }}>{t.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Query Editor */}
        <div className="query-box-container" style={{ background: 'var(--panel)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--line)', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '16px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>Query Editor</h3>
            <details style={{ cursor: 'pointer' }}>
              <summary style={{ fontSize: '12px', color: 'var(--accent)', listStyle: 'none', cursor: 'pointer' }}>
                📖 Syntax Reference
              </summary>
              <div style={{ marginTop: '10px', padding: '14px', background: 'var(--bg)', borderRadius: '8px', fontSize: '12px', color: 'var(--dim)', fontFamily: "'Spline Sans Mono', monospace", lineHeight: 2 }}>
                <strong style={{ color: 'var(--ink)' }}>Fields:</strong><br />
                Market Cap (₹Cr) · PE · EPS · Price · ROE (%) · ROCE (%)<br />
                Debt to Equity · Dividend Yield (%) · Sales Growth (%) · Profit Growth (%)<br /><br />
                <strong style={{ color: 'var(--ink)' }}>Operators:</strong> {'>'} {'<'} {'='} {'AND'}<br /><br />
                <strong style={{ color: 'var(--ink)' }}>Example:</strong><br />
                Market Cap {'>'} 10000 AND PE {'<'} 20 AND ROE {'>'} 15
              </div>
            </details>
          </div>
          
          <textarea 
            className="query-textarea"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveTemplate(null); }}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") runQuery(); }}
            placeholder="e.g. Market Cap > 5000 AND PE < 20"
            spellCheck="false"
            style={{
              width: '100%', height: '100px', background: 'var(--bg)',
              border: '1px solid var(--line)', borderRadius: '8px', padding: '16px',
              color: 'var(--ink)', fontFamily: "'Spline Sans Mono', monospace",
              fontSize: '16px', lineHeight: '1.5', resize: 'vertical', outline: 'none',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)', marginBottom: '16px'
            }}
          />
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              onClick={() => runQuery()} 
              disabled={loading}
              style={{
                background: 'var(--accent)', color: '#000', padding: '12px 28px',
                border: 'none', borderRadius: '6px', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: "'Spline Sans Mono', monospace", fontSize: '13px',
                display: 'flex', alignItems: 'center', gap: '8px',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? (
                <><svg style={{ animation: 'spin 1s linear infinite' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" /></svg> Executing...</>
              ) : <>▶ RUN QUERY <span style={{ fontSize: '10px', opacity: 0.7 }}>⌘↵</span></>}
            </button>
            <button 
              onClick={() => { setQuery(''); setActiveTemplate(null); setHasRun(false); setResults([]); }}
              style={{ background: 'transparent', color: 'var(--dim)', padding: '12px 16px', border: '1px solid var(--line)', borderRadius: '6px', cursor: 'pointer' }}
            >
              Clear
            </button>
            {hasRun && !loading && (
              <span style={{ fontSize: '13px', color: 'var(--dim)', marginLeft: 'auto' }}>
                {results.length === 0 ? 'No results' : `${results.length} companies matched`}
              </span>
            )}
          </div>
          
          {error && (
            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(239, 83, 80, 0.1)', color: '#ef5350', borderRadius: '4px', border: '1px solid rgba(239, 83, 80, 0.2)', fontSize: '13px', fontFamily: "'Spline Sans Mono', monospace" }}>
              ⚠ {error}
            </div>
          )}
        </div>

        {/* Results */}
        {hasRun && !error && (
          <div className="screener-view" style={{ marginTop: 0 }}>
            {results.length > 0 ? (
              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', minWidth: '700px' }}>
                  <thead>
                    <tr>
                      <th scope="col">Ticker</th>
                      <th scope="col">Company</th>
                      <th scope="col">Sector</th>
                      <th scope="col">Mkt Cap</th>
                      <th scope="col">PE</th>
                      <th scope="col">ROE</th>
                      <th scope="col">Debt/Eq</th>
                      <th scope="col">Yield</th>
                      <th scope="col">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((st: any) => (
                      <tr key={st.ticker}>
                        <td className="dt-ticker">
                          <div className="dt-type-dot"></div>
                          {st.ticker.split('.')[0]}
                        </td>
                        <td className="dt-company">{st.company}</td>
                        <td className="dt-cap" style={{ color: 'var(--dim)', fontSize: '11px' }}>{st.sector}</td>
                        <td className="dt-cap" style={{ fontSize: '11px' }}>
                          {st.market_cap_val > 0 ? `₹${(st.market_cap_val / 10000000).toLocaleString('en-IN', {maximumFractionDigits: 0})}Cr` : '-'}
                        </td>
                        <td className="dt-cap">{st.trailing_pe > 0 ? st.trailing_pe.toFixed(1) : '-'}</td>
                        <td className="dt-cap" style={{ color: st.roe > 15 ? 'var(--established)' : 'inherit' }}>{st.roe !== 0 ? st.roe.toFixed(1) + '%' : '-'}</td>
                        <td className="dt-cap" style={{ color: st.debt_to_equity > 1 ? 'var(--danger)' : 'inherit' }}>{st.debt_to_equity !== 0 ? st.debt_to_equity.toFixed(2) : '-'}</td>
                        <td className="dt-cap">{st.dividend_yield !== 0 ? st.dividend_yield.toFixed(2) + '%' : '-'}</td>
                        <td className="dt-price" style={{ fontFamily: "'Spline Sans Mono', monospace" }}>₹{st.last_price > 0 ? st.last_price.toFixed(2) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '60px 0' }}>
                <div style={{ fontSize: '36px', marginBottom: '16px' }}>🔍</div>
                <h3 style={{ color: 'var(--ink)', marginBottom: '8px' }}>No results found</h3>
                <p style={{ color: 'var(--dim)', fontSize: '13px' }}>Try relaxing your query or use a template above to get started.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
