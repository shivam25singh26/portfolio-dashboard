"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from 'next/dynamic';
import { useSession } from "next-auth/react";
import stocksData from "../../data/stocks.json";

const ChartComponent = dynamic(() => import('../ChartComponent'), { ssr: false });

export default function DashboardOverview() {
  const { data: session } = useSession();
  const [activeGeo, setActiveGeo] = useState<"US" | "Europe" | "India" | "Pre-IPO">("India");
  const [activeType, setActiveType] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [marketData, setMarketData] = useState<any>(stocksData);
  const [openSectors, setOpenSectors] = useState<Record<number, boolean>>({ 0: true });
  const [quotes, setQuotes] = useState<Record<string, any>>({});
  const [details, setDetails] = useState<Record<string, { metrics?: any, candle?: any, news?: any[], loading?: boolean, error?: boolean }>>({});
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle');
  const [paperPortfolio, setPaperPortfolio] = useState<{total_value: number, cash_balance: number, invested_value: number} | null>(null);

  const triggerManualScan = async () => {
    if (scanStatus === 'scanning') return;
    setScanStatus('scanning');
    try {
      const res = await fetch('/go-api/trigger-scan');
      if (res.ok) {
        setScanStatus('done');
      } else {
        setScanStatus('error');
      }
    } catch {
      setScanStatus('error');
    }
    setTimeout(() => setScanStatus('idle'), 4000);
  };

  useEffect(() => {
    // Fetch Live Market Data
    fetch('/go-api/nse-market')
      .then(res => res.json())
      .then(data => {
        if (!data || !Array.isArray(data)) return;
        const formatted = {
          sector: "Live NSE Market",
          num: "NSE",
          subs: [{
            name: "AngelOne Watchlist",
            shift: "Live",
            stocks: data.map((d: any) => ({
              t: d.t,
              c: d.c,
              type: "speculative",
              cap: "Large",
              catalyst: "Live Data from AngelOne API",
              moat: "Nifty 50 Constituent",
              risk: "Market Volatility"
            }))
          }]
        };
        setMarketData((prev: any) => ({ ...prev, India: [formatted] }));
      })
      .catch(err => console.error("Failed to fetch live NSE data:", err));

    // Fetch Paper Portfolio
    if (session?.user?.email) {
      fetch('/go-api/paper/portfolio', {
        headers: { 'X-User-Email': session.user.email }
      })
        .then(res => {
          if (!res.ok) throw new Error("Failed to fetch portfolio");
          return res.json();
        })
        .then(data => setPaperPortfolio(data))
        .catch(err => console.error("Failed to fetch paper portfolio:", err));
    }
  }, [session?.user?.email]);

  const currentData = marketData[activeGeo] || [];
  
  const allStocks = useMemo(() => {
    return currentData.flatMap((s: any) => 
      s.subs.flatMap((su: any) => 
        su.stocks.map((st: any) => ({ ...st, sector: s.sector, subIndustry: su.name }))
      )
    );
  }, [currentData]);

  const stats = [
    { n: currentData.length, l: "Sectors" },
    { n: currentData.reduce((a: any, s: any) => a + s.subs.length, 0), l: "Sub-Industries" },
    { n: allStocks.length, l: "Total Names" },
    { n: allStocks.filter((s: any) => s.type === "established").length, l: "Established" },
    { n: allStocks.filter((s: any) => s.type === "aggressive").length, l: "Aggressive" },
    { n: allStocks.filter((s: any) => s.type === "speculative").length, l: "Speculative" },
  ];

  const fetchQuotesForSector = async (sectorIdx: number) => {
    const sector = currentData[sectorIdx];
    if (!sector) return;
    const tickers = sector.subs.flatMap((su: any) => su.stocks.map((x: any) => x.t));
    for (const t of tickers) {
      if (!quotes[t]) {
        if (t.startsWith("PRIV.")) {
          const basePrice = 50 + (t.length * 7); 
          setQuotes(prev => ({ ...prev, [t]: { c: basePrice, h: basePrice * 1.05, l: basePrice * 0.95, dp: 1.2 } }));
        } else {
          fetch(`/api/quote?symbol=${t}`)
            .then(res => res.json())
            .then(data => setQuotes(prev => ({ ...prev, [t]: data })))
            .catch(() => setQuotes(prev => ({ ...prev, [t]: { error: true } })));
        }
      }
    }
  };

  const toggleSector = (idx: number) => {
    setOpenSectors(prev => {
      const isOpen = !prev[idx];
      if (isOpen) fetchQuotesForSector(idx);
      return { ...prev, [idx]: isOpen };
    });
  };

  useEffect(() => {
    fetchQuotesForSector(0);
  }, [activeGeo]);

  const toggleCard = async (ticker: string) => {
    if (expandedCard === ticker) {
      setExpandedCard(null);
      return;
    }
    setExpandedCard(ticker);
    
    if (!details[ticker]) {
      setDetails(prev => ({ ...prev, [ticker]: { loading: true } }));
      
      if (ticker.startsWith("PRIV.")) {
        setTimeout(() => {
          const val = 10 + (ticker.length * 3);
          const metrics = { metric: { marketCapitalization: val * 1000 } };
          
          const c = [], h = [], l = [], o = [], t = [];
          let price = quotes[ticker]?.c || 50;
          const now = Math.floor(Date.now()/1000);
          for(let i=0; i<180; i++) {
             t.push(now - ((180-i)*86400));
             o.push(price);
             price += (Math.random() - 0.48) * 2;
             c.push(price);
             h.push(Math.max(o[i], c[i]) + Math.random());
             l.push(Math.min(o[i], c[i]) - Math.random());
          }
          const candle = { s: "ok", c, h, l, o, t };
          
          const news = [
            { source: "TechCrunch", datetime: now - 86400, headline: `${ticker.replace("PRIV.", "")} announces major secondary tender offer at elevated valuation.` },
            { source: "Bloomberg", datetime: now - 172800, headline: `Insiders say ${ticker.replace("PRIV.", "")} is preparing for an eventual IPO.` }
          ];

          setDetails(prev => ({ ...prev, [ticker]: { metrics, candle, news, loading: false } }));
        }, 600);
        return;
      }

      try {
        const [metRes, canRes, newsRes] = await Promise.all([
          fetch(`/api/metric?symbol=${ticker}`),
          fetch(`/api/candle?symbol=${ticker}`),
          fetch(`/api/news?symbol=${ticker}`)
        ]);
        const metrics = await metRes.json();
        const candle = await canRes.json();
        const news = await newsRes.json();
        setDetails(prev => ({ ...prev, [ticker]: { metrics, candle, news, loading: false } }));
      } catch (e) {
        setDetails(prev => ({ ...prev, [ticker]: { error: true, loading: false } }));
      }
    }
  };

  return (
    <>
      <header>
        <div>
          <h1>Market Overview</h1>
          <p>Professional equity research across {allStocks.length} names in {activeGeo === 'Pre-IPO' ? 'Private Markets' : activeGeo}.</p>
        </div>
      </header>

      {paperPortfolio && (
        <div style={{ padding: '24px', background: 'var(--panel)', borderRadius: 'var(--radius)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }}></span>
              Lever Paper Portfolio
            </h3>
            <span style={{ fontSize: '12px', padding: '4px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', fontFamily: "'Spline Sans Mono', monospace" }}>{session?.user?.email || "Not Logged In"}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--dim)', marginBottom: '8px' }}>Total Value</div>
              <div style={{ fontSize: '24px', fontWeight: 600, fontFamily: "'Spline Sans Mono', monospace" }}>
                ₹{paperPortfolio.total_value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--dim)', marginBottom: '8px' }}>Invested Value</div>
              <div style={{ fontSize: '24px', fontWeight: 600, fontFamily: "'Spline Sans Mono', monospace" }}>
                ₹{paperPortfolio.invested_value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--dim)', marginBottom: '8px' }}>Available Cash</div>
              <div style={{ fontSize: '24px', fontWeight: 600, fontFamily: "'Spline Sans Mono', monospace" }}>
                ₹{paperPortfolio.cash_balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="stats" id="stats">
        {stats.map((s, i) => (
          <div key={i} className="stat">
            <div className="n">{s.n}</div>
            <div className="l">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="controls">
        <div className="seg" id="geoFilter">
          <button className={activeGeo === "US" ? "on" : ""} onClick={() => { setActiveGeo("US"); setOpenSectors({0: true}); }}>US</button>
          <button className={activeGeo === "Europe" ? "on" : ""} onClick={() => { setActiveGeo("Europe"); setOpenSectors({0: true}); }}>EUROPE</button>
          <button className={activeGeo === "India" ? "on" : ""} onClick={() => { setActiveGeo("India"); setOpenSectors({0: true}); }}>INDIA</button>
          <button className={activeGeo === "Pre-IPO" ? "on" : ""} onClick={() => { setActiveGeo("Pre-IPO"); setOpenSectors({0: true}); }}>PRE-IPO</button>
        </div>
        {activeGeo === "India" && (
          <a href="/fo" style={{ padding: '10px 16px', background: 'var(--accent)', color: '#04130b', textDecoration: 'none', borderRadius: 'var(--radius)', fontFamily: "'Spline Sans Mono', monospace", fontSize: '12px', fontWeight: 600, display: 'inline-block' }}>F&O Terminal ↗</a>
        )}
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

      <div className="main" id="main" style={{ padding: '8px 48px 80px' }}>
        {currentData.map((sec: any, si: number) => {
          let secStockCount = 0;
          const subsHtml = sec.subs.map((sub: any, subI: number) => {
            const cards = sub.stocks.filter((st: any) => {
              const matchType = activeType === 'all' || st.type === activeType;
              const hay = (st.t + ' ' + st.c + ' ' + sec.sector + ' ' + sub.name + ' ' + st.catalyst + ' ' + st.moat + ' ' + st.risk).toLowerCase();
              const matchQ = !query || hay.includes(query.toLowerCase());
              return matchType && matchQ;
            });
            secStockCount += cards.length;
            if (!cards.length) return null;

            return (
              <div key={subI} className="subind">
                <div className="subind-name">{sub.name} <span className="tag-shift">{sub.shift}</span></div>
                <div className="grid">
                  {cards.map((st: any) => {
                    const quote = quotes[st.t];
                    const chg = quote?.dp;
                    const d = details[st.t];
                    const colorMap: any = { established:'var(--established)', aggressive:'var(--aggressive)', speculative:'var(--speculative)' };
                    
                    return (
                      <div 
                        key={st.t} 
                        className={`card ${expandedCard === st.t ? 'expanded' : ''}`}
                        onClick={() => toggleCard(st.t)}
                        style={{ '--type-color': colorMap[st.type] } as any}
                      >
                        <div className="card-top">
                          <div>
                            <div className="ticker">{st.t}</div>
                            <div className="company">{st.c}</div>
                          </div>
                          <div className="badges">
                            <span className={`badge ${st.type}`}>{st.type}</span>
                            <span className="badge cap">{st.cap} cap</span>
                          </div>
                        </div>
                        
                        <div className="live-quote">
                          {quote ? (
                            quote.error || quote.c === 0 ? (
                              <div className="lq-top"><span>{st.t}</span><span style={{color:'var(--danger)'}}>no data</span></div>
                            ) : (
                              <>
                                <div className="lq-top">
                                  <span className="price">{activeGeo === 'India' ? '₹' : activeGeo === 'Europe' ? '€' : '$'}{quote.c?.toFixed(2)}</span>
                                  <span className={chg >= 0 ? 'up' : 'down'}>{chg >= 0 ? '▲' : '▼'} {chg?.toFixed(2)}%</span>
                                </div>
                                {quote.h && quote.l && quote.h > quote.l && (
                                  <div className="day-range" title={`Day Range: ${quote.l.toFixed(2)} - ${quote.h.toFixed(2)}`}>
                                    <div className="dr-low">L</div>
                                    <div className="dr-bar">
                                      <div className="dr-indicator" style={{left: `${Math.min(Math.max(((quote.c - quote.l) / (quote.h - quote.l)) * 100, 0), 100)}%`}}></div>
                                    </div>
                                    <div className="dr-high">H</div>
                                  </div>
                                )}
                              </>
                            )
                          ) : (
                            <div style={{display:'flex', flexDirection:'column', gap:'6px'}}>
                              <div className="skeleton" style={{height:'16px', width:'60%'}}></div>
                              <div className="skeleton" style={{height:'8px', width:'100%'}}></div>
                            </div>
                          )}
                        </div>

                        <div className="field catalyst">
                          <div className="field-label"><span className="dot catalyst"></span>Future Catalyst</div>
                          <div className="field-text">{st.catalyst}</div>
                        </div>
                        <div className="field moat">
                          <div className="field-label"><span className="dot moat"></span>Competitive Moat</div>
                          <div className="field-text">{st.moat}</div>
                        </div>
                        <div className="field risk">
                          <div className="field-label"><span className="dot risk"></span>Risk Factor</div>
                          <div className="field-text">{st.risk}</div>
                        </div>

                        {expandedCard === st.t && (
                          <div className="card-details" onClick={(e) => e.stopPropagation()}>
                            {d?.loading && <div className="details-loading">Loading metrics, charts & news...</div>}
                            {d?.error && <div className="details-error">Failed to load deep metrics.</div>}
                            
                            {d?.metrics && (
                              <div className="metrics-grid">
                                <div className="metric-item"><span>Mkt Cap</span><strong>{d.metrics.metric?.marketCapitalization ? '$' + (d.metrics.metric.marketCapitalization / 1000).toFixed(1) + 'B' : 'N/A'}</strong></div>
                                <div className="metric-item"><span>P/E (Ann)</span><strong>{d.metrics.metric?.peNormalizedAnnual?.toFixed(1) || 'N/A'}</strong></div>
                                <div className="metric-item"><span>52W High</span><strong>{d.metrics.metric?.['52WeekHigh'] ? '$' + d.metrics.metric['52WeekHigh'].toFixed(2) : 'N/A'}</strong></div>
                                <div className="metric-item"><span>52W Low</span><strong>{d.metrics.metric?.['52WeekLow'] ? '$' + d.metrics.metric['52WeekLow'].toFixed(2) : 'N/A'}</strong></div>
                              </div>
                            )}
                            
                            {d?.candle?.s === 'ok' && (
                              <div className="chart-wrapper">
                                <div className="sparkline-title">6-Month Interactive Chart</div>
                                <ChartComponent data={d.candle} color={d.candle.c[d.candle.c.length-1] >= d.candle.c[0] ? '#26a69a' : '#ef5350'} />
                              </div>
                            )}

                            {d?.news && d.news.length > 0 && (
                              <div className="news-feed">
                                <div className="sparkline-title" style={{ marginTop: '16px' }}>Recent News</div>
                                {d.news.map((n: any, idx: number) => (
                                  <a key={idx} href={n.url} target="_blank" rel="noopener noreferrer" className="news-item">
                                    <div className="news-source">{n.source} • {new Date(n.datetime * 1000).toLocaleDateString()}</div>
                                    <div className="news-headline">{n.headline}</div>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          });

          if (!secStockCount) return null;

          return (
            <section key={si} className={`sector ${openSectors[si] ? 'open' : ''}`}>
              <div className="sector-head" onClick={() => toggleSector(si)}>
                <span className="sector-num">{sec.num}</span>
                <span className="sector-title">{sec.sector}</span>
                <span className="sector-count">{secStockCount} names</span>
                <span className="chevron">▶</span>
              </div>
              <div className="sector-body">{subsHtml}</div>
            </section>
          );
        })}
      </div>

      {/* Floating Action Button — Manual AI Scan */}
      <button
        id="fabScanButton"
        className={`fab-scan ${scanStatus}`}
        onClick={triggerManualScan}
        title={scanStatus === 'scanning' ? 'Scanning…' : 'Trigger Manual AI Scan'}
        aria-label="Trigger Manual AI Market Scan"
      >
        {scanStatus === 'scanning' ? (
          <svg className="fab-icon spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" />
          </svg>
        ) : scanStatus === 'done' ? (
          <svg className="fab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 13l4 4L19 7" />
          </svg>
        ) : scanStatus === 'error' ? (
          <svg className="fab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg className="fab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        )}
        <span className="fab-label">
          {scanStatus === 'scanning' ? 'Scanning…' : scanStatus === 'done' ? 'Scan Sent!' : scanStatus === 'error' ? 'Failed' : 'AI Scan'}
        </span>
      </button>
    </>
  );
}
