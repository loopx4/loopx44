/**
 * =============================================================================
 * CLOUDFLARE PAGES FUNCTIONS INDEPENDENT TEST SUITE
 * tests/cloudflare-functions.test.js
 * =============================================================================
 *
 * Tests the Cloudflare Pages Functions (edge workers) handlers directly and
 * independently of the Express server.
 * Uses Web Standard Request/Response and Web Crypto HMAC-SHA256.
 * =============================================================================
 */

import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { onRequestPost as loginHandler } from '../functions/api/auth/login.js';
import { onRequestGet as sessionHandler } from '../functions/api/auth/session.js';
import { onRequestPost as logoutHandler } from '../functions/api/auth/logout.js';

// Pre-generated test hashes for password verification
const TEST_ENV = {
  OWNER_USERNAME: 'Jagan',
  OWNER_BCRYPT_HASH: bcrypt.hashSync('12345678910', 10),
  EMPLOYEE_USERNAME: 'Jagan team',
  EMPLOYEE_BCRYPT_HASH: bcrypt.hashSync('123456789', 10),
  JWT_SECRET: 'test-cloudflare-jwt-secret-key-1234567890abcdef',
  SESSION_MAX_AGE_SECONDS: '28800'
};

describe('Cloudflare Pages Functions: POST /api/auth/login', () => {
  it('authenticates valid owner credentials and sets httpOnly session cookie', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'sec-fetch-site': 'same-origin'
      },
      body: JSON.stringify({ username: 'Jagan', password: '12345678910' })
    });

    const res = await loginHandler({ request: req, env: TEST_ENV });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.role).toBe('owner');
    expect(data.username).toBe('Jagan');

    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('loopx_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
  });

  it('authenticates valid employee credentials and sets role to employee', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'sec-fetch-site': 'same-origin'
      },
      body: JSON.stringify({ username: 'Jagan team', password: '123456789' })
    });

    const res = await loginHandler({ request: req, env: TEST_ENV });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.role).toBe('employee');
  });

  it('rejects invalid password with 401 Unauthorized', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Jagan', password: 'wrongpassword' })
    });

    const res = await loginHandler({ request: req, env: TEST_ENV });
    expect(res.status).toBe(401);
  });

  it('rejects cross-site CSRF requests with 403 Forbidden', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'sec-fetch-site': 'cross-site'
      },
      body: JSON.stringify({ username: 'Jagan', password: '12345678910' })
    });

    const res = await loginHandler({ request: req, env: TEST_ENV });
    expect(res.status).toBe(403);
  });

  it('rejects missing or empty credentials with 400 Bad Request', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '', password: '' })
    });

    const res = await loginHandler({ request: req, env: TEST_ENV });
    expect(res.status).toBe(400);
  });
});

describe('Cloudflare Pages Functions: GET /api/auth/session', () => {
  it('validates session cookie and returns authenticated role', async () => {
    // 1. Login to obtain cookie
    const loginReq = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Jagan', password: '12345678910' })
    });

    const loginRes = await loginHandler({ request: loginReq, env: TEST_ENV });
    const cookieHeader = loginRes.headers.get('Set-Cookie');
    const token = cookieHeader.split(';')[0].replace('loopx_session=', '');

    // 2. Query session with cookie
    const sessionReq = new Request('http://localhost/api/auth/session', {
      method: 'GET',
      headers: { Cookie: `loopx_session=${token}` }
    });

    const sessionRes = await sessionHandler({ request: sessionReq, env: TEST_ENV });
    expect(sessionRes.status).toBe(200);

    const sessionData = await sessionRes.json();
    expect(sessionData.role).toBe('owner');
    expect(sessionData.username).toBe('Jagan');
  });

  it('rejects tampered session cookies with 401 Unauthorized', async () => {
    const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoib3duZXIifQ.invalidsignature123';
    const req = new Request('http://localhost/api/auth/session', {
      headers: { Cookie: `loopx_session=${fakeToken}` }
    });

    const res = await sessionHandler({ request: req, env: TEST_ENV });
    expect(res.status).toBe(401);
  });

  it('returns 401 when no session cookie is provided', async () => {
    const req = new Request('http://localhost/api/auth/session');
    const res = await sessionHandler({ request: req, env: TEST_ENV });
    expect(res.status).toBe(401);
  });
});

describe('Cloudflare Pages Functions: POST /api/auth/logout', () => {
  it('clears session cookie by returning Max-Age=0', async () => {
    const req = new Request('http://localhost/api/auth/logout', { method: 'POST' });
    const res = await logoutHandler({ request: req });
    expect(res.status).toBe(200);

    const cookieHeader = res.headers.get('Set-Cookie');
    expect(cookieHeader).toContain('Max-Age=0');
  });
});
