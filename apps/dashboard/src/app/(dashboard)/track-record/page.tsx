"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { signIn } from "next-auth/react";
import { Activity, TrendingUp, BarChart3, AlertCircle, LogIn, Target, Award, TrendingDown } from "lucide-react";
import dynamic from 'next/dynamic';

const ChartComponent = dynamic(() => import('../../ChartComponent'), { ssr: false });

export default function TrackRecordPage() {
  const { data: session, status } = useSession();
  const [summary, setSummary] = useState<any>(null);
  const [curve, setCurve] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    if (!session?.user?.email) return;

    const fetchAnalytics = async () => {
      setLoading(true);
      setFetchError(false);
      try {
        const [sumRes, curRes, histRes] = await Promise.all([
          fetch('/go-api/analytics/summary', { headers: { 'X-User-Email': session.user?.email || '' } }),
          fetch('/go-api/analytics/equity-curve', { headers: { 'X-User-Email': session.user?.email || '' } }),
          fetch('/go-api/paper/history', { headers: { 'X-User-Email': session.user?.email || '' } })
        ]);

        if (sumRes.ok) setSummary(await sumRes.json());
        if (curRes.ok) setCurve(await curRes.json());
        if (histRes.ok) setHistory(await histRes.json());
      } catch (err) {
        console.error(err);
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [session?.user?.email]);

  // ── Not logged in ──
  if (status === "unauthenticated" || (!session?.user?.email && status !== "loading")) {
    return (
      <>
        <header>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Activity color="var(--accent)" size={32} />
              Track Record & Analytics
            </h1>
            <p>Real-time performance metrics and historical trade outcomes of the AI engine.</p>
          </div>
        </header>
        <main className="page-main">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', gap: '24px', textAlign: 'center' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={32} color="var(--dim)" />
            </div>
            <div>
              <h2 style={{ color: 'var(--ink)', marginBottom: '8px', fontSize: '22px' }}>Sign in to view your Track Record</h2>
              <p style={{ color: 'var(--dim)', maxWidth: '400px', lineHeight: '1.6', fontSize: '14px' }}>
                Analytics and trade history are personalised to your account. Sign in to see your AI engine&apos;s P&L, win rate, and equity curve.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                onClick={() => signIn("google")}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 28px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: "'Archivo', sans-serif" }}
              >
                <LogIn size={16} /> Sign in with Google
              </button>
              <button
                onClick={() => signIn()}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 28px', background: 'var(--panel)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: '10px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
              >
                Sign in with Email
              </button>
            </div>
            {/* Preview stats (teaser) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '24px', opacity: 0.4, filter: 'blur(4px)', pointerEvents: 'none', width: '100%', maxWidth: '600px' }}>
              {[{ label: 'Win Rate', val: '68.4%' }, { label: 'Total P&L', val: '+₹1,24,000' }, { label: 'Trades', val: '47' }].map(s => (
                <div key={s.label} style={{ padding: '20px', background: 'var(--panel)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'var(--dim)', marginBottom: '6px' }}>{s.label}</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: "'Spline Sans Mono', monospace", color: 'var(--accent)' }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </>
    );
  }

  // ── Session loading ──
  if (status === "loading" || loading) {
    return (
      <>
        <header>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Activity color="var(--accent)" size={32} />
              Track Record & Analytics
            </h1>
            <p>Loading your performance metrics…</p>
          </div>
        </header>
        <main className="page-main">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '80px 0', color: 'var(--dim)' }}>
            <svg style={{ animation: 'spin 1s linear infinite' }} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" />
            </svg>
            <span>Loading AI Performance Metrics…</span>
          </div>
        </main>
      </>
    );
  }

  // ── Fetch error ──
  if (fetchError) {
    return (
      <>
        <header><div><h1>Track Record & Analytics</h1></div></header>
        <main className="page-main">
          <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--dim)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h3 style={{ color: 'var(--ink)', marginBottom: '8px' }}>Could not load analytics</h3>
            <p>The analytics service may be offline. Try refreshing the page.</p>
          </div>
        </main>
      </>
    );
  }

  const chartData = curve.map((pt) => ({
    t: new Date(pt.date).getTime() / 1000,
    value: pt.value
  }));

  const winCount = history.filter(t => (t.pnl_amount || 0) > 0).length;
  const lossCount = history.filter(t => (t.pnl_amount || 0) < 0).length;

  return (
    <>
      <header>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Activity color="var(--accent)" size={32} />
            Track Record & Analytics
          </h1>
          <p>Real-time performance metrics and historical trade outcomes of Lever&apos;s AI engine.</p>
        </div>
      </header>
      
      <main className="page-main">
        {/* Hero Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {[
            { label: 'Total Trades', val: summary?.total_trades || 0, icon: Target, color: 'var(--ink)' },
            { label: 'Win Rate', val: `${(summary?.win_rate || 0).toFixed(1)}%`, icon: Award, color: (summary?.win_rate || 0) > 50 ? 'var(--established)' : 'var(--danger)' },
            { label: 'Total P&L', val: `${(summary?.total_pnl || 0) >= 0 ? '+' : ''}₹${Math.abs(summary?.total_pnl || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: TrendingUp, color: (summary?.total_pnl || 0) >= 0 ? 'var(--established)' : 'var(--danger)' },
            { label: 'Avg Win', val: summary?.avg_win ? `₹${summary.avg_win.toFixed(0)}` : '-', icon: TrendingUp, color: 'var(--established)' },
            { label: 'Avg Loss', val: summary?.avg_loss ? `₹${Math.abs(summary.avg_loss).toFixed(0)}` : '-', icon: TrendingDown, color: 'var(--danger)' },
            { label: 'Wins / Losses', val: `${winCount} / ${lossCount}`, icon: BarChart3, color: 'var(--ink)' },
          ].map(({ label, val, icon: Icon, color }) => (
            <div key={label} style={{ padding: '20px 24px', background: 'var(--panel)', borderRadius: 'var(--radius)', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Icon size={14} color="var(--dim)" />
                <span style={{ fontSize: '12px', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color, fontFamily: "'Spline Sans Mono', monospace" }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Equity Curve */}
        <div style={{ background: 'var(--panel)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--line)', marginBottom: '32px' }}>
          <h3 style={{ margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ink)' }}>
            <TrendingUp size={18} color="var(--dim)" />
            Portfolio Equity Curve
          </h3>
          <div style={{ height: '360px', width: '100%' }}>
            {chartData.length > 0 ? (
              <ChartComponent data={chartData} type="area" color="#3ddc91" isMini={false} />
            ) : (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--dim)' }}>
                <TrendingUp size={40} strokeWidth={1} />
                <p>No equity curve data yet.</p>
                <p style={{ fontSize: '13px' }}>Execute some trades on the <a href="/signals" style={{ color: 'var(--accent)' }}>AI Signals</a> page to start tracking performance.</p>
              </div>
            )}
          </div>
        </div>

        {/* Trade History Table */}
        <div style={{ background: 'var(--panel)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--line)' }}>
          <h3 style={{ margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ink)' }}>
            <BarChart3 size={18} color="var(--dim)" />
            Recent Trade History
            {history.length > 0 && <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--dim)', fontWeight: 400 }}>{history.length} trades</span>}
          </h3>
          
          {history.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--dim)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <th style={{ padding: '12px 8px', fontWeight: 500 }}>Symbol</th>
                    <th style={{ padding: '12px 8px', fontWeight: 500 }}>Side</th>
                    <th style={{ padding: '12px 8px', fontWeight: 500 }}>Entry</th>
                    <th style={{ padding: '12px 8px', fontWeight: 500 }}>Exit</th>
                    <th style={{ padding: '12px 8px', fontWeight: 500 }}>Status</th>
                    <th style={{ padding: '12px 8px', fontWeight: 500, textAlign: 'right' }}>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((trade, idx) => {
                    const pnl = trade.pnl_amount || 0;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '14px', fontFamily: "'Spline Sans Mono', monospace", transition: 'background var(--transition-fast)' }}
                        onMouseOver={e => e.currentTarget.style.background = 'var(--panel-2)'}
                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '14px 8px', color: 'var(--ink)', fontWeight: 600 }}>{trade.symbol?.split('.')[0]}</td>
                        <td style={{ padding: '14px 8px', color: trade.action === 'SHORT' ? 'var(--danger)' : 'var(--established)' }}>{trade.action}</td>
                        <td style={{ padding: '14px 8px' }}>₹{trade.entry_price?.toFixed(2)}</td>
                        <td style={{ padding: '14px 8px', color: 'var(--dim)' }}>{trade.exit_price > 0 ? `₹${trade.exit_price.toFixed(2)}` : '—'}</td>
                        <td style={{ padding: '14px 8px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: "'Archivo', sans-serif",
                            background: trade.status === 'OPEN' ? 'rgba(255,167,38,0.15)' : pnl > 0 ? 'rgba(61,220,145,0.1)' : 'rgba(255,107,107,0.1)',
                            color: trade.status === 'OPEN' ? '#ffa726' : pnl > 0 ? 'var(--established)' : 'var(--danger)'
                          }}>
                            {trade.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 8px', textAlign: 'right', color: pnl >= 0 ? 'var(--established)' : 'var(--danger)', fontWeight: 600 }}>
                          {pnl !== 0 ? `${pnl >= 0 ? '+' : ''}₹${Math.abs(pnl).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--dim)' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>📊</div>
              <p style={{ marginBottom: '8px' }}>No trade history found.</p>
              <p style={{ fontSize: '13px' }}>
                Go to <a href="/signals" style={{ color: 'var(--accent)', textDecoration: 'none' }}>AI Signals →</a> to execute paper trades!
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
