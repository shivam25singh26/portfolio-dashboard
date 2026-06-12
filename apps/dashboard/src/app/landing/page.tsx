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
        <div className="logo">Lever.ai</div>
        <div className="nav-links">
          <Link href="/login" className="nav-btn-secondary">Log In</Link>
          <Link href="/login" className="nav-btn-primary">Get Started</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero-section">
        <div className="hero-content">
          <div className="badge">🚀 The Future of Quantitative Trading</div>
          <h1 className="hero-title">An AI Analyst That <span className="highlight">Never Sleeps.</span></h1>
          <p className="hero-subtitle">
            Harness the power of 3-stage LLM pipelines to execute high-conviction paper trades on NSE and Crypto markets automatically.
          </p>
          <div className="cta-group">
            <Link href="/login" className="cta-primary">Start Paper Trading Free</Link>
            <a href="#how-it-works" className="cta-secondary">See How It Works</a>
          </div>
          
          <div className="stats-container">
            <div className="stat-box">
              <div className="stat-value">84%</div>
              <div className="stat-label">Win Rate</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">+3.2%</div>
              <div className="stat-label">Avg Return</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">24/7</div>
              <div className="stat-label">Market Coverage</div>
            </div>
          </div>
        </div>
      </header>

      {/* How it Works Section */}
      <section id="how-it-works" className="how-section">
        <h2 className="section-title">Institutional Grade Pipeline</h2>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-icon">📊</div>
            <h3>1. Data Ingestion</h3>
            <p>Real-time price action, volume spikes, and breaking news are fed into our first-layer AI instantly.</p>
          </div>
          <div className="step-card">
            <div className="step-icon">🧠</div>
            <h3>2. Neural Filtering</h3>
            <p>Stage 2 LLMs ruthlessly filter out noise, rejecting low-conviction setups to protect your capital.</p>
          </div>
          <div className="step-card">
            <div className="step-icon">⚡</div>
            <h3>3. Auto Execution</h3>
            <p>Approved signals are broadcasted instantly or automatically paper-traded into your personalized portfolio.</p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="pricing-section">
        <h2 className="section-title">Transparent Pricing</h2>
        <div className="pricing-grid">
          <div className="price-card">
            <div className="price-header">
              <h3>Free Tier</h3>
              <div className="price">₹0<span>/mo</span></div>
            </div>
            <ul className="features-list">
              <li>✅ Basic Portfolio Dashboard</li>
              <li>✅ 15-Minute Delayed Signals</li>
              <li>✅ Manual Paper Trading</li>
            </ul>
            <Link href="/login" className="price-btn">Get Started</Link>
          </div>
          <div className="price-card pro">
            <div className="badge-pro">Most Popular</div>
            <div className="price-header">
              <h3>Pro Tier</h3>
              <div className="price">₹4,999<span>/mo</span></div>
            </div>
            <ul className="features-list">
              <li>✅ Everything in Free</li>
              <li>✅ Instant Real-time Signals</li>
              <li>✅ Auto-Execution Bot</li>
              <li>✅ Priority AI Queue</li>
            </ul>
            <Link href="/login" className="price-btn pro">Upgrade to Pro</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>© {new Date().getFullYear()} Lever.ai - All rights reserved. For paper trading only.</p>
      </footer>
    </div>
  );
}
