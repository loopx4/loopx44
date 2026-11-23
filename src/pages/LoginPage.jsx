import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage({ onBackToHome }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Please provide both username and password.');
      return;
    }

    setIsSubmitting(true);
    const result = await login(username, password);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Authentication failed.');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backgroundColor: '#000000'
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          {onBackToHome && (
            <div style={{ marginBottom: '16px' }}>
              <button
                type="button"
                onClick={onBackToHome}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 0'
                }}
              >
                ← Back to Home
              </button>
            </div>
          )}

          <img
            src="/assets/loopx-logo.png"
            alt="LoopX"
            style={{ height: '36px', width: 'auto', marginBottom: '16px' }}
          />
          <h1 style={{ fontSize: '1.25rem', letterSpacing: '0.05em', color: 'var(--text-white)' }}>
            PORTAL LOGIN
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Enter your credentials to access your management dashboard.
          </p>
        </div>

        {/* Login Card */}
        <div className="card" style={{ padding: '32px' }}>
          {error && (
            <div
              style={{
                backgroundColor: '#1a0505',
                border: '1px solid #661111',
                color: 'var(--color-error)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                marginBottom: '20px'
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="Enter username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                disabled={isSubmitting}
                required
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', padding: '12px' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          {/*
            =====================================================================
            DEVELOPER NOTE (code comment only — never displayed in UI):
            Role is detected automatically from credentials in:
              - src/config/auth.config.js  →  SECTION 1 (Owner) / SECTION 2 (Employee)
              - .env  →  VITE_OWNER_* / VITE_EMPLOYEE_* variables
            This note must NEVER appear on any public page, login form, or dashboard.
            =====================================================================
          */}
        </div>
      </div>
    </div>
  );
}
