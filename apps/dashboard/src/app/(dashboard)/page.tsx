"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from 'next/dynamic';
import { useSession } from "next-auth/react";
import stocksData from "../../data/stocks.json";

import { useRouter } from "next/navigation";

const ChartComponent = dynamic(() => import('../ChartComponent'), { ssr: false });

export default function DashboardOverview() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push('/landing');
    }
  }, [status, router]);

  const [activeGeo, setActiveGeo] = useState<"US" | "Europe" | "India" | "Pre-IPO">("India");
  const [activeType, setActiveType] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [marketData, setMarketData] = useState<any>(stocksData);
  const [isIndiaFetched, setIsIndiaFetched] = useState(false);
  const [loadingUniverse, setLoadingUniverse] = useState(false);
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

  useEffect(() => {
    if (activeGeo === 'India') {
      fetchUniverse();
    }
  }, [activeGeo]);

  const fetchUniverse = async () => {
    if (isIndiaFetched) {
      // Already fetched from API
      return;
    }
    setLoadingUniverse(true);
    try {
      const res = await fetch(`/go-api/universe?region=India&page=1&limit=3000`);
      if (res.ok) {
        const data = await res.json();
        
        // Transform flat API response to nested format expected by UI
        const sectorsMap: Record<string, any> = {};
        
        // Map API data back to flat format
        const apiFlat = (data.stocks || []).map((st: any) => ({
          t: st.ticker,
          c: st.company,
          cap: st.cap || 'Mid',
          type: st.type || 'established',
          catalyst: st.catalyst || '',
          moat: st.moat || '',
          risk: st.risk || '',
          sector: st.sector,
          subIndustry: st.sub_industry || 'Other',
          trailing_pe: st.trailing_pe || 0,
          eps: st.eps || 0,
          pb_ratio: st.pb_ratio || 0,
          market_cap_val: st.market_cap_val || 0,
          last_price: st.last_price || 0,
          change_percent: st.change_percent || 0
        }));

        apiFlat.forEach((st: any) => {
          if (!sectorsMap[st.sector]) {
            sectorsMap[st.sector] = { sector: st.sector, num: Object.keys(sectorsMap).length + 1, subsMap: {} };
          }
          if (!sectorsMap[st.sector].subsMap[st.subIndustry]) {
            sectorsMap[st.sector].subsMap[st.subIndustry] = { name: st.subIndustry, stocks: [] };
          }
          sectorsMap[st.sector].subsMap[st.subIndustry].stocks.push(st);
        });

        const newIndiaData = Object.values(sectorsMap).map((sec: any) => ({
          sector: sec.sector,
          num: sec.num,
          subs: Object.values(sec.subsMap)
        }));

        setMarketData((prev: any) => ({ ...prev, India: newIndiaData }));
        setIsIndiaFetched(true);
      }
    } catch (e) {
      console.error("Failed to fetch universe", e);
    } finally {
      setLoadingUniverse(false);
    }
  };

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

  useEffect(() => {
    // Connect to Go Backend WebSocket for Live Prices
    const wsUrl = process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws') || 'ws://127.0.0.1:8080';
    const ws = new WebSocket(`${wsUrl}/ws/live`);
    
    ws.onmessage = (event) => {
      try {
        const tick = JSON.parse(event.data);
        if (tick.ticker && tick.last_price) {
          setQuotes(prev => ({ 
            ...prev, 
            [tick.ticker]: { 
              ...prev[tick.ticker],
              c: tick.last_price,
              dp: tick.change_percent 
            } 
          }));
        }
      } catch (e) {
        console.error("WS Parse Error:", e);
      }
    };

    return () => ws.close();
  }, []);

  const toggleSector = (idx: number) => {
    setOpenSectors(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

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
        {loadingUniverse ? (
          <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--muted)', fontFamily: '"Spline Sans Mono", monospace' }}>
            Loading all 2000+ Institutional equities into memory...
          </div>
        ) : (
          (() => {
            const renderSectorBlock = (sec: any, si: number) => {
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
                        className={`card`}
                        onClick={() => toggleCard(st.t)}
                        style={{ '--type-color': colorMap[st.type] } as any}
                      >
                        <div className="card-top">
                          <div>
                            <div className="ticker">{st.t.split('.')[0]}</div>
                            <div className="company">{st.c}</div>
                          </div>
                          <div className="badges">
                            {st.trailing_pe > 0 && <span className="badge" style={{background: 'var(--bg2)', color: 'var(--ink)'}}>PE: {st.trailing_pe.toFixed(1)}</span>}
                            {st.eps !== 0 && st.eps !== undefined && <span className="badge" style={{background: 'var(--bg2)', color: 'var(--ink)'}}>EPS: {st.eps.toFixed(1)}</span>}
                            <span className="badge cap" style={{background: st.cap === 'Large' ? 'rgba(46,160,67,0.1)' : 'var(--bg2)', color: st.cap === 'Large' ? 'var(--established)' : 'var(--muted)'}}>{st.cap}</span>
                          </div>
                        </div>
                        
                        <div className="live-quote">
                          {quote ? (
                            quote.error || quote.c === 0 ? (
                              <div className="lq-top"><span>{st.t.split('.')[0]}</span><span style={{color:'var(--danger)'}}>no data</span></div>
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

                        {/* Clean grid card - details moved to Slide-Over Drawer */}
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
        };

        if (activeGeo === 'India') {
          const listedSectors = currentData.filter((sec: any) => sec.sector !== 'SME Emerge');
          const smeSectors = currentData.filter((sec: any) => sec.sector === 'SME Emerge');
          
          return (
            <>
              {listedSectors.length > 0 && (
                <div className="macro-section">
                  <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '24px', paddingBottom: '12px', borderBottom: '1px solid var(--line)', marginBottom: '24px', color: 'var(--ink)' }}>
                    NSE & BSE Listed Stocks
                  </h2>
                  {listedSectors.map((sec: any, i: number) => renderSectorBlock(sec, i))}
                </div>
              )}
              
              {smeSectors.length > 0 && (
                <div className="macro-section" style={{ marginTop: '64px' }}>
                  <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '24px', paddingBottom: '12px', borderBottom: '1px solid var(--line)', marginBottom: '24px', color: 'var(--ink)' }}>
                    NSE & BSE SME Stocks
                  </h2>
                  {smeSectors.map((sec: any, i: number) => renderSectorBlock(sec, i + listedSectors.length))}
                </div>
              )}
            </>
          );
        }

        // Default behavior for US, Europe, Pre-IPO
        return currentData.map((sec: any, si: number) => renderSectorBlock(sec, si));
      })()
      )}
      </div>

      {/* Floating Action Button — Manual AI Scan */}
      <button 
        className={`fab-scan ${scanStatus}`} 
        onClick={triggerManualScan}
        disabled={scanStatus === 'scanning' || scanStatus === 'done'}
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

      {/* --- SLIDE-OVER DRAWER --- */}
      {expandedCard && (() => {
        const selectedStock = allStocks.find((s: any) => s.t === expandedCard);
        const sq = quotes[expandedCard];
        const sd = details[expandedCard];
        if (!selectedStock) return null;

        const chg = sq && sq.pc ? ((sq.c - sq.pc) / sq.pc) * 100 : 0;
        
        return (
          <>
            <div className="drawer-overlay" onClick={() => setExpandedCard(null)}></div>
            <div className="drawer-panel">
              <div className="drawer-header">
                <div className="drawer-header-info">
                  <h2>{selectedStock.t.split('.')[0]}</h2>
                  <p>{selectedStock.c}</p>
                </div>
                <button className="drawer-close" onClick={() => setExpandedCard(null)}>✕</button>
              </div>

              <div className="drawer-content">
                {/* Price Section */}
                <div className="drawer-price-card">
                  {sq ? (
                    <div className="dp-live">
                      <div className="dp-main">
                        <span className="dp-val">{activeGeo === 'India' ? '₹' : activeGeo === 'Europe' ? '€' : '$'}{sq.c?.toFixed(2)}</span>
                        <span className={`dp-chg ${chg >= 0 ? 'up' : 'down'}`}>
                          {chg >= 0 ? '▲' : '▼'} {chg?.toFixed(2)}%
                        </span>
                      </div>
                      <div className="badges">
                        <span className={`badge ${selectedStock.type}`}>{selectedStock.type}</span>
                        <span className="badge cap">{selectedStock.cap} cap</span>
                      </div>
                    </div>
                  ) : (
                    <div className="skeleton" style={{height:'30px', width:'100px'}}></div>
                  )}
                </div>

                {/* Qualitative Fields */}
                <div className="drawer-section">
                  <h3>AI Qualitative Analysis</h3>
                  <div className="field catalyst">
                    <div className="field-label"><span className="dot catalyst"></span>Future Catalyst</div>
                    <div className="field-text">{selectedStock.catalyst}</div>
                  </div>
                  <div className="field moat">
                    <div className="field-label"><span className="dot moat"></span>Competitive Moat</div>
                    <div className="field-text">{selectedStock.moat}</div>
                  </div>
                  <div className="field risk">
                    <div className="field-label"><span className="dot risk"></span>Risk Factor</div>
                    <div className="field-text">{selectedStock.risk}</div>
                  </div>
                </div>

                {/* Details / Chart / News */}
                {sd?.loading && <div className="details-loading">Loading deep metrics...</div>}
                {sd?.error && <div className="details-error">Failed to load API details.</div>}

                {sd?.metrics && (
                  <div className="drawer-section">
                    <h3>Technicals & Valuation</h3>
                    <div className="metrics-grid">
                      <div className="metric-item"><span>Mkt Cap</span><strong>{sd.metrics.metric?.marketCapitalization ? '$' + (sd.metrics.metric.marketCapitalization / 1000).toFixed(1) + 'B' : 'N/A'}</strong></div>
                      <div className="metric-item"><span>P/E (Ann)</span><strong>{sd.metrics.metric?.peNormalizedAnnual?.toFixed(1) || 'N/A'}</strong></div>
                      <div className="metric-item"><span>52W High</span><strong>{sd.metrics.metric?.['52WeekHigh'] ? '$' + sd.metrics.metric['52WeekHigh'].toFixed(2) : 'N/A'}</strong></div>
                      <div className="metric-item"><span>52W Low</span><strong>{sd.metrics.metric?.['52WeekLow'] ? '$' + sd.metrics.metric['52WeekLow'].toFixed(2) : 'N/A'}</strong></div>
                    </div>
                  </div>
                )}

                {sd?.candle?.s === 'ok' && (
                  <div className="drawer-section">
                    <h3>6-Month Interactive Chart</h3>
                    <div className="chart-wrapper">
                      <ChartComponent data={sd.candle} color={sd.candle.c[sd.candle.c.length-1] >= sd.candle.c[0] ? '#26a69a' : '#ef5350'} />
                    </div>
                  </div>
                )}

                {sd?.news && sd.news.length > 0 && (
                  <div className="drawer-section">
                    <h3>Recent Institutional News</h3>
                    <div className="news-feed">
                      {sd.news.map((n: any, idx: number) => (
                        <a key={idx} href={n.url} target="_blank" rel="noopener noreferrer" className="news-item">
                          <div className="news-source">{n.source} • {new Date(n.datetime * 1000).toLocaleDateString()}</div>
                          <div className="news-headline">{n.headline}</div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}

    </>
  );
}
