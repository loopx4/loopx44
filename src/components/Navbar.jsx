/*
 * =============================================================================
 * LOOPX NAVBAR COMPONENT
 * =============================================================================
 * Shows the LoopX logo, authenticated user badge, profile switcher and logout.
 *
 * DEVELOPER NOTE (code comment only):
 * - Logo src: /public/assets/loopx-logo.png  (replace file to update logo)
 * - Supabase connection status is intentionally NOT shown in the UI.
 *   To check connection status, see: src/services/supabaseClient.js
 * =============================================================================
 */
import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { session, activeProfile, logout, selectEmployeeProfile, isOwner, isEmployee } = useAuth();

  return (
    <header className="navbar">
      <div className="nav-brand">
        {/*
          LOGO — Uses the official LoopX logo PNG from /public/assets/loopx-logo.png
          CSS class .nav-logo-img handles cropping of the original image padding.
          Do not replace this src path without updating the CSS class accordingly.
        */}
        <img
          src="/assets/loopx-logo.png"
          alt="LoopX"
          className="nav-logo-img"
        />
      </div>

      <div className="nav-right">
        {/* User / Profile Info — only rendered for authenticated sessions */}
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
