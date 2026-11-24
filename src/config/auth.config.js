/**
 * =============================================================================
 * LOOPX AUTHENTICATION CLIENT CONFIGURATION
 * src/config/auth.config.js
 * =============================================================================
 *
 * ⚠️  SECURITY NOTICE:
 * NO CREDENTIALS, PASSWORDS, OR PASSWORD HASHES EXIST IN THIS FILE OR ANY
 * FRONTEND JAVASCRIPT FILE.
 *
 * All credential verification and password hashing (bcrypt, cost factor 12)
 * is handled exclusively on the secure backend:
 *   - Local Development : server/credentials.config.cjs & server/index.cjs
 *   - Production (Cloudflare Pages) : functions/api/auth/* using environment secrets
 *
 * SESSIONS:
 * Sessions are issued by the server as signed, httpOnly, Strict SameSite cookies.
 * The client does not store or evaluate password hashes and cannot forge sessions.
 * =============================================================================
 */

const API_BASE = '/api/auth';

/**
 * Authenticates user credentials via the secure backend API.
 * The server verifies bcrypt hashes and sets an httpOnly session cookie.
 * Returns { success: true, role, username, displayName, permissions }
 * or { success: false, error: string }.
 */
export async function authenticateUser(username, password) {
  const trimmedUser = (username || '').trim();
  const trimmedPass = (password || '').trim();

  if (!trimmedUser || !trimmedPass) {
    return {
      success: false,
      error: 'Please provide both username and password.'
    };
  }

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        username: trimmedUser,
        password: trimmedPass
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        error: data.error || 'Authentication failed. Please verify your credentials.'
      };
    }

    return {
      success: true,
      role: data.role,
      username: data.username,
      displayName: data.displayName,
      permissions: data.permissions
    };
  } catch {
    return {
      success: false,
      error: 'Unable to connect to authentication server. Please ensure the backend is running.'
    };
  }
}

/**
 * Validates active server session via the httpOnly cookie.
 * Returns session object if verified by backend, or null if unauthenticated.
 */
export async function fetchServerSession() {
  try {
    const res = await fetch(`${API_BASE}/session`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!res.ok) {
      return null;
    }

    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

/**
 * Terminates the active session on the backend and clears the httpOnly session cookie.
 */
export async function logoutServerSession() {
  try {
    await fetch(`${API_BASE}/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch {
    // Fail silently on network errors during logout
  }
}
