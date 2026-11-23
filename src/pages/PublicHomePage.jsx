/*
 * =============================================================================
 * LOOPX PUBLIC HOMEPAGE
 * src/pages/PublicHomePage.jsx
 * =============================================================================
 * Minimal, high-contrast, professional landing page.
 * Pure black (#000000), white text, LoopX Signature Lime (#8ee326) headings.
 * No gradients, no emojis, no clutter.
 * =============================================================================
 */

import React from 'react';

export default function PublicHomePage({ onGoToLogin }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#000000' }}>
      {/* Public Header */}
      <header className="navbar">
        <div className="nav-brand">
          <img
            src="/assets/loopx-logo.png"
            alt="LoopX"
            className="nav-logo-img"
          />
        </div>

        <div className="nav-right">
          <button
            type="button"
            onClick={onGoToLogin}
            className="btn-primary"
            style={{ padding: '8px 18px', fontSize: '13px' }}
          >
            Portal Login
          </button>
        </div>
      </header>

      {/* Main Hero Container */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ maxWidth: '780px', width: '100%', textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-block',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--color-green)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: '20px',
              border: '1px solid #1f360d',
              padding: '6px 14px',
              borderRadius: '4px',
              backgroundColor: '#070f03'
            }}
          >
            STRATEGY • CREATIVE • GROWTH
          </div>

          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.2rem)',
              color: 'var(--color-green)',
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              marginBottom: '20px',
              fontWeight: 800
            }}
          >
            WHERE IDEAS ENTER THE LOOP. AND COME OUT BIGGER.
          </h1>

          <p
            style={{
              fontSize: '16px',
              color: 'var(--text-white)',
              opacity: 0.85,
              lineHeight: 1.6,
              maxWidth: '620px',
              margin: '0 auto 36px'
            }}
          >
            LoopX is a high-performance management and execution platform engineered for client onboarding, automated intake, and real-time project delivery.
          </p>

          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onGoToLogin}
              className="btn-primary"
              style={{ padding: '12px 28px', fontSize: '15px' }}
            >
              Sign In to Management Portal →
            </button>
          </div>

          <div
            style={{
              marginTop: '48px',
              paddingTop: '28px',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '13px',
              color: 'var(--text-muted)'
            }}
          >
            Clients: To submit your project requirements, please use the private invitation link provided by your LoopX representative.
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer
        style={{
          padding: '20px 24px',
          borderTop: '1px solid var(--border-subtle)',
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--text-subtle)',
          fontFamily: 'var(--font-mono)'
        }}
      >
        © {new Date().getFullYear()} LOOPX. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
}
