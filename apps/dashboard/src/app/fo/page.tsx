"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Line } from "recharts";
import { calculateBlackScholes, getYearsToExpiry } from "@/utils/blackScholes";

import stocksData from "../../data/stocks.json";

// Dynamically build base categories from the master dataset
const BASE_CATEGORIES: Record<string, string[]> = {};
stocksData.India.forEach((sector: any) => {
  sector.subs.forEach((sub: any) => {
    const categoryName = `${sector.sector} - ${sub.name}`;
    BASE_CATEGORIES[categoryName] = sub.stocks.map((s: any) => s.t.replace('.NS', ''));
  });
});

interface ChainRow {
  strikePrice: number;
  expiryDate: string;
  CE: { oi: number; changeInOI: number; volume: number; iv: number; ltp: number; change: number } | null;
  PE: { oi: number; changeInOI: number; volume: number; iv: number; ltp: number; change: number } | null;
}

interface StrategyLeg {
  id: string;
  type: "CE" | "PE";
  action: "B" | "S";
  strike: number;
  premium: number;
  qty: number;
  iv: number;
}

export default function FOPage() {
  const [symbol, setSymbol] = useState("NIFTY");
  const [symbolType, setSymbolType] = useState<"index" | "equity">("index");
  const [chainData, setChainData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<string>("");
  const [strikeRange, setStrikeRange] = useState(10);
  
  // Custom Dropdown State
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSector, setExpandedSector] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [liveSymbols, setLiveSymbols] = useState<Record<string, string[]>>(BASE_CATEGORIES);

  // Strategy Builder State
  const [strategyLegs, setStrategyLegs] = useState<StrategyLeg[]>([]);
  const [defaultQty, setDefaultQty] = useState(1);

  useEffect(() => {
    fetch('/api/fo/symbols')
      .then(res => res.json())
      .then(data => {
        if (data.symbols?.length) {
          const categorized = { ...BASE_CATEGORIES, "Others": [] as string[] };
          const knownStocks = new Set(Object.values(BASE_CATEGORIES).flat());
          
          data.symbols.forEach((sym: string) => {
            if (!knownStocks.has(sym)) {
              categorized["Others"].push(sym);
            }
          });
          
          // @ts-ignore
          if (categorized["Others"].length === 0) delete categorized["Others"];
          setLiveSymbols(categorized);
        }
      })
      .catch(err => console.error("Failed to load live F&O symbols:", err));
  }, []);

  const fetchChain = async (sym: string, type: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fo/option-chain?symbol=${sym}&type=${type}`);
      const data = await res.json();
      if (data.error) throw new Error(data.details || data.error);
      setChainData(data);
      if (data.expiryDates?.length > 0 && !selectedExpiry) {
        setSelectedExpiry(data.expiryDates[0]);
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchChain(symbol, symbolType);
    setStrategyLegs([]); // Reset strategy on symbol change
  }, [symbol, symbolType]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredData: ChainRow[] = useMemo(() => {
    if (!chainData?.data) return [];
    const rows = chainData.data.filter((r: ChainRow) => r.expiryDate === selectedExpiry);
    const atm = chainData.underlyingValue || 0;
    const sorted = rows.sort((a: ChainRow, b: ChainRow) => a.strikePrice - b.strikePrice);
    const atmIdx = sorted.findIndex((r: ChainRow) => r.strikePrice >= atm);
    const start = Math.max(0, atmIdx - strikeRange);
    const end = Math.min(sorted.length, atmIdx + strikeRange + 1);
    return sorted.slice(start, end);
  }, [chainData, selectedExpiry, strikeRange]);

  const oiAnalysis = useMemo(() => {
    if (!filteredData.length) return null;
    let totalCallOI = 0, totalPutOI = 0, maxCallOI = 0, maxCallStrike = 0, maxPutOI = 0, maxPutStrike = 0;
    filteredData.forEach(r => {
      const ceOI = r.CE?.oi || 0; const peOI = r.PE?.oi || 0;
      totalCallOI += ceOI; totalPutOI += peOI;
      if (ceOI > maxCallOI) { maxCallOI = ceOI; maxCallStrike = r.strikePrice; }
      if (peOI > maxPutOI) { maxPutOI = peOI; maxPutStrike = r.strikePrice; }
    });
    const pcr = totalCallOI > 0 ? (totalPutOI / totalCallOI) : 0;
    let maxPainStrike = 0, minPain = Infinity;
    filteredData.forEach(row => {
      let pain = 0;
      filteredData.forEach(r => {
        if (r.CE) pain += Math.max(0, row.strikePrice - r.strikePrice) * r.CE.oi;
        if (r.PE) pain += Math.max(0, r.strikePrice - row.strikePrice) * r.PE.oi;
      });
      if (pain < minPain) { minPain = pain; maxPainStrike = row.strikePrice; }
    });
    return { totalCallOI, totalPutOI, maxCallOI, maxCallStrike, maxPutOI, maxPutStrike, pcr, maxPainStrike };
  }, [filteredData]);

  const maxOI = useMemo(() => {
    let m = 0;
    filteredData.forEach(r => { m = Math.max(m, r.CE?.oi || 0, r.PE?.oi || 0); });
    return m;
  }, [filteredData]);

  const handleSymbolChange = (sym: string, type: "index" | "equity") => {
    setSymbol(sym);
    setSymbolType(type);
    setSelectedExpiry("");
    setDropdownOpen(false);
    setSearchQuery("");
  };

  // --- Strategy Builder Methods ---
  const addLeg = (type: "CE" | "PE", action: "B" | "S", strike: number, premium: number, iv: number) => {
    const id = `${type}_${strike}_${action}`;
    if (strategyLegs.some(l => l.id === id)) return;
    setStrategyLegs([...strategyLegs, { id, type, action, strike, premium, qty: defaultQty, iv: iv || 15 }]);
  };

  const removeLeg = (id: string) => {
    setStrategyLegs(strategyLegs.filter(l => l.id !== id));
  };

  const updateLegQty = (id: string, qty: number) => {
    if (qty <= 0) return;
    setStrategyLegs(strategyLegs.map(l => l.id === id ? { ...l, qty } : l));
  };

  const applyPrebuilt = (strategyName: string) => {
    const spot = chainData?.underlyingValue;
    if (!spot || !filteredData.length) return;
    
    const sorted = [...filteredData].sort((a,b) => a.strikePrice - b.strikePrice);
    const atmIdx = sorted.findIndex(r => r.strikePrice >= spot);
    if (atmIdx === -1) return;
    
    const atmRow = sorted[atmIdx];
    const newLegs: StrategyLeg[] = [];
    
    const add = (r: ChainRow, type: 'CE'|'PE', action: 'B'|'S') => {
      const opt = r[type];
      if (opt) {
        newLegs.push({ id: `${type}_${r.strikePrice}_${action}`, type, action, strike: r.strikePrice, premium: opt.ltp, qty: defaultQty, iv: opt.iv || 15 });
      }
    };

    if (strategyName === 'Long Straddle') {
       add(atmRow, 'CE', 'B'); add(atmRow, 'PE', 'B');
    } else if (strategyName === 'Short Strangle') {
       const otmCall = sorted[atmIdx + 2]; const otmPut = sorted[Math.max(0, atmIdx - 2)];
       if(otmCall) add(otmCall, 'CE', 'S'); if(otmPut) add(otmPut, 'PE', 'S');
    } else if (strategyName === 'Bull Call Spread') {
       add(atmRow, 'CE', 'B'); const otmCall = sorted[atmIdx + 2];
       if(otmCall) add(otmCall, 'CE', 'S');
    } else if (strategyName === 'Bear Put Spread') {
       add(atmRow, 'PE', 'B'); const otmPut = sorted[Math.max(0, atmIdx - 2)];
       if(otmPut) add(otmPut, 'PE', 'S');
    } else if (strategyName === 'Iron Condor') {
       const otmPutSell = sorted[Math.max(0, atmIdx - 2)]; const otmPutBuy = sorted[Math.max(0, atmIdx - 4)];
       const otmCallSell = sorted[atmIdx + 2]; const otmCallBuy = sorted[atmIdx + 4];
       if(otmPutSell) add(otmPutSell, 'PE', 'S'); if(otmPutBuy) add(otmPutBuy, 'PE', 'B');
       if(otmCallSell) add(otmCallSell, 'CE', 'S'); if(otmCallBuy) add(otmCallBuy, 'CE', 'B');
    }
    setStrategyLegs(newLegs);
  };

  // Payoff Calculation Engine
  const strategyPayoff = useMemo(() => {
    if (strategyLegs.length === 0) return null;
    const spot = chainData?.underlyingValue || 0;
    const tToExpiry = getYearsToExpiry(selectedExpiry);
    
    // Evaluate payoff at critical points to find Max Profit/Loss
    const evalStrikes = strategyLegs.map(l => l.strike);
    const pointsToEval = [0, spot * 3, ...evalStrikes].sort((a, b) => a - b);
    
    let maxProfit = -Infinity;
    let maxLoss = Infinity;
    let netPremium = 0;

    strategyLegs.forEach(leg => {
      const legCost = leg.premium * leg.qty;
      if (leg.action === 'B') netPremium -= legCost;
      if (leg.action === 'S') netPremium += legCost;
    });

    const getPnlAtPrice = (p: number, isT0: boolean = false) => {
      let pnl = 0;
      strategyLegs.forEach(leg => {
        let legVal = 0;
        if (isT0) {
          legVal = calculateBlackScholes({ S: p, K: leg.strike, t: tToExpiry, r: 0.07, v: leg.iv / 100, type: leg.type });
        } else {
          if (leg.type === 'CE') legVal = Math.max(0, p - leg.strike);
          if (leg.type === 'PE') legVal = Math.max(0, leg.strike - p);
        }
        const legPnl = leg.action === 'B' ? (legVal - leg.premium) : (leg.premium - legVal);
        pnl += legPnl * leg.qty;
      });
      return pnl;
    };

    pointsToEval.forEach(p => {
      const pnl = getPnlAtPrice(p, false);
      if (pnl > maxProfit) maxProfit = pnl;
      if (pnl < maxLoss) maxLoss = pnl;
    });

    // Generate curve data for chart
    const minStrike = Math.min(...evalStrikes, spot * 0.9);
    const maxStrike = Math.max(...evalStrikes, spot * 1.1);
    const chartRange = (maxStrike - minStrike) * 1.2;
    const startP = Math.max(0, minStrike - chartRange * 0.2);
    const endP = maxStrike + chartRange * 0.2;
    const step = (endP - startP) / 100;
    
    const chartData = [];
    for (let p = startP; p <= endP; p += step) {
      chartData.push({ 
        price: Math.round(p), 
        pnlExpiry: Math.round(getPnlAtPrice(p, false)),
        pnlT0: Math.round(getPnlAtPrice(p, true))
      });
    }

    return { 
      maxProfit: maxProfit > 10000000 ? "Unlimited" : maxProfit, 
      maxLoss: maxLoss < -10000000 ? "Unlimited" : maxLoss, 
      netPremium, 
      chartData 
    };
  }, [strategyLegs, chainData]);

  // CSS for gradient
  const gradientOffset = () => {
    if (!strategyPayoff?.chartData || strategyPayoff.chartData.length === 0) return 0;
    const dataMax = Math.max(...strategyPayoff.chartData.map(i => i.pnlExpiry));
    const dataMin = Math.min(...strategyPayoff.chartData.map(i => i.pnlExpiry));
    if (dataMax <= 0) return 0;
    if (dataMin >= 0) return 1;
    return dataMax / (dataMax - dataMin);
  };
  const off = gradientOffset();

  return (
    <div className="fo-page" style={{ paddingBottom: strategyLegs.length > 0 ? '500px' : '0' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .custom-dropdown-container { position: relative; width: 260px; z-index: 9999; }
        .custom-dropdown-button { width: 100%; text-align: left; background: var(--panel-2); border: 1px solid var(--line); padding: 10px 14px; border-radius: 8px; color: var(--fg); cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-family: 'Spline Sans Mono', monospace; font-size: 13px; font-weight: 500; transition: all 0.2s ease; }
        .custom-dropdown-button:hover { background: var(--panel-3); border-color: var(--line-light); }
        .custom-dropdown-button:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2); }
        .custom-dropdown-popover { position: absolute; top: calc(100% + 6px); left: 0; width: 320px; background: #0f172a; border: 1px solid #334155; border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.6); max-height: 400px; overflow: hidden; display: flex; flex-direction: column; animation: slideDown 0.15s ease-out; z-index: 10000; }
        .custom-dropdown-search { padding: 12px; border-bottom: 1px solid #334155; background: #1e293b; }
        .custom-dropdown-search input { width: 100%; background: #0f172a; border: 1px solid #475569; padding: 8px 12px; border-radius: 6px; color: #f8fafc; font-size: 13px; font-family: inherit; transition: border 0.2s; }
        .custom-dropdown-search input:focus { outline: none; border-color: #818cf8; box-shadow: 0 0 0 2px rgba(129, 140, 248, 0.2); }
        .custom-dropdown-search input::placeholder { color: #64748b; }
        .custom-dropdown-list { overflow-y: auto; flex: 1; padding: 6px 0; background: #0f172a; }
        .custom-dropdown-group { padding: 10px 16px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #818cf8; font-weight: 700; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s; background: #0f172a; }
        .custom-dropdown-group:hover { background: #1e293b; }
        .custom-dropdown-item { padding: 8px 16px 8px 24px; font-size: 13px; cursor: pointer; color: #cbd5e1; font-family: 'Spline Sans Mono', monospace; font-weight: 500; transition: background 0.15s; border-left: 2px solid transparent; background: #0f172a; }
        .custom-dropdown-item:hover { background: #1e293b; color: #fff; }
        .custom-dropdown-item.active { background: rgba(99, 102, 241, 0.15); color: #818cf8; border-left-color: #818cf8; }
        .fo-empty-search { padding: 20px; text-align: center; color: #64748b; font-size: 13px; background: #0f172a; }
        
        .leg-action-btn { background: transparent; border: 1px solid var(--line); color: var(--muted); padding: 2px 6px; border-radius: 4px; font-size: 11px; cursor: pointer; transition: all 0.2s; margin: 0 2px; font-weight: 700; }
        .leg-action-btn:hover { border-color: var(--fg); color: var(--fg); }
        .leg-action-btn.buy:hover { background: rgba(16, 185, 129, 0.15); border-color: var(--accent); color: var(--accent); }
        .leg-action-btn.sell:hover { background: rgba(239, 68, 68, 0.15); border-color: var(--danger); color: var(--danger); }
        
        .strategy-panel { position: fixed; bottom: 0; left: 0; right: 0; background: var(--panel-1); border-top: 1px solid var(--line); box-shadow: 0 -20px 50px rgba(0,0,0,0.6); z-index: 5000; display: flex; height: 500px; animation: slideUp 0.3s ease-out; backdrop-filter: blur(24px); }
        
        /* New 3-column Layout for Sensibull feel */
        .strat-col-tools { width: 280px; border-right: 1px solid var(--line); padding: 20px; display: flex; flex-direction: column; overflow-y: auto; background: var(--panel-1); }
        .strat-col-chart { flex: 1; padding: 20px; display: flex; flex-direction: column; background: var(--panel-2); position: relative; }
        .strat-col-legs { width: 340px; border-left: 1px solid var(--line); padding: 20px; display: flex; flex-direction: column; overflow-y: auto; background: var(--panel-1); }
        
        .prebuilt-btn { width: 100%; text-align: left; padding: 10px 14px; background: var(--panel-2); border: 1px solid var(--line); border-radius: 8px; margin-bottom: 8px; color: var(--fg); cursor: pointer; transition: all 0.15s; font-size: 13px; font-weight: 500; }
        .prebuilt-btn:hover { background: rgba(99, 102, 241, 0.1); border-color: var(--accent); color: var(--accent); transform: translateX(2px); }
        
        .leg-card { background: var(--panel-2); border: 1px solid var(--line); border-radius: 8px; padding: 12px; margin-bottom: 10px; display: flex; flex-direction: column; gap: 8px; }
        .leg-badge.buy { background: rgba(16, 185, 129, 0.15); color: var(--accent); padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 800; }
        .leg-badge.sell { background: rgba(239, 68, 68, 0.15); color: var(--danger); padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 800; }
        .leg-del { color: var(--muted); cursor: pointer; padding: 4px; border-radius: 4px; transition: color 0.15s; }
        .leg-del:hover { background: rgba(255,255,255,0.1); color: var(--danger); }
        
        .strategy-metrics { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
        .strat-metric { background: var(--panel-1); padding: 16px; border-radius: 12px; border: 1px solid var(--line); flex: 1; min-width: 120px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .strat-metric-label { font-size: 11px; text-transform: uppercase; color: var(--muted); letter-spacing: 0.5px; margin-bottom: 6px; font-weight: 600; }
        .strat-metric-value { font-family: 'Spline Sans Mono', monospace; font-size: 20px; font-weight: 800; }
        .text-green { color: #10b981; }
        .text-red { color: #ef4444; }
        .text-blue { color: #3b82f6; }
        
        .chart-legend { position: absolute; top: 20px; right: 20px; display: flex; gap: 16px; background: var(--panel-1); padding: 8px 12px; border-radius: 20px; border: 1px solid var(--line); z-index: 10; font-size: 12px; font-weight: 600; }
        .legend-item { display: flex; align-items: center; gap: 6px; }
        .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
        
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}} />

      {/* Header */}
      <div className="fo-header">
        <div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '36px', fontWeight: 900 }}>
            F&O Terminal
          </h1>
          <p style={{ color: 'var(--muted)', marginTop: '6px', fontSize: '14px' }}>
            NSE Derivatives — Options Chain, Open Interest Analysis & Max Pain
          </p>
        </div>
        <a href="/" className="fo-back-btn">← Back to Dashboard</a>
      </div>

      {/* Symbol Selector */}
      <div className="fo-controls">
        <div className="fo-control-group">
          <label>Index</label>
          <div className="fo-chips">
            {["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"].map(s => (
              <button key={s} className={symbol === s ? "fo-chip active" : "fo-chip"}
                onClick={() => handleSymbolChange(s, "index")}>{s}</button>
            ))}
          </div>
        </div>
        
        <div className="fo-control-group">
          <label>Equity</label>
          <div className="custom-dropdown-container" ref={dropdownRef}>
            <button className="custom-dropdown-button" onClick={() => setDropdownOpen(!dropdownOpen)}>
              {symbolType === 'equity' ? symbol : 'Select Sector...'}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            {dropdownOpen && (
              <div className="custom-dropdown-popover">
                <div className="custom-dropdown-search">
                  <input type="text" placeholder="Search 210+ F&O stocks..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus />
                </div>
                <div className="custom-dropdown-list">
                  {Object.entries(liveSymbols).map(([sector, stocks]) => {
                    const filtered = stocks.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
                    if (filtered.length === 0) return null;
                    const isExpanded = searchQuery.length > 0 || expandedSector === sector;
                    return (
                      <div key={sector}>
                        <div className="custom-dropdown-group" onClick={() => setExpandedSector(isExpanded && !searchQuery ? null : sector)}>
                          {sector} <span style={{fontSize:'10px', color:'var(--dim)'}}>{isExpanded ? '▼' : '▶'}</span>
                        </div>
                        {isExpanded && filtered.map(s => (
                          <div key={s} className={`custom-dropdown-item ${symbol === s ? 'active' : ''}`} onClick={() => handleSymbolChange(s, "equity")}>{s}</div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {chainData?.expiryDates?.length > 0 && (
          <div className="fo-control-group">
            <label>Expiry</label>
            <div className="fo-chips">
              {chainData.expiryDates.slice(0, 4).map((exp: string) => (
                <button key={exp} className={selectedExpiry === exp ? "fo-chip active" : "fo-chip"}
                  onClick={() => setSelectedExpiry(exp)}>
                  {exp}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="fo-control-group">
          <label>Strikes</label>
          <div className="fo-chips">
            {[5, 10, 15, 20, 30].map(n => (
              <button key={n} className={strikeRange === n ? "fo-chip active" : "fo-chip"}
                onClick={() => setStrikeRange(n)}>±{n}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Option Chain Table */}
      {!loading && filteredData.length > 0 && (
        <div className="fo-chain-wrapper">
          <table className="fo-chain-table">
            <thead>
              <tr>
                <th colSpan={7} className="fo-side-header fo-call-header">CALLS</th>
                <th className="fo-strike-header">STRIKE</th>
                <th colSpan={7} className="fo-side-header fo-put-header">PUTS</th>
              </tr>
              <tr>
                <th>OI</th><th>Chg OI</th><th>Volume</th><th>IV</th><th>LTP</th><th>Chg</th><th>Build</th>
                <th className="fo-strike-col"></th>
                <th>Build</th><th>Chg</th><th>LTP</th><th>IV</th><th>Volume</th><th>Chg OI</th><th>OI</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row) => {
                const isATM = chainData?.underlyingValue &&
                  Math.abs(row.strikePrice - chainData.underlyingValue) ===
                  Math.min(...filteredData.map((r: ChainRow) => Math.abs(r.strikePrice - chainData.underlyingValue)));
                const isITMCall = row.strikePrice < (chainData?.underlyingValue || 0);
                const isITMPut = row.strikePrice > (chainData?.underlyingValue || 0);
                const ceOIWidth = maxOI > 0 ? ((row.CE?.oi || 0) / maxOI) * 100 : 0;
                const peOIWidth = maxOI > 0 ? ((row.PE?.oi || 0) / maxOI) * 100 : 0;

                return (
                  <tr key={row.strikePrice} className={isATM ? 'fo-atm-row' : ''}>
                    <td className={isITMCall ? 'fo-itm' : ''}>
                      <div className="fo-oi-bar-cell">
                        <div className="fo-oi-bar fo-call-bar" style={{ width: `${ceOIWidth}%` }}></div>
                        <span>{row.CE?.oi?.toLocaleString() || '-'}</span>
                      </div>
                    </td>
                    <td className={isITMCall ? 'fo-itm' : ''} style={{ color: (row.CE?.changeInOI || 0) > 0 ? 'var(--accent)' : 'var(--danger)' }}>
                      {row.CE?.changeInOI?.toLocaleString() || '-'}
                    </td>
                    <td className={isITMCall ? 'fo-itm' : ''}>{row.CE?.volume?.toLocaleString() || '-'}</td>
                    <td className={isITMCall ? 'fo-itm' : ''}>{row.CE?.iv?.toFixed(1) || '-'}</td>
                    <td className={isITMCall ? 'fo-itm' : ''} style={{ fontWeight: 600 }}>{row.CE?.ltp?.toFixed(2) || '-'}</td>
                    <td className={isITMCall ? 'fo-itm' : ''} style={{ color: (row.CE?.change || 0) >= 0 ? 'var(--accent)' : 'var(--danger)' }}>
                      {row.CE?.change?.toFixed(2) || '-'}
                    </td>
                    <td className={isITMCall ? 'fo-itm' : ''} style={{ whiteSpace: 'nowrap' }}>
                      {row.CE && (
                        <>
                          <button className="leg-action-btn buy" onClick={() => addLeg('CE', 'B', row.strikePrice, row.CE!.ltp, row.CE!.iv)}>B</button>
                          <button className="leg-action-btn sell" onClick={() => addLeg('CE', 'S', row.strikePrice, row.CE!.ltp, row.CE!.iv)}>S</button>
                        </>
                      )}
                    </td>
                    <td className="fo-strike-col">{row.strikePrice.toLocaleString('en-IN')}</td>
                    <td className={isITMPut ? 'fo-itm' : ''} style={{ whiteSpace: 'nowrap' }}>
                      {row.PE && (
                        <>
                          <button className="leg-action-btn buy" onClick={() => addLeg('PE', 'B', row.strikePrice, row.PE!.ltp, row.PE!.iv)}>B</button>
                          <button className="leg-action-btn sell" onClick={() => addLeg('PE', 'S', row.strikePrice, row.PE!.ltp, row.PE!.iv)}>S</button>
                        </>
                      )}
                    </td>
                    <td className={isITMPut ? 'fo-itm' : ''} style={{ color: (row.PE?.change || 0) >= 0 ? 'var(--accent)' : 'var(--danger)' }}>
                      {row.PE?.change?.toFixed(2) || '-'}
                    </td>
                    <td className={isITMPut ? 'fo-itm' : ''} style={{ fontWeight: 600 }}>{row.PE?.ltp?.toFixed(2) || '-'}</td>
                    <td className={isITMPut ? 'fo-itm' : ''}>{row.PE?.iv?.toFixed(1) || '-'}</td>
                    <td className={isITMPut ? 'fo-itm' : ''}>{row.PE?.volume?.toLocaleString() || '-'}</td>
                    <td className={isITMPut ? 'fo-itm' : ''} style={{ color: (row.PE?.changeInOI || 0) > 0 ? 'var(--accent)' : 'var(--danger)' }}>
                      {row.PE?.changeInOI?.toLocaleString() || '-'}
                    </td>
                    <td className={isITMPut ? 'fo-itm' : ''}>
                      <div className="fo-oi-bar-cell">
                        <span>{row.PE?.oi?.toLocaleString() || '-'}</span>
                        <div className="fo-oi-bar fo-put-bar" style={{ width: `${peOIWidth}%` }}></div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Advanced Sensibull-like Strategy Builder Panel */}
      {strategyLegs.length > 0 && (
        <div className="strategy-panel">
          {/* Column 1: Tools & Pre-built Strategies */}
          <div className="strat-col-tools">
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: '20px', marginBottom: '20px' }}>Sensibull<span style={{color:'var(--dim)', fontSize:'12px'}}>Lite</span></h2>
            
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: 700 }}>Pre-built Strategies</div>
              <button className="prebuilt-btn" onClick={() => applyPrebuilt('Bull Call Spread')}>Bull Call Spread</button>
              <button className="prebuilt-btn" onClick={() => applyPrebuilt('Bear Put Spread')}>Bear Put Spread</button>
              <button className="prebuilt-btn" onClick={() => applyPrebuilt('Long Straddle')}>Long Straddle</button>
              <button className="prebuilt-btn" onClick={() => applyPrebuilt('Short Strangle')}>Short Strangle</button>
              <button className="prebuilt-btn" onClick={() => applyPrebuilt('Iron Condor')}>Iron Condor</button>
            </div>

            <button 
              onClick={() => setStrategyLegs([])}
              style={{ marginTop: 'auto', background: 'transparent', border: '1px solid var(--line)', color: 'var(--fg)', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              Clear All Legs
            </button>
          </div>

          {/* Column 2: Interactive Chart & Metrics */}
          <div className="strat-col-chart">
            {strategyPayoff && (
              <>
                <div className="chart-legend">
                  <div className="legend-item"><div className="legend-dot" style={{background: 'var(--fg)'}}></div> Expiry</div>
                  <div className="legend-item"><div className="legend-dot" style={{background: '#3b82f6'}}></div> T+0 (Today)</div>
                </div>
                
                <div className="strategy-metrics">
                  <div className="strat-metric">
                    <div className="strat-metric-label">Max Profit</div>
                    <div className={`strat-metric-value ${typeof strategyPayoff.maxProfit === 'string' ? 'text-green' : (strategyPayoff.maxProfit > 0 ? 'text-green' : 'text-red')}`}>
                      {typeof strategyPayoff.maxProfit === 'string' ? strategyPayoff.maxProfit : `₹${(strategyPayoff.maxProfit * defaultQty).toLocaleString('en-IN', {maximumFractionDigits:0})}`}
                    </div>
                  </div>
                  <div className="strat-metric">
                    <div className="strat-metric-label">Max Loss</div>
                    <div className={`strat-metric-value ${typeof strategyPayoff.maxLoss === 'string' ? 'text-red' : (strategyPayoff.maxLoss < 0 ? 'text-red' : 'text-green')}`}>
                      {typeof strategyPayoff.maxLoss === 'string' ? strategyPayoff.maxLoss : `₹${(strategyPayoff.maxLoss * defaultQty).toLocaleString('en-IN', {maximumFractionDigits:0})}`}
                    </div>
                  </div>
                  <div className="strat-metric">
                    <div className="strat-metric-label">Net Premium / Margin</div>
                    <div className="strat-metric-value" style={{ color: 'var(--fg)' }}>
                      ₹{Math.abs(strategyPayoff.netPremium * defaultQty).toLocaleString('en-IN', {maximumFractionDigits:0})} 
                      <span style={{fontSize:'12px', color:'var(--dim)', marginLeft:'6px'}}>{strategyPayoff.netPremium > 0 ? '(Credit Received)' : '(Debit Paid)'}</span>
                    </div>
                  </div>
                </div>
                
                <div style={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={strategyPayoff.chartData} margin={{ top: 30, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset={off} stopColor="rgba(16, 185, 129, 0.3)" stopOpacity={1} />
                          <stop offset={off} stopColor="rgba(239, 68, 68, 0.3)" stopOpacity={1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                      <XAxis dataKey="price" stroke="var(--muted)" fontSize={11} tickFormatter={(val) => `₹${val}`} />
                      <YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(val) => `₹${val * defaultQty}`} />
                      <Tooltip 
                        contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                        labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontWeight: 700 }}
                        itemStyle={{ fontWeight: 600, fontFamily: "'Spline Sans Mono', monospace" }}
                        formatter={(value: any, name: any) => [`₹${(Number(value) * defaultQty).toLocaleString()}`, name === 'pnlExpiry' ? 'At Expiry' : 'T+0 (Today)']}
                        labelFormatter={(label) => `Spot Price: ₹${label}`}
                      />
                      <ReferenceLine y={0} stroke="var(--line-light)" strokeOpacity={0.8} />
                      <ReferenceLine x={chainData?.underlyingValue} stroke="var(--muted)" strokeDasharray="5 5" label={{ position: 'insideTop', value: 'Current Spot', fill: 'var(--muted)', fontSize: 11 }} />
                      
                      {/* Expiry Line */}
                      <Area type="monotone" dataKey="pnlExpiry" stroke="#00000000" fill="url(#splitColor)" isAnimationActive={false} />
                      <Area type="monotone" dataKey="pnlExpiry" stroke="var(--fg)" strokeWidth={2} fill="none" isAnimationActive={false} />
                      
                      {/* T+0 Line */}
                      <Line type="monotone" dataKey="pnlT0" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>

          {/* Column 3: Legs Management */}
          <div className="strat-col-legs">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--fg)', fontWeight: 700 }}>Strategy Legs ({strategyLegs.length})</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Lot:</span>
                <input 
                  type="number" 
                  value={defaultQty} 
                  onChange={(e) => setDefaultQty(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ width: '60px', background: 'var(--panel-2)', border: '1px solid var(--line)', color: 'var(--fg)', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}
                />
              </div>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {strategyLegs.map(leg => (
                <div key={leg.id} className="leg-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span className={`leg-badge ${leg.action === 'B' ? 'buy' : 'sell'}`}>{leg.action === 'B' ? 'BUY' : 'SELL'}</span>
                      <span style={{ marginLeft: '10px', fontWeight: 700, fontSize: '15px', fontFamily: "'Spline Sans Mono', monospace", color: 'var(--fg)' }}>{leg.strike} {leg.type}</span>
                    </div>
                    <span className="leg-del" onClick={() => removeLeg(leg.id)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '8px', borderTop: '1px dashed var(--line)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Premium: <span style={{color:'var(--fg)', fontWeight:600, fontFamily: "'Spline Sans Mono', monospace"}}>₹{(leg.premium || 0).toFixed(2)}</span></span>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>IV: <span style={{color:'var(--fg)', fontWeight:600, fontFamily: "'Spline Sans Mono', monospace"}}>{(leg.iv || 15).toFixed(1)}%</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
