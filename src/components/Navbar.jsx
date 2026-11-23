import React from 'react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../services/supabaseClient';

export default function Navbar({ currentView, onNavigate }) {
  const { session, activeProfile, logout, selectEmployeeProfile, isOwner, isEmployee } = useAuth();

  return (
    <header className="navbar">
      <div className="nav-brand">
        <img
          src="/assets/loopx-logo.png"
          alt="LoopX Logo"
          className="nav-logo-img"
        />
      </div>

      <div className="nav-right">
        {/* Supabase Status Pill */}
        <div
          title={isSupabaseConfigured ? 'Connected to live Supabase backend' : 'Awaiting Supabase keys in .env. Running on local standby mode with zero data.'}
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            padding: '4px 8px',
            borderRadius: '4px',
            backgroundColor: '#0a0a0a',
            border: `1px solid ${isSupabaseConfigured ? '#234f07' : '#333333'}`,
            color: isSupabaseConfigured ? 'var(--color-green)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: isSupabaseConfigured ? 'var(--color-green)' : '#666666'
            }}
          />
          {isSupabaseConfigured ? 'Supabase Live' : 'Supabase: Ready for .env'}
        </div>

        {/* User / Profile Info */}
        {session && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isOwner && (
              <span className="mono-token" style={{ border: '1px solid #333' }}>
                OWNER: {session.username}
              </span>
            )}

            {isEmployee && activeProfile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="mono-token">
                  PROFILE: {activeProfile.name}
                </span>
                <button
                  type="button"
                  onClick={() => selectEmployeeProfile(null)}
                  className="btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                >
                  Switch Profile
                </button>
              </div>
            )}

            {isEmployee && !activeProfile && (
              <span className="mono-token" style={{ color: 'var(--text-muted)' }}>
                {session.displayName}
              </span>
            )}

            <button
              type="button"
              onClick={logout}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
