"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Activity, TrendingUp, BarChart3, AlertCircle } from "lucide-react";
import dynamic from 'next/dynamic';

const ChartComponent = dynamic(() => import('../../ChartComponent'), { ssr: false });

export default function TrackRecordPage() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<any>(null);
  const [curve, setCurve] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.email) return;

    const fetchAnalytics = async () => {
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
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [session?.user?.email]);

  if (!session?.user?.email) {
    return (
      <div className="empty-state">
        <AlertCircle size={48} color="var(--dim)" style={{ marginBottom: '16px' }} />
        <h3>Please log in to view analytics</h3>
        <p>Analytics are personalized based on your paper trading history.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="empty-state">Loading AI Performance Metrics...</div>;
  }

  // Transform curve data for chart
  // The ChartComponent expects an array of objects with c (close), h (high), l (low), o (open), t (timestamp)
  // We mock the OHLC based on the single value for visual representation, since it's a portfolio equity curve
  const chartData = curve.map((pt, i) => {
    const prev = i > 0 ? curve[i-1].value : pt.value;
    return {
      t: new Date(pt.date).getTime() / 1000,
      o: prev,
      c: pt.value,
      h: Math.max(prev, pt.value) * 1.01,
      l: Math.min(prev, pt.value) * 0.99
    };
  });

  return (
    <>
      <header>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Activity color="var(--accent)" size={32} /> 
            Track Record & Analytics
          </h1>
          <p>Real-time performance metrics and historical trade outcomes of Lever's AI engine.</p>
        </div>
      </header>
      
      <main className="page-main">
        {/* Hero Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '32px' }}>
          <div style={{ padding: '24px', background: 'var(--panel)', borderRadius: 'var(--radius)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '13px', color: 'var(--dim)', marginBottom: '8px' }}>Total Trades Executed</div>
            <div style={{ fontSize: '32px', fontWeight: 600, fontFamily: "'Spline Sans Mono', monospace" }}>
              {summary?.total_trades || 0}
            </div>
          </div>
          <div style={{ padding: '24px', background: 'var(--panel)', borderRadius: 'var(--radius)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '13px', color: 'var(--dim)', marginBottom: '8px' }}>Win Rate</div>
            <div style={{ fontSize: '32px', fontWeight: 600, color: (summary?.win_rate || 0) > 50 ? 'var(--established)' : 'var(--foreground)', fontFamily: "'Spline Sans Mono', monospace" }}>
              {summary?.win_rate?.toFixed(1) || '0.0'}%
            </div>
          </div>
          <div style={{ padding: '24px', background: 'var(--panel)', borderRadius: 'var(--radius)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '13px', color: 'var(--dim)', marginBottom: '8px' }}>Total P&L</div>
            <div style={{ fontSize: '32px', fontWeight: 600, color: (summary?.total_pnl || 0) >= 0 ? 'var(--established)' : 'var(--danger)', fontFamily: "'Spline Sans Mono', monospace" }}>
              {(summary?.total_pnl || 0) >= 0 ? '+' : '-'}₹{Math.abs(summary?.total_pnl || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        {/* Equity Curve Chart */}
        <div style={{ background: 'var(--panel)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '32px' }}>
          <h3 style={{ margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} color="var(--dim)" />
            Portfolio Equity Curve
          </h3>
          <div style={{ height: '400px', width: '100%', position: 'relative' }}>
            {chartData.length > 0 ? (
              <ChartComponent data={chartData} isMini={false} />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dim)' }}>
                No equity curve data available. Execute some trades first.
              </div>
            )}
          </div>
        </div>

        {/* Recent Trades Table */}
        <div style={{ background: 'var(--panel)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid rgba(255,255,255,0.05)' }}>
           <h3 style={{ margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={18} color="var(--dim)" />
            Recent Trade History
          </h3>
          
          {history.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--dim)', fontSize: '13px' }}>
                    <th style={{ padding: '16px 8px', fontWeight: 500 }}>Symbol</th>
                    <th style={{ padding: '16px 8px', fontWeight: 500 }}>Side</th>
                    <th style={{ padding: '16px 8px', fontWeight: 500 }}>Entry Price</th>
                    <th style={{ padding: '16px 8px', fontWeight: 500 }}>Exit Price</th>
                    <th style={{ padding: '16px 8px', fontWeight: 500 }}>Status</th>
                    <th style={{ padding: '16px 8px', fontWeight: 500, textAlign: 'right' }}>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((trade, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '14px', fontFamily: "'Spline Sans Mono', monospace" }}>
                      <td style={{ padding: '16px 8px', color: 'var(--foreground)' }}>{trade.symbol}</td>
                      <td style={{ padding: '16px 8px', color: trade.action === 'SHORT' ? 'var(--danger)' : 'var(--established)' }}>{trade.action}</td>
                      <td style={{ padding: '16px 8px' }}>₹{trade.entry_price.toFixed(2)}</td>
                      <td style={{ padding: '16px 8px' }}>{trade.exit_price > 0 ? `₹${trade.exit_price.toFixed(2)}` : '-'}</td>
                      <td style={{ padding: '16px 8px' }}>
                        <span style={{ 
                          padding: '4px 8px', 
                          borderRadius: '4px', 
                          fontSize: '11px',
                          background: trade.status === 'OPEN' ? 'rgba(255, 167, 38, 0.15)' : 'rgba(255,255,255,0.1)',
                          color: trade.status === 'OPEN' ? '#ffa726' : 'var(--dim)'
                        }}>
                          {trade.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px 8px', textAlign: 'right', color: trade.pnl_amount >= 0 ? 'var(--established)' : 'var(--danger)' }}>
                        {trade.pnl_amount !== 0 ? (
                           `${trade.pnl_amount >= 0 ? '+' : '-'}₹${Math.abs(trade.pnl_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              No trade history found. Go to the Signals page to execute paper trades!
            </div>
          )}
        </div>
      </main>
    </>
  );
}
