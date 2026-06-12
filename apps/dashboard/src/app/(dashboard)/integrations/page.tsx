"use client";
import { Link as LinkIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import toast, { Toaster } from "react-hot-toast";

export default function IntegrationsPage() {
  const { data: session } = useSession();
  const [clientCode, setClientCode] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"connected" | "disconnected" | "loading">("loading");

  useEffect(() => {
    if (!session?.user?.email) return;
    fetch('/go-api/users/profile', { headers: { 'X-User-Email': session.user.email } })
      .then(res => res.json())
      .then(data => {
        if (data.angel_client_id) {
          setStatus("connected");
        } else {
          setStatus("disconnected");
        }
      })
      .catch(() => setStatus("disconnected"));
  }, [session?.user?.email]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.email) return toast.error("Must be logged in");
    
    setLoading(true);
    try {
      const res = await fetch("/go-api/users/angelone", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User-Email": session.user.email
        },
        body: JSON.stringify({ 
          angel_client_id: clientCode, 
          angel_pin: password,
          angel_api_key: apiKey,
          angel_totp_secret: totpSecret
        })
      });
      
      if (!res.ok) throw new Error("Failed to connect account");
      
      toast.success("AngelOne account connected successfully!");
      setStatus("connected");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { background: 'var(--panel-2)', color: 'var(--foreground)', border: '1px solid var(--line)', fontFamily: "'Spline Sans Mono', monospace", fontSize: '13px' } }} />
      <header>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '16px' }}><LinkIcon color="var(--accent)" size={32} /> Broker Integrations</h1>
          <p>Connect your brokerage accounts to enable 1-click execution for AI trades directly from the dashboard.</p>
        </div>
      </header>
      <main style={{ padding: '32px 48px' }}>
        <div className="card" style={{ maxWidth: '600px', cursor: 'default' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h3 style={{ color: 'var(--ink)' }}>AngelOne SmartAPI</h3>
              <p style={{ color: 'var(--dim)', fontSize: '13px' }}>Indian Equities & F&O</p>
            </div>
            {status === "connected" ? (
              <span className="badge" style={{ background: 'rgba(61, 220, 145, 0.1)', color: 'var(--established)', border: '1px solid rgba(61, 220, 145, 0.3)', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14}/> Connected</span>
            ) : status === "loading" ? (
              <span className="badge" style={{ background: 'var(--panel)', color: 'var(--dim)', border: '1px solid var(--line)' }}>Checking...</span>
            ) : (
              <span className="badge" style={{ background: 'var(--panel)', color: 'var(--dim)', border: '1px solid var(--line)' }}>Not Connected</span>
            )}
          </div>

          {status === "connected" ? (
            <div style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--line)', textAlign: 'center' }}>
              <CheckCircle2 size={48} color="var(--established)" style={{ margin: '0 auto 16px auto', opacity: 0.8 }} />
              <h4 style={{ color: 'var(--foreground)', marginBottom: '8px' }}>API Connected</h4>
              <p style={{ color: 'var(--dim)', fontSize: '13px', lineHeight: '1.6' }}>Your AngelOne SmartAPI is actively linked. Lever AI can now execute trades automatically into your demat account.</p>
              <button onClick={() => setStatus("disconnected")} style={{ marginTop: '24px', padding: '8px 16px', background: 'transparent', color: 'var(--dim)', border: '1px solid var(--line)', borderRadius: '6px', cursor: 'pointer', fontFamily: "'Spline Sans Mono', monospace", fontSize: '12px' }}>
                Update Credentials
              </button>
            </div>
          ) : (
            <form onSubmit={handleConnect}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>Client ID</label>
                <input type="text" value={clientCode} onChange={e => setClientCode(e.target.value)} required style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)', borderRadius: '6px' }} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>SmartAPI Password / PIN</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)', borderRadius: '6px' }} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>API Key</label>
                <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} required style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)', borderRadius: '6px' }} />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>TOTP Auth Secret</label>
                <input type="password" value={totpSecret} onChange={e => setTotpSecret(e.target.value)} required style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)', borderRadius: '6px' }} />
                <p style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '6px' }}>Found in your SmartAPI dashboard security settings.</p>
              </div>

              <div style={{ padding: '16px', background: 'rgba(255, 167, 38, 0.05)', borderRadius: '8px', border: '1px solid rgba(255, 167, 38, 0.2)', fontFamily: "'Spline Sans Mono', monospace", fontSize: '12px', color: '#ffa726', display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '24px' }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ lineHeight: '1.5' }}>These credentials will be encrypted at rest in your database and will ONLY be used by the Go Engine to sign real-time execution orders on your behalf.</span>
              </div>
              <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Spline Sans Mono', monospace", fontWeight: 600 }}>
                {loading ? "Connecting..." : "Connect Account"}
              </button>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
