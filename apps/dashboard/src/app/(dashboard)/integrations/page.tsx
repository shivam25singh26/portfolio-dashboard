"use client";
import { Link as LinkIcon, AlertCircle } from "lucide-react";

export default function IntegrationsPage() {
  return (
    <>
      <header>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '16px' }}><LinkIcon color="var(--accent)" size={32} /> Broker Integrations</h1>
          <p>Connect your brokerage accounts to enable 1-click execution for AI trades directly from the dashboard.</p>
        </div>
      </header>
      <main style={{ padding: '32px 48px' }}>
        <div className="card" style={{ maxWidth: '600px', cursor: 'default' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ color: 'var(--ink)' }}>AngelOne SmartAPI</h3>
              <p style={{ color: 'var(--dim)', fontSize: '13px' }}>Indian Equities & F&O</p>
            </div>
            <span className="badge" style={{ background: 'var(--panel)', color: 'var(--dim)', border: '1px solid var(--line)' }}>Not Connected</span>
          </div>
          <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--line)', fontFamily: "'Spline Sans Mono', monospace", fontSize: '13px', color: 'var(--muted)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <AlertCircle size={20} color="var(--dim)" />
            <span>Coming soon: Securely input your API Key, PIN, and TOTP secret to link your AngelOne account.</span>
          </div>
          <button disabled style={{ marginTop: '24px', width: '100%', padding: '12px', background: 'var(--panel-2)', color: 'var(--dim)', border: '1px solid var(--line)', borderRadius: '8px', cursor: 'not-allowed', fontFamily: "'Spline Sans Mono', monospace", fontWeight: 600 }}>
            Connect Account
          </button>
        </div>
      </main>
    </>
  );
}
