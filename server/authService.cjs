/**
 * =============================================================================
 * LOOPX — SERVER AUTHENTICATION SERVICE
 * server/authService.cjs
 * =============================================================================
 *
 * Core backend authentication service for credential verification, bcrypt password
 * validation, JWT token creation, and signature validation.
 *
 * NEVER IMPORT THIS IN FRONTEND CODE.
 * =============================================================================
 */

'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const creds = require('./credentials.config.cjs');

/**
 * Verifies username and password against server-stored bcrypt hashes.
 * Returns { success: true, role, username, displayName, permissions }
 * or { success: false, error }
 */
async function verifyCredentials(username, password) {
  const trimUser = (username || '').trim();
  const trimPass = (password || '').trim();

  if (!trimUser || !trimPass) {
    return {
      success: false,
      statusCode: 400,
      error: 'Username and password are required.'
    };
  }

  // Check Owner Credentials
  if (trimUser.toLowerCase() === creds.OWNER_USERNAME.toLowerCase()) {
    const isMatch = await bcrypt.compare(trimPass, creds.OWNER_BCRYPT_HASH);
    if (isMatch) {
      return {
        success: true,
        statusCode: 200,
        role: 'owner',
        username: creds.OWNER_USERNAME,
        displayName: 'Jagan (Owner)',
        permissions: creds.OWNER_PERMISSIONS
      };
    }
  }

  // Check Employee Credentials
  if (trimUser.toLowerCase() === creds.EMPLOYEE_USERNAME.toLowerCase()) {
    const isMatch = await bcrypt.compare(trimPass, creds.EMPLOYEE_BCRYPT_HASH);
    if (isMatch) {
      return {
        success: true,
        statusCode: 200,
        role: 'employee',
        username: creds.EMPLOYEE_USERNAME,
        displayName: 'Team Employee',
        permissions: creds.EMPLOYEE_PERMISSIONS
      };
    }
  }

  // Delay slightly to mitigate timing differences
  await new Promise((r) => setTimeout(r, 100));

  return {
    success: false,
    statusCode: 401,
    error: 'Invalid username or password.'
  };
}

/**
 * Creates a signed JWT session token.
 */
function createSessionToken(payload) {
  return jwt.sign(payload, creds.JWT_SECRET, {
    expiresIn: creds.SESSION_MAX_AGE_SECONDS
  });
}

/**
 * Verifies a JWT session token and returns the payload, or null if invalid/tampered/expired.
 */
function verifySessionToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, creds.JWT_SECRET);
  } catch {
    return null;
  }
}

module.exports = {
  verifyCredentials,
  createSessionToken,
  verifySessionToken,
  OWNER_USERNAME: creds.OWNER_USERNAME,
  EMPLOYEE_USERNAME: creds.EMPLOYEE_USERNAME,
  SESSION_MAX_AGE_SECONDS: creds.SESSION_MAX_AGE_SECONDS
};
