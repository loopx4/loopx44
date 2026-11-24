/**
 * =============================================================================
 * LOOPX — SECURE AUTHENTICATION BACKEND (Express)
 * server/index.cjs
 * =============================================================================
 *
 * This Express server handles ALL authentication for the LoopX application
 * during local development. It is never bundled into the frontend.
 *
 * In production (Cloudflare Pages), this role is handled by Pages Functions
 * in the functions/ directory.
 *
 * ENDPOINTS:
 *   POST /api/auth/login    — Verify credentials, issue session cookie
 *   POST /api/auth/logout   — Clear session cookie
 *   GET  /api/auth/session  — Return current session info (requires cookie)
 *
 * SESSION COOKIE:
 *   Name     : loopx_session
 *   httpOnly : true  (not accessible via document.cookie / XSS)
 *   sameSite : 'strict'
 *   secure   : true in production, false in dev (HTTP localhost)
 *   signed   : yes, via JWT (HS256) using JWT_SECRET
 * =============================================================================
 */

'use strict';

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authService = require('./authService.cjs');

const app = express();
const PORT = process.env.SERVER_PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// =============================================================================
// MIDDLEWARE
// =============================================================================
app.use(express.json());
app.use(cookieParser());

// CORS: allow requests from the Vite dev server with credentials
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

/**
 * Issue a signed JWT session cookie.
 */
function issueSessionCookie(res, payload) {
  const token = authService.createSessionToken(payload);
  res.cookie('loopx_session', token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'strict',
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
    sameSite: 'strict'
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
  app.listen(PORT, () => {
    console.log(`[loopx-server] Auth backend running on http://localhost:${PORT}`);
    console.log(`[loopx-server] Endpoints: POST /api/auth/login | GET /api/auth/session | POST /api/auth/logout`);
  });
}

module.exports = app;
