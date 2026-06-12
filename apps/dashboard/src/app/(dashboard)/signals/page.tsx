"use client";
import { useState, useEffect } from "react";
import { Zap, X } from "lucide-react";
import { useSession } from "next-auth/react";
import toast, { Toaster } from "react-hot-toast";

export default function SignalsPage() {
  const { data: session } = useSession();
  const [aiInsights, setAiInsights] = useState<any[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Real-time quotes state
  const [quotes, setQuotes] = useState<Record<string, number>>({});
  
  // Execution Modal state
  const [tradeModal, setTradeModal] = useState<any>(null);
  const [tradeQuantity, setTradeQuantity] = useState<number>(100);
  const [tradeLoading, setTradeLoading] = useState(false);

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
    }
  };

  useEffect(() => {
    fetch('/go-api/insights', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        setAiInsights(data || []);
        setInsightsLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch insights", err);
        setInsightsLoading(false);
      });
      
    // WebSocket for Live Prices
    const wsUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/^https/, 'wss').replace(/^http/, 'ws') || 'ws://127.0.0.1:8080';
    const ws = new WebSocket(`${wsUrl}/ws/live`);
    ws.onmessage = (event) => {
      try {
        const tick = JSON.parse(event.data);
        if (tick.ticker && tick.last_price) {
          setQuotes(prev => ({ ...prev, [tick.ticker]: tick.last_price }));
        }
      } catch (e) {}
    };
    return () => ws.close();
  }, []);

  const handleExecuteTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.email || !tradeModal) return toast.error('Please log in to execute trades');
    setTradeLoading(true);
    
    try {
      const res = await fetch('/go-api/paper/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': session.user.email
        },
        body: JSON.stringify({ signal_id: tradeModal.ID, quantity: Number(tradeQuantity) })
      });
      if (res.ok) {
        toast.success(`Trade executed: ${tradeQuantity}x ${tradeModal.symbol}`);
        setTradeModal(null);
      } else {
        toast.error('Failed to execute paper trade');
      }
    } catch (err) {
      toast.error('Error executing trade');
    } finally {
      setTradeLoading(false);
    }
  };

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { background: 'var(--panel-2)', color: 'var(--foreground)', border: '1px solid var(--line)', fontFamily: "'Spline Sans Mono', monospace", fontSize: '13px' } }} />
      <header>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '16px' }}><Zap color="var(--speculative)" size={32} /> AI Trade Signals</h1>
          <p>Our autonomous engines are constantly scanning the Indian Market (NSE) via AngelOne. Below are real-time trade setups.</p>
        </div>
      </header>
      <main className="page-main">
        {insightsLoading ? (
          <div style={{ color: 'var(--dim)' }}>Loading AI Insights from Go Gateway...</div>
        ) : aiInsights.length === 0 ? (
          <div className="empty-state">
            No AI insights found in the database. Waiting for Python Engine to process market scans...
          </div>
        ) : (
          <div className="trade-signals-grid">
            <div>
              <h3 className="section-title safe">Indian Equities (NSE)</h3>
              <div className="trade-list">
                {aiInsights.filter(i => i.exchange !== 'BINANCE').map((insight) => (
                  <div 
                    key={insight.ID} 
                    className={`card ${expandedId === String(insight.ID) ? 'expanded' : ''}`}
                    onClick={() => toggleExpand(String(insight.ID))}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="card-top">
                      <div>
                        <div className="ticker" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {insight.symbol || "UNKNOWN"}
                          <span style={{ 
                            fontSize: '11px', 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            background: insight.action === 'SHORT' ? 'rgba(239, 83, 80, 0.15)' : 'rgba(61, 220, 145, 0.15)', 
                            color: insight.action === 'SHORT' ? 'var(--danger)' : 'var(--established)',
                            fontFamily: "'Spline Sans Mono', monospace"
                          }}>
                            {insight.action || 'LONG'}
                          </span>
                        </div>
                        <div className="company">AI Trade Setup</div>
                      </div>
                      <div className="badges">
                        <span className="badge established">Equity</span>
                        {insight.conviction_score && (
                          <span className="badge" style={{ background: 'var(--panel)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>Score: {insight.conviction_score}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="live-quote" style={{ flexDirection: 'row', gap: '10px', marginTop: '16px', marginBottom: '16px', display: expandedId === String(insight.ID) ? 'flex' : 'none' }}>
                      <div className="metric-item" style={{ background: '#1a1f26', padding: '8px', borderRadius: '8px', flex: 1 }}>
                        <span style={{ color: 'var(--dim)', fontSize: '11px' }}>Current (Live)</span>
                        <strong style={{ display: 'block', fontSize: '15px', color: quotes[insight.symbol] ? 'var(--foreground)' : 'var(--dim)' }}>
                          ₹{quotes[insight.symbol] ? quotes[insight.symbol].toFixed(2) : (insight.ltp > 0 ? insight.ltp.toFixed(2) : 'N/A')}
                        </strong>
                      </div>
                      <div className="metric-item" style={{ background: '#1a1f26', padding: '8px', borderRadius: '8px', flex: 1 }}>
                        <span style={{ color: 'var(--dim)', fontSize: '11px' }}>Target</span>
                        <strong style={{ display: 'block', fontSize: '15px', color: 'var(--established)' }}>
                          {insight.target > 0 ? `₹${insight.target.toFixed(2)}` : 'N/A'}
                        </strong>
                      </div>
                      <div className="metric-item" style={{ background: '#1a1f26', padding: '8px', borderRadius: '8px', flex: 1 }}>
                        <span style={{ color: 'var(--dim)', fontSize: '11px' }}>Stop</span>
                        <strong style={{ display: 'block', fontSize: '15px', color: 'var(--danger)' }}>
                          {insight.stop_loss > 0 ? `₹${insight.stop_loss.toFixed(2)}` : 'N/A'}
                        </strong>
                      </div>
                    </div>

                    <div className="field catalyst">
                      <div className="field-label"><span className="dot catalyst"></span>AI Reasoning</div>
                      <div className="field-text" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '12px' }}>
                        {insight.reasoning || insight.raw_text}
                      </div>
                    </div>
                    <div style={{ marginTop: '16px', display: expandedId === String(insight.ID) ? 'block' : 'none' }}>
                       <button onClick={(e) => { 
                         e.stopPropagation(); 
                         setTradeModal(insight);
                         setTradeQuantity(100);
                       }} style={{ width: '100%', padding: '12px', background: insight.action === 'SHORT' ? 'var(--danger)' : 'var(--accent)', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Spline Sans Mono', monospace" }}>Execute Trade {insight.action || 'LONG'}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="section-title speculative">Crypto Markets (Binance)</h3>
              <div className="trade-list">
                {aiInsights.filter(i => i.exchange === 'BINANCE').map((insight) => (
                  <div 
                    key={insight.ID} 
                    className={`card ${expandedId === String(insight.ID) ? 'expanded' : ''}`}
                    onClick={() => toggleExpand(String(insight.ID))}
                    style={{ cursor: 'pointer', borderColor: expandedId === String(insight.ID) ? (insight.action === 'SHORT' ? 'rgba(239, 83, 80, 0.4)' : 'rgba(61, 220, 145, 0.3)') : 'transparent' }}
                  >
                    <div className="card-top">
                      <div>
                        <div className="ticker" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {insight.symbol || "UNKNOWN"}
                          <span style={{ 
                            fontSize: '11px', 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            background: insight.action === 'SHORT' ? 'rgba(239, 83, 80, 0.15)' : 'rgba(61, 220, 145, 0.15)', 
                            color: insight.action === 'SHORT' ? 'var(--danger)' : 'var(--established)',
                            fontFamily: "'Spline Sans Mono', monospace"
                          }}>
                            {insight.action || 'LONG'}
                          </span>
                        </div>
                        <div className="company">AI Trade Setup</div>
                      </div>
                      <div className="badges">
                        <span className="badge speculative">Crypto</span>
                        {insight.conviction_score && (
                          <span className="badge" style={{ background: 'var(--panel)', border: '1px solid var(--speculative)', color: 'var(--speculative)' }}>Score: {insight.conviction_score}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="live-quote" style={{ flexDirection: 'row', gap: '10px', marginTop: '16px', marginBottom: '16px', display: expandedId === String(insight.ID) ? 'flex' : 'none' }}>
                      <div className="metric-item" style={{ background: '#1a1f26', padding: '8px', borderRadius: '8px', flex: 1 }}>
                        <span style={{ color: 'var(--dim)', fontSize: '11px' }}>Current (Live)</span>
                        <strong style={{ display: 'block', fontSize: '15px', color: quotes[insight.symbol] ? 'var(--foreground)' : 'var(--dim)' }}>
                          ${quotes[insight.symbol] ? quotes[insight.symbol].toFixed(2) : (insight.ltp > 0 ? insight.ltp.toFixed(2) : 'N/A')}
                        </strong>
                      </div>
                      <div className="metric-item" style={{ background: '#1a1f26', padding: '8px', borderRadius: '8px', flex: 1 }}>
                        <span style={{ color: 'var(--dim)', fontSize: '11px' }}>Target</span>
                        <strong style={{ display: 'block', fontSize: '15px', color: 'var(--established)' }}>
                          {insight.target > 0 ? `₹${insight.target.toFixed(2)}` : 'N/A'}
                        </strong>
                      </div>
                      <div className="metric-item" style={{ background: '#1a1f26', padding: '8px', borderRadius: '8px', flex: 1 }}>
                        <span style={{ color: 'var(--dim)', fontSize: '11px' }}>Stop</span>
                        <strong style={{ display: 'block', fontSize: '15px', color: 'var(--danger)' }}>
                          {insight.stop_loss > 0 ? `₹${insight.stop_loss.toFixed(2)}` : 'N/A'}
                        </strong>
                      </div>
                    </div>

                    <div className="field risk">
                      <div className="field-label"><span className="dot risk"></span>AI Reasoning</div>
                      <div className="field-text" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '12px' }}>
                        {insight.reasoning || insight.raw_text}
                      </div>
                    </div>
                    <div style={{ marginTop: '16px', display: expandedId === String(insight.ID) ? 'block' : 'none' }}>
                       <button onClick={(e) => { 
                         e.stopPropagation(); 
                         setTradeModal(insight);
                         setTradeQuantity(1);
                       }} style={{ width: '100%', padding: '12px', background: insight.action === 'SHORT' ? 'var(--danger)' : 'var(--accent)', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Spline Sans Mono', monospace" }}>Execute Trade {insight.action || 'LONG'}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {tradeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px', width: '380px', padding: '24px', position: 'relative' }}>
            <button onClick={() => setTradeModal(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--dim)', cursor: 'pointer' }}><X size={20}/></button>
            <h3 style={{ fontSize: '18px', color: 'var(--ink)', marginBottom: '8px' }}>Execute Trade</h3>
            <div style={{ color: 'var(--dim)', fontSize: '13px', marginBottom: '24px' }}>
              Confirm your {tradeModal.action} position for <strong>{tradeModal.symbol}</strong>.
            </div>
            
            <form onSubmit={handleExecuteTrade}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>Quantity (Shares/Tokens)</label>
                <input 
                  type="number" 
                  min="1" 
                  step="1"
                  value={tradeQuantity} 
                  onChange={(e) => setTradeQuantity(Number(e.target.value))} 
                  required 
                  style={{ width: '100%', padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)', borderRadius: '6px', fontSize: '16px' }} 
                />
              </div>
              <button 
                type="submit" 
                disabled={tradeLoading} 
                style={{ width: '100%', padding: '12px', background: tradeModal.action === 'SHORT' ? 'var(--danger)' : 'var(--accent)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: tradeLoading ? 'not-allowed' : 'pointer' }}
              >
                {tradeLoading ? "Executing..." : `Confirm ${tradeModal.action}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
