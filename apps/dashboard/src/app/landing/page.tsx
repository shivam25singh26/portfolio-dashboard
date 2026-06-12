"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import './landing.css';

export default function LandingPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/');
    }
  }, [status, router]);

  return (
    <div className="landing-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="logo">Growth<span>Engines</span></div>
        <div className="nav-links">
          <Link href="/login" className="nav-btn-secondary">Log In</Link>
          <Link href="/login" className="nav-btn-primary">Access Platform</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero-section">
        <div className="hero-content">
          <div className="badge">System Architecture V1.2</div>
          <h1 className="hero-title">Autonomous Algorithmic <span className="highlight">Execution.</span></h1>
          <p className="hero-subtitle">
            Institutional-grade infrastructure powered by multi-stage LLM pipelines. Backtest and forward-test quantitative strategies across global equities and crypto with zero capital risk.
          </p>
          <div className="cta-group">
            <Link href="/login" className="cta-primary">Launch Terminal</Link>
            <a href="#how-it-works" className="cta-secondary">View Architecture</a>
          </div>
          
          <div className="stats-container">
            <div className="stat-box">
              <div className="stat-value">84.2%</div>
              <div className="stat-label">Historical Win Rate</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">+3.18%</div>
              <div className="stat-label">Avg Return / Trade</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">24/7</div>
              <div className="stat-label">Continuous Scanning</div>
            </div>
          </div>
        </div>
      </header>

      {/* How it Works Section */}
      <section id="how-it-works" className="how-section">
        <h2 className="section-title">Execution Pipeline</h2>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-num">01. DATA INGESTION</div>
            <h3>Real-time Aggregation</h3>
            <p>Proprietary workers ingest live price action, volatility spikes, and institutional news flow across US, EU, and IN markets instantly.</p>
          </div>
          <div className="step-card">
            <div className="step-num">02. NEURAL FILTERING</div>
            <h3>Deterministic Logic</h3>
            <p>Stage 2 LLMs ruthlessly filter out noise, rejecting low-conviction setups to protect capital allocation and minimize drawdown.</p>
          </div>
          <div className="step-card">
            <div className="step-num">03. AUTO EXECUTION</div>
            <h3>Paper Deployment</h3>
            <p>Approved signals are routed through our RabbitMQ broker and executed automatically into isolated, per-user paper portfolios.</p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="pricing-section">
        <h2 className="section-title">Platform Access</h2>
        <div className="pricing-grid">
          <div className="price-card">
            <div className="price-header">
              <h3>Standard Tier</h3>
              <div className="price">₹0<span>/mo</span></div>
            </div>
            <ul className="features-list">
              <li className="active">Global Equity Dashboard</li>
              <li className="active">15-Minute Delayed Signals</li>
              <li className="active">Manual Paper Trading</li>
              <li>Priority Order Queue</li>
            </ul>
            <Link href="/login" className="price-btn">Create Free Account</Link>
          </div>
          <div className="price-card pro">
            <div className="badge-pro">Institutional</div>
            <div className="price-header">
              <h3>Pro Tier</h3>
              <div className="price">₹4,999<span>/mo</span></div>
            </div>
            <ul className="features-list">
              <li className="active">Global Equity Dashboard</li>
              <li className="active">Instant Real-time Signals</li>
              <li className="active">Auto-Execution Bot</li>
              <li className="active">Priority Order Queue</li>
            </ul>
            <Link href="/login" className="price-btn pro">Request Pro Access</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>© {new Date().getFullYear()} Growth Engines - Simulated trading infrastructure. Not financial advice.</p>
      </footer>
    </div>
  );
}
