/**
 * =============================================================================
 * LOOPX — CLOUDFLARE PAGES FUNCTION: /api/auth/logout
 * functions/api/auth/logout.js
 * =============================================================================
 *
 * Clears the httpOnly `loopx_session` cookie by expiring it immediately.
 * =============================================================================
 */

export async function onRequestPost(context) {
  const { request } = context;

  // CSRF Mitigation: Reject cross-site requests
  const secFetchSite = request?.headers?.get('sec-fetch-site');
  if (secFetchSite === 'cross-site') {
    return new Response(JSON.stringify({ error: 'Cross-site request blocked.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

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
