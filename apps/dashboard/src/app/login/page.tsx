"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import "./login.css";

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (isRegistering) {
      try {
        const res = await fetch("/go-api/users/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name })
        });
        
        if (!res.ok) {
          setError("Registration failed. Email might already exist.");
          setLoading(false);
          return;
        }
      } catch (err) {
        setError("Server error during registration.");
        setLoading(false);
        return;
      }
    }

    // If 2FA screen is NOT showing yet, do a preflight check directly against Go
    if (!show2FA) {
      try {
        const preflightRes = await fetch("/go-api/users/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, totp_code: "" }),
        });

        if (!preflightRes.ok) {
          const body = await preflightRes.text();
          if (body.includes("2FA_REQUIRED")) {
            // Credentials are correct, but 2FA is needed
            setShow2FA(true);
            setLoading(false);
            return;
          }
          // Bad credentials
          setError("Invalid email or password.");
          setLoading(false);
          return;
        }
        // No 2FA needed — fall through to signIn() below
      } catch (err) {
        setError("Cannot reach the server. Is the Go backend running?");
        setLoading(false);
        return;
      }
    }

    // At this point we have all fields — call NextAuth signIn
    const res = await signIn("credentials", { 
      email, 
      password, 
      totpCode,
      redirect: false 
    });
    
    if (res?.error) {
      if (show2FA) {
        setError("Invalid 2FA code. Please check your authenticator app and try again.");
        setTotpCode("");
      } else {
        setError("Login failed. Please check your credentials.");
      }
    } else {
      window.location.href = "/";
    }
    
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-orb orb-1"></div>
      <div className="login-orb orb-2"></div>
      
      <div className="login-glass">
        <div className="login-header">
          <h1>Growth Engines</h1>
          <p>{show2FA ? "Two-Factor Authentication" : (isRegistering ? "Create your quantitative account." : "Access the proprietary quant terminal.")}</p>
        </div>

        {!show2FA && (
          <>
            <div className="oauth-buttons">
              <button className="oauth-btn" onClick={() => signIn("google", { callbackUrl: "/" })}>
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" />
                Continue with Google
              </button>
              <button className="oauth-btn" onClick={() => signIn("github", { callbackUrl: "/" })}>
                <img src="https://www.svgrepo.com/show/512317/github-142.svg" alt="GitHub" style={{ filter: 'invert(1)' }} />
                Continue with GitHub
              </button>
            </div>

            <div className="login-divider">
              <span>or continue with email</span>
            </div>
          </>
        )}

        {error && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.3)', 
            borderRadius: '8px', 
            padding: '10px 14px', 
            marginBottom: '16px',
            fontSize: '13px', 
            color: '#f87171', 
            fontFamily: "'Spline Sans Mono', monospace" 
          }}>
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="login-form">
          {!show2FA ? (
            <>
              {isRegistering && (
                <div className="input-group">
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    placeholder="John Quant" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required 
                  />
                </div>
              )}
              <div className="input-group">
                <label>Email Address</label>
                <input 
                  type="email" 
                  placeholder="you@fund.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
              <div className="input-group">
                <label>Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
            </>
          ) : (
            <div className="input-group">
              <label>Enter 6-Digit Authenticator Code</label>
              <input 
                type="text" 
                placeholder="000000" 
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                required 
                autoFocus
                style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '24px', fontWeight: 600 }}
              />
            </div>
          )}
          
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Authenticating..." : (show2FA ? "Verify Code ↗" : (isRegistering ? "Create Account ↗" : "Initialize Session ↗"))}
          </button>
        </form>

        {!show2FA && (
          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#8ba093', fontFamily: "'Spline Sans Mono', monospace" }}>
            {isRegistering ? "Already have an account? " : "New to Growth Engines? "}
            <span 
              style={{ color: '#3ddc91', cursor: 'pointer' }}
              onClick={() => setIsRegistering(!isRegistering)}
            >
              {isRegistering ? "Log In" : "Sign Up"}
            </span>
          </div>
        )}
        
        {show2FA && (
          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#8ba093', fontFamily: "'Spline Sans Mono', monospace" }}>
            <span 
              style={{ color: '#3ddc91', cursor: 'pointer' }}
              onClick={() => { setShow2FA(false); setTotpCode(""); setError(""); }}
            >
              ← Back to Login
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

