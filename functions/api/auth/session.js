/**
 * =============================================================================
 * LOOPX — CLOUDFLARE PAGES FUNCTION: /api/auth/session
 * functions/api/auth/session.js
 * =============================================================================
 *
 * Verifies the httpOnly `loopx_session` cookie using Web Crypto HMAC-SHA256.
 * Returns the authenticated user session if valid, or 401 Unauthorized.
 * =============================================================================
 */

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const [name, ...rest] = pair.trim().split('=');
    if (name) {
      cookies[name] = decodeURIComponent(rest.join('='));
    }
  }
  return cookies;
}

async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, bodyB64, sigB64] = parts;
    const data = `${headerB64}.${bodyB64}`;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Decode base64url signature
    let rawSig = sigB64.replace(/-/g, '+').replace(/_/g, '/');
    while (rawSig.length % 4) rawSig += '=';
    const binarySig = Uint8Array.from(atob(rawSig), c => c.charCodeAt(0));

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      binarySig,
      new TextEncoder().encode(data)
    );

    if (!isValid) return null;

    let rawBody = bodyB64.replace(/-/g, '+').replace(/_/g, '/');
    while (rawBody.length % 4) rawBody += '=';
    const payload = JSON.parse(atob(rawBody));

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const JWT_SECRET = env.JWT_SECRET || '';

  if (!JWT_SECRET) {
    return new Response(JSON.stringify({ error: 'Server configuration error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const token = cookies['loopx_session'];

  if (!token) {
    return new Response(JSON.stringify({ error: 'No active session.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const session = await verifyJWT(token, JWT_SECRET);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Invalid or expired session.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(
    JSON.stringify({
      role: session.role,
      username: session.username,
      displayName: session.displayName,
      permissions: session.permissions
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
