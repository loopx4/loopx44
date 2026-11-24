/**
 * =============================================================================
 * LOOPX — SECURE AUTHENTICATION BACKEND (Express)
 * server/index.cjs
 * =============================================================================
 *
 * This Express server handles authentication for the LoopX application
 * during local development. It is never bundled into the frontend.
 *
 * In production (Cloudflare Pages), this role is handled by Pages Functions
 * in the functions/ directory.
 *
 * SECURITY CONTROLS:
 *   - Passwords verified with bcrypt (cost factor 12) strictly on backend
 *   - Secrets loaded strictly from environment variables (never committed)
 *   - httpOnly, SameSite=Strict session cookies (mitigates cookie theft & CSRF)
 *   - Origin & Sec-Fetch-Site validation on POST routes (CSRF mitigation)
 *   - JWT signature verification & expiry checks on every request
 * =============================================================================
 */

'use strict';

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const creds = require('./credentials.config.cjs');
const authService = require('./authService.cjs');

const app = express();
const PORT = process.env.SERVER_PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// =============================================================================
// MIDDLEWARE
// =============================================================================
app.use(express.json());
app.use(cookieParser());

// CORS: allow requests from the Vite dev server with credentials
app.use(cors({
  origin: ALLOWED_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// CSRF & Origin Validation Middleware for mutation requests
function csrfProtection(req, res, next) {
  if (req.method === 'POST') {
    const origin = req.headers['origin'];
    const secFetchSite = req.headers['sec-fetch-site'];

    // Reject explicit cross-site requests
    if (secFetchSite === 'cross-site') {
      return res.status(403).json({ error: 'Cross-site request blocked.' });
    }

    // If Origin header is sent, verify it matches allowed origin
    if (origin && origin !== ALLOWED_ORIGIN) {
      return res.status(403).json({ error: 'Invalid request origin.' });
    }
  }
  next();
}

app.use(csrfProtection);

/**
 * Issue a signed JWT session cookie.
 */
function issueSessionCookie(res, payload) {
  const token = authService.createSessionToken(payload);
  res.cookie('loopx_session', token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'strict',
    path: '/',
    maxAge: authService.SESSION_MAX_AGE_SECONDS * 1000
  });
}

// =============================================================================
// POST /api/auth/login
// =============================================================================
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  const result = await authService.verifyCredentials(username, password);

  if (!result.success) {
    return res.status(result.statusCode || 401).json({ error: result.error });
  }

  const payload = {
    role: result.role,
    username: result.username,
    displayName: result.displayName,
    permissions: result.permissions
  };

  issueSessionCookie(res, payload);
  return res.status(200).json(payload);
});

// =============================================================================
// GET /api/auth/session
// =============================================================================
app.get('/api/auth/session', (req, res) => {
  const token = req.cookies['loopx_session'];
  const session = authService.verifySessionToken(token);

  if (!session) {
    return res.status(401).json({ error: 'No active session.' });
  }

  return res.status(200).json({
    role: session.role,
    username: session.username,
    displayName: session.displayName,
    permissions: session.permissions
  });
});

// =============================================================================
// POST /api/auth/logout
// =============================================================================
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('loopx_session', {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'strict',
    path: '/'
  });
  return res.status(200).json({ success: true });
});

// =============================================================================
// 404 handler
// =============================================================================
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Start listening if executed directly
if (require.main === module) {
  try {
    creds.assertServerConfig();
    app.listen(PORT, () => {
      console.log(`[loopx-server] Auth backend running on http://localhost:${PORT}`);
      console.log(`[loopx-server] Endpoints: POST /api/auth/login | GET /api/auth/session | POST /api/auth/logout`);
    });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = app;
