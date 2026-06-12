"use client";
import { useState, useEffect } from "react";
import { Zap } from "lucide-react";
import { useSession } from "next-auth/react";

export default function SignalsPage() {
  const { data: session } = useSession();
  const [aiInsights, setAiInsights] = useState<any[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
  }, []);

  return (
    <>
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
                        <span style={{ color: 'var(--dim)', fontSize: '11px' }}>Current</span>
                        <strong style={{ display: 'block', fontSize: '15px', color: 'var(--foreground)' }}>
                          {insight.ltp > 0 ? `₹${insight.ltp.toFixed(2)}` : 'N/A'}
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
                       <button onClick={async (e) => { 
                         e.stopPropagation(); 
                         // Mocking user email since we don't have session imported yet.
                         // Ideally we'd use next-auth useSession() here. For now we use the test account.
                         const userEmail = session?.user?.email;
                         if (!userEmail) {
                           alert('Please log in to execute paper trades');
                           return;
                         } 
                         try {
                           const res = await fetch('/go-api/paper/execute', {
                             method: 'POST',
                             headers: {
                               'Content-Type': 'application/json',
                               'X-User-Email': userEmail
                             },
                             body: JSON.stringify({ signal_id: insight.ID, quantity: 100 })
                           });
                           if (res.ok) {
                             alert('Paper trade executed successfully for ' + insight.symbol);
                           } else {
                             alert('Failed to execute paper trade');
                           }
                         } catch (err) {
                           console.error(err);
                           alert('Error executing trade');
                         }
                       }} style={{ width: '100%', padding: '12px', background: insight.action === 'SHORT' ? 'var(--danger)' : 'var(--accent)', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Spline Sans Mono', monospace" }}>Execute Paper {insight.action || 'LONG'}</button>
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
                        <span style={{ color: 'var(--dim)', fontSize: '11px' }}>Current</span>
                        <strong style={{ display: 'block', fontSize: '15px', color: 'var(--foreground)' }}>
                          {insight.ltp > 0 ? `₹${insight.ltp.toFixed(2)}` : 'N/A'}
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
                       <button onClick={async (e) => { 
                         e.stopPropagation(); 
                         // Mocking user email since we don't have session imported yet.
                         // Ideally we'd use next-auth useSession() here. For now we use the test account.
                         const userEmail = session?.user?.email;
                         if (!userEmail) {
                           alert('Please log in to execute paper trades');
                           return;
                         } 
                         try {
                           const res = await fetch('/go-api/paper/execute', {
                             method: 'POST',
                             headers: {
                               'Content-Type': 'application/json',
                               'X-User-Email': userEmail
                             },
                             body: JSON.stringify({ signal_id: insight.ID, quantity: 100 })
                           });
                           if (res.ok) {
                             alert('Paper trade executed successfully for ' + insight.symbol);
                           } else {
                             alert('Failed to execute paper trade');
                           }
                         } catch (err) {
                           console.error(err);
                           alert('Error executing trade');
                         }
                       }} style={{ width: '100%', padding: '12px', background: insight.action === 'SHORT' ? 'var(--danger)' : 'var(--accent)', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Spline Sans Mono', monospace" }}>Execute Paper {insight.action || 'LONG'}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
