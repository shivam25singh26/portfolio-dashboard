"use client";

import { useState } from "react";

export default function ScreenerPage() {
  const [query, setQuery] = useState("Market Cap > 5000 AND PE < 15 AND Price > 100");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const runQuery = async () => {
    setLoading(true);
    setError(null);
    setHasRun(true);
    
    try {
      const res = await fetch('/go-api/screen/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
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

  return (
    <>
      <header>
        <div>
          <h1>Advanced Equity Screener</h1>
          <p>Run complex financial queries instantly across the market.</p>
        </div>
      </header>
      
      <div className="macro-section" style={{ padding: '0 48px', marginTop: '24px' }}>
        <div className="query-box-container" style={{ background: 'var(--panel)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--line)', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>Query Editor</h3>
            <span style={{ fontSize: '12px', color: 'var(--dim)', fontFamily: "'Spline Sans Mono', monospace" }}>Available Metrics: Market Cap (Cr), PE, EPS, Price</span>
          </div>
          
          <textarea 
            className="query-textarea"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Market Cap > 5000 AND PE < 20"
            spellCheck="false"
            style={{
              width: '100%',
              height: '120px',
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              padding: '16px',
              color: 'var(--ink)',
              fontFamily: "'Spline Sans Mono', monospace",
              fontSize: '16px',
              lineHeight: '1.5',
              resize: 'vertical',
              outline: 'none',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
              marginBottom: '16px'
            }}
          />
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              onClick={runQuery} 
              disabled={loading}
              style={{
                background: 'var(--accent)',
                color: '#000',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: "'Spline Sans Mono', monospace"
              }}
            >
              {loading ? 'Executing...' : 'RUN QUERY ▶'}
            </button>
            <button 
              onClick={() => setQuery('')}
              style={{
                background: 'transparent',
                color: 'var(--dim)',
                padding: '12px 16px',
                border: '1px solid var(--line)',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          </div>
          
          {error && (
            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(239, 83, 80, 0.1)', color: '#ef5350', borderRadius: '4px', border: '1px solid rgba(239, 83, 80, 0.2)', fontSize: '13px', fontFamily: "'Spline Sans Mono', monospace" }}>
              Error: {error}
            </div>
          )}
        </div>

        {hasRun && !error && (
          <div className="screener-view" style={{ marginTop: 0 }}>
            <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--dim)' }}>
              Found {results.length} matching companies.
            </div>
            
            {results.length > 0 ? (
              <div className="table-container">
                <table className="data-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th>Company</th>
                      <th>Sector</th>
                      <th>Mkt Cap</th>
                      <th>PE</th>
                      <th>EPS</th>
                      <th>Price</th>
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
                        <td className="dt-cap" style={{ color: 'var(--dim)' }}>{st.sector}</td>
                        <td className="dt-cap" style={{ fontSize: '11px' }}>
                          {st.market_cap_val > 0 
                            ? `₹${(st.market_cap_val / 10000000).toLocaleString('en-IN', {maximumFractionDigits: 0})}Cr` 
                            : '-'}
                        </td>
                        <td className="dt-cap">{st.trailing_pe > 0 ? st.trailing_pe.toFixed(1) : '-'}</td>
                        <td className="dt-cap">{st.eps !== 0 ? st.eps.toFixed(1) : '-'}</td>
                        <td className="dt-price">₹{st.last_price > 0 ? st.last_price.toFixed(2) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
