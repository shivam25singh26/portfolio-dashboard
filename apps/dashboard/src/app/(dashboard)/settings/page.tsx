"use client";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Settings, User, Key, Shield, LogOut, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function SettingsPage() {
  const { data: session, update } = useSession();

  const [activeModal, setActiveModal] = useState<"profile" | "password" | "2fa" | null>(null);

  // Profile State
  const [newName, setNewName] = useState("");

  // Binance State
  const [binanceApiKey, setBinanceApiKey] = useState("");
  const [binanceSecret, setBinanceSecret] = useState("");
  
  // Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // 2FA State
  const [totpUrl, setTotpUrl] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [totpEnabled, setTotpEnabled] = useState(false); // Just local state for UI feedback
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const closeModal = () => {
    setActiveModal(null);
    setError("");
    setSuccess("");
    setLoading(false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/go-api/users/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User-Email": session?.user?.email || ""
        },
        body: JSON.stringify({ name: newName })
      });
      if (!res.ok) throw new Error("Failed to update profile");
      
      await update({ name: newName }); // Update NextAuth session
      setSuccess("Profile updated successfully");
      setTimeout(closeModal, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBinance = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/go-api/users/binance", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User-Email": session?.user?.email || ""
        },
        body: JSON.stringify({ binance_api_key: binanceApiKey, binance_secret: binanceSecret })
      });
      if (!res.ok) throw new Error("Failed to update Binance keys");
      
      setSuccess("Binance Testnet keys updated successfully!");
      setTimeout(closeModal, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/go-api/users/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User-Email": session?.user?.email || ""
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      if (!res.ok) throw new Error("Incorrect current password or server error");
      setSuccess("Password updated successfully. You will need to log in again with your new password.");
      setTimeout(() => signOut(), 2500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generate2FA = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/go-api/users/2fa/generate", {
        method: "POST",
        headers: { "X-User-Email": session?.user?.email || "" }
      });
      if (!res.ok) throw new Error("Failed to generate 2FA");
      const data = await res.json();
      setTotpUrl(data.url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/go-api/users/2fa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Email": session?.user?.email || ""
        },
        body: JSON.stringify({ code: totpCode })
      });
      if (!res.ok) throw new Error("Invalid 2FA code");
      setSuccess("2FA enabled successfully!");
      setTotpEnabled(true);
      setTimeout(closeModal, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '16px' }}><Settings color="var(--accent)" size={32} /> Settings</h1>
          <p>Manage your profile, security, and application preferences.</p>
        </div>
      </header>
      
      <main style={{ padding: '32px 48px', maxWidth: '800px', position: 'relative' }}>
        
        {/* Profile Section */}
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '18px', color: 'var(--ink)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} color="var(--muted)" /> Profile Information
          </h2>
          <div className="card" style={{ cursor: 'default' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
              <div>
                <div style={{ color: 'var(--dim)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Name</div>
                <div style={{ color: 'var(--ink)', fontSize: '15px' }}>{session?.user?.name || "Not provided"}</div>
              </div>
              <div>
                <div style={{ color: 'var(--dim)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Email Address</div>
                <div style={{ color: 'var(--ink)', fontSize: '15px' }}>{session?.user?.email || "Not provided"}</div>
              </div>
            </div>
            <button 
              onClick={() => { setNewName(session?.user?.name || ""); setActiveModal("profile"); }}
              style={{ marginTop: '24px', padding: '8px 16px', background: 'var(--panel-2)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: '6px', cursor: 'pointer', fontFamily: "'Spline Sans Mono', monospace", fontSize: '12px' }}
            >
              Edit Profile
            </button>
          </div>
        </section>

        {/* Security Section */}
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '18px', color: 'var(--ink)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} color="var(--muted)" /> Security
          </h2>
          <div className="card" style={{ cursor: 'default' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '16px', marginBottom: '16px' }}>
              <div>
                <div style={{ color: 'var(--ink)', fontSize: '15px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}><Key size={16} color="var(--dim)"/> Password</div>
                <div style={{ color: 'var(--dim)', fontSize: '13px', marginTop: '4px' }}>Update your account password securely.</div>
              </div>
              <button 
                onClick={() => { setCurrentPassword(""); setNewPassword(""); setActiveModal("password"); }}
                style={{ padding: '8px 16px', background: 'var(--panel-2)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: '6px', cursor: 'pointer', fontFamily: "'Spline Sans Mono', monospace", fontSize: '12px' }}
              >
                Update Password
              </button>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: 'var(--ink)', fontSize: '15px', fontWeight: 500 }}>Two-Factor Authentication (2FA)</div>
                <div style={{ color: 'var(--dim)', fontSize: '13px', marginTop: '4px' }}>Add an extra layer of security using Google Authenticator.</div>
              </div>
              {totpEnabled ? (
                <div style={{ padding: '8px 16px', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>Enabled ✓</div>
              ) : (
                <button 
                  onClick={() => { setTotpUrl(""); setTotpCode(""); setActiveModal("2fa"); generate2FA(); }}
                  style={{ padding: '8px 16px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: "'Spline Sans Mono', monospace", fontSize: '12px', fontWeight: 600 }}
                >
                  Enable 2FA
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Binance Integrations */}
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '18px', color: 'var(--ink)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={18} color="var(--muted)" /> Exchange Integrations
          </h2>
          <div className="card" style={{ cursor: 'default' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: 'var(--ink)', fontSize: '15px', fontWeight: 500 }}>Binance Testnet</div>
                <div style={{ color: 'var(--dim)', fontSize: '13px', marginTop: '4px' }}>Connect your Binance Testnet keys for 24/7 crypto paper trading execution.</div>
              </div>
              <button 
                onClick={() => { setBinanceApiKey(""); setBinanceSecret(""); setActiveModal("binance" as any); }}
                style={{ padding: '8px 16px', background: 'var(--panel-2)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: '6px', cursor: 'pointer', fontFamily: "'Spline Sans Mono', monospace", fontSize: '12px' }}
              >
                Configure Keys
              </button>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section>
          <h2 style={{ fontSize: '18px', color: 'var(--danger)', marginBottom: '16px' }}>Danger Zone</h2>
          <div className="card" style={{ cursor: 'default', borderColor: 'rgba(255, 107, 107, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: 'var(--ink)', fontSize: '15px', fontWeight: 500 }}>Sign Out</div>
                <div style={{ color: 'var(--dim)', fontSize: '13px', marginTop: '4px' }}>End your current session across all devices.</div>
              </div>
              <button onClick={() => signOut()} style={{ padding: '8px 16px', background: 'rgba(255, 107, 107, 0.1)', color: 'var(--danger)', border: '1px solid rgba(255, 107, 107, 0.3)', borderRadius: '6px', cursor: 'pointer', fontFamily: "'Spline Sans Mono', monospace", fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          </div>
        </section>

      </main>

      {/* MODALS */}
      {activeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px', width: '400px', padding: '24px', position: 'relative' }}>
            <button onClick={closeModal} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--dim)', cursor: 'pointer' }}><X size={20}/></button>
            
            {activeModal === "profile" && (
              <form onSubmit={handleUpdateProfile}>
                <h3 style={{ fontSize: '20px', color: 'var(--ink)', marginBottom: '16px' }}>Edit Profile</h3>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>Display Name</label>
                  <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)', borderRadius: '6px' }} />
                </div>
                {error && <div style={{ color: 'var(--danger)', fontSize: '12px', marginBottom: '16px' }}>{error}</div>}
                {success && <div style={{ color: 'var(--accent)', fontSize: '12px', marginBottom: '16px' }}>{success}</div>}
                <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 600 }}>{loading ? "Saving..." : "Save Changes"}</button>
              </form>
            )}

            {activeModal === "password" && (
              <form onSubmit={handleUpdatePassword}>
                <h3 style={{ fontSize: '20px', color: 'var(--ink)', marginBottom: '16px' }}>Update Password</h3>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>Current Password</label>
                  <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)', borderRadius: '6px' }} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>New Password</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)', borderRadius: '6px' }} />
                </div>
                {error && <div style={{ color: 'var(--danger)', fontSize: '12px', marginBottom: '16px' }}>{error}</div>}
                {success && <div style={{ color: 'var(--accent)', fontSize: '12px', marginBottom: '16px' }}>{success}</div>}
                <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 600 }}>{loading ? "Updating..." : "Update Password"}</button>
              </form>
            )}

            {(activeModal as string) === "binance" && (
              <form onSubmit={handleUpdateBinance}>
                <h3 style={{ fontSize: '20px', color: 'var(--ink)', marginBottom: '16px' }}>Binance Testnet API</h3>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>API Key</label>
                  <input type="text" value={binanceApiKey} onChange={e => setBinanceApiKey(e.target.value)} required style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)', borderRadius: '6px' }} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>Secret Key</label>
                  <input type="password" value={binanceSecret} onChange={e => setBinanceSecret(e.target.value)} required style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)', borderRadius: '6px' }} />
                </div>
                <div style={{ marginBottom: '16px', fontSize: '12px', color: 'var(--dim)', lineHeight: '1.5' }}>
                  Keys can be generated from testnet.binance.vision. We securely store your keys and use them exclusively to execute paper trades on signals.
                </div>
                {error && <div style={{ color: 'var(--danger)', fontSize: '12px', marginBottom: '16px' }}>{error}</div>}
                {success && <div style={{ color: 'var(--accent)', fontSize: '12px', marginBottom: '16px' }}>{success}</div>}
                <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 600 }}>{loading ? "Saving..." : "Save Keys"}</button>
              </form>
            )}

            {activeModal === "2fa" && (
              <form onSubmit={verify2FA}>
                <h3 style={{ fontSize: '20px', color: 'var(--ink)', marginBottom: '16px' }}>Setup Google Authenticator</h3>
                {!totpUrl ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--dim)' }}>Generating Secure Token...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <p style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>Scan this QR code with the Google Authenticator app on your phone.</p>
                    <div style={{ background: '#fff', padding: '16px', borderRadius: '8px' }}>
                      <QRCodeSVG value={totpUrl} size={180} />
                    </div>
                    <div style={{ width: '100%', marginTop: '8px' }}>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>Enter 6-digit Code</label>
                      <input type="text" value={totpCode} onChange={e => setTotpCode(e.target.value)} placeholder="000000" maxLength={6} required style={{ width: '100%', padding: '12px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)', borderRadius: '6px', fontSize: '18px', textAlign: 'center', letterSpacing: '4px' }} />
                    </div>
                    {error && <div style={{ color: 'var(--danger)', fontSize: '12px', width: '100%' }}>{error}</div>}
                    {success && <div style={{ color: 'var(--accent)', fontSize: '12px', width: '100%' }}>{success}</div>}
                    <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 600 }}>{loading ? "Verifying..." : "Verify & Enable"}</button>
                  </div>
                )}
              </form>
            )}

          </div>
        </div>
      )}

    </>
  );
}
