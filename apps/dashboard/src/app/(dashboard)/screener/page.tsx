"use client";
import { useState, useMemo, useEffect } from "react";
import stocksData from "../../../data/stocks.json";

export default function ScreenerPage() {
  const [activeType, setActiveType] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const allStocks = useMemo(() => {
    // Only US and Europe for now, or all data
    const all = Object.values(stocksData).flat();
    return all.flatMap((s: any) => 
      s.subs.flatMap((su: any) => 
        su.stocks.map((st: any) => ({ ...st, sector: s.sector, subIndustry: su.name }))
      )
    );
  }, []);

  const screenerData = useMemo(() => {
    let filterable = [...allStocks];
    if (activeType !== 'all') { filterable = filterable.filter(s => s.type === activeType); }
    if (query) {
      const q = query.toLowerCase();
      filterable = filterable.filter(s => (s.t + ' ' + s.c + ' ' + s.sector + ' ' + s.subIndustry + ' ' + s.catalyst).toLowerCase().includes(q));
    }
    if (sortConfig !== null) {
      filterable.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filterable;
  }, [allStocks, activeType, query, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') { direction = 'desc'; }
    setSortConfig({ key, direction });
  };

  return (
    <>
      <header>
        <div>
          <h1>Equity Screener</h1>
          <p>Filter, sort, and analyze {allStocks.length} global equities.</p>
        </div>
      </header>
      <div className="controls">
        <input 
          className="search" 
          placeholder="search ticker, company, sector, catalyst…" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="seg" id="typeFilter">
          <button className={activeType === "all" ? "on" : ""} onClick={() => setActiveType("all")}>ALL</button>
          <button className={activeType === "established" ? "on" : ""} onClick={() => setActiveType("established")}>ESTABLISHED</button>
          <button className={activeType === "aggressive" ? "on" : ""} onClick={() => setActiveType("aggressive")}>AGGRESSIVE</button>
          <button className={activeType === "speculative" ? "on" : ""} onClick={() => setActiveType("speculative")}>SPECULATIVE</button>
        </div>
      </div>
      <main className="page-main">
        <div className="screener-view" style={{ marginTop: 0 }}>
          <table className="screener-table">
            <thead>
              <tr>
                <th onClick={() => requestSort('t')}>Ticker {sortConfig?.key === 't' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                <th onClick={() => requestSort('c')}>Company {sortConfig?.key === 'c' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                <th onClick={() => requestSort('sector')}>Sector {sortConfig?.key === 'sector' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                <th onClick={() => requestSort('type')}>Risk Profile {sortConfig?.key === 'type' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                <th onClick={() => requestSort('cap')}>Cap Size {sortConfig?.key === 'cap' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                <th>Future Catalyst</th>
              </tr>
            </thead>
            <tbody>
              {screenerData.map(st => (
                <tr key={st.t}>
                  <td data-label="Ticker" style={{ fontWeight: 'bold', color: 'var(--accent)' }}>{st.t}</td>
                  <td data-label="Company">{st.c}</td>
                  <td data-label="Sector" style={{ color: 'var(--dim)' }}>{st.sector}</td>
                  <td data-label="Risk Profile"><span className={`badge ${st.type}`}>{st.type}</span></td>
                  <td data-label="Cap Size">{st.cap}</td>
                  <td data-label="Future Catalyst" style={{ fontSize: '13px', color: 'var(--text-light)' }}>{st.catalyst}</td>
                </tr>
              ))}
              {screenerData.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--dim)' }}>No stocks match your criteria.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
