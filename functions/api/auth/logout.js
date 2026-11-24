/**
 * =============================================================================
 * LOOPX — CLOUDFLARE PAGES FUNCTION: /api/auth/logout
 * functions/api/auth/logout.js
 * =============================================================================
 *
 * Clears the httpOnly `loopx_session` cookie by expiring it immediately.
 * =============================================================================
 */

export async function onRequestPost() {
  const cookieHeader = [
    'loopx_session=',
    'HttpOnly',
    'SameSite=Strict',
    'Secure',
    'Max-Age=0',
    'Path=/'
  ].join('; ');

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookieHeader
    }
  });
}
