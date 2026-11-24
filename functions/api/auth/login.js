/**
 * =============================================================================
 * LOOPX — CLOUDFLARE PAGES FUNCTION: /api/auth/login
 * functions/api/auth/login.js
 * =============================================================================
 *
 * This file runs on the Cloudflare Workers edge runtime (not Node.js).
 * It handles POST /api/auth/login for the production deployment.
 *
 * CREDENTIALS & PASSWORD HASHES:
 *   Stored in Cloudflare Pages environment variables (set in CF Dashboard,
 *   never in code or git). Required variables:
 *
 *     OWNER_USERNAME         — owner login username (not secret)
 *     OWNER_BCRYPT_HASH      — bcrypt hash of owner password
 *     EMPLOYEE_USERNAME      — employee login username (not secret)
 *     EMPLOYEE_BCRYPT_HASH   — bcrypt hash of employee password
 *     JWT_SECRET             — random 48+ byte hex string for signing sessions
 *
 *   HOW TO SET IN CLOUDFLARE PAGES:
 *     Dashboard → Your Pages project → Settings → Environment variables
 *     Add each variable above under "Production" (and "Preview" if needed).
 *
 *   HOW TO GENERATE A BCRYPT HASH FOR A NEW PASSWORD:
 *     node -e "const b=require('bcryptjs'); b.hash('NEW_PASSWORD',12).then(console.log);"
 *
 *   HOW TO GENERATE A JWT_SECRET:
 *     node -e "require('crypto').randomBytes(48,(e,b)=>console.log(b.toString('hex')))"
 *
 * =============================================================================
 */

import bcrypt from 'bcryptjs';

/** Sign a simple HS256 JWT using the Web Crypto API (available in CF Workers). */
async function signJWT(payload, secret, expiresInSeconds) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const body = btoa(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds
  })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${data}.${sigB64}`;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // --- Read required env vars set in Cloudflare Pages Dashboard ---
  const OWNER_USERNAME   = env.OWNER_USERNAME   || '';
  const OWNER_HASH       = env.OWNER_BCRYPT_HASH || '';
  const EMPLOYEE_USERNAME = env.EMPLOYEE_USERNAME || '';
  const EMPLOYEE_HASH    = env.EMPLOYEE_BCRYPT_HASH || '';
  const JWT_SECRET       = env.JWT_SECRET       || '';
  const SESSION_SECONDS  = parseInt(env.SESSION_MAX_AGE_SECONDS || '28800', 10);

  if (!JWT_SECRET || !OWNER_HASH || !EMPLOYEE_HASH) {
    console.error('[loopx] Missing required CF environment variables for authentication.');
    return new Response(
      JSON.stringify({ error: 'Server configuration error.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request body.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const username = (body.username || '').trim();
  const password = (body.password || '').trim();

  if (!username || !password) {
    return new Response(
      JSON.stringify({ error: 'Username and password are required.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const OWNER_PERMISSIONS = {
    canViewAllSubmissions: true,
    canUpdateAllStatuses: true,
    canViewAllProfiles: true,
    canViewAnalytics: true,
    canPostChat: true
  };

  const EMPLOYEE_PERMISSIONS = {
    canViewAllSubmissions: false,
    canUpdateOwnStatuses: true,
    canCreateClientLinks: true,
    canCreateProfiles: true,
    canPostChat: true
  };

  let sessionPayload = null;

  // --- Check owner ---
  if (username.toLowerCase() === OWNER_USERNAME.toLowerCase()) {
    const match = await bcrypt.compare(password, OWNER_HASH);
    if (match) {
      sessionPayload = {
        role: 'owner',
        username: OWNER_USERNAME,
        displayName: `${OWNER_USERNAME} (Owner)`,
        permissions: OWNER_PERMISSIONS
      };
    }
  }

  // --- Check employee ---
  if (!sessionPayload && username.toLowerCase() === EMPLOYEE_USERNAME.toLowerCase()) {
    const match = await bcrypt.compare(password, EMPLOYEE_HASH);
    if (match) {
      sessionPayload = {
        role: 'employee',
        username: EMPLOYEE_USERNAME,
        displayName: 'Team Employee',
        permissions: EMPLOYEE_PERMISSIONS
      };
    }
  }

  if (!sessionPayload) {
    // Constant-time-ish delay to resist timing attacks
    await new Promise(r => setTimeout(r, 300));
    return new Response(
      JSON.stringify({ error: 'Invalid username or password.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const token = await signJWT(sessionPayload, JWT_SECRET, SESSION_SECONDS);

  const cookieHeader = [
    `loopx_session=${token}`,
    'HttpOnly',
    'SameSite=Strict',
    'Secure',
    `Max-Age=${SESSION_SECONDS}`,
    'Path=/'
  ].join('; ');

  return new Response(
    JSON.stringify(sessionPayload),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookieHeader
      }
    }
  );
}
