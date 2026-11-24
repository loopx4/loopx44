/**
 * =============================================================================
 * LOOPX — SERVER-SIDE CREDENTIAL CONFIGURATION
 * server/credentials.config.cjs
 * =============================================================================
 *
 * ⚠️  THIS FILE IS SERVER-ONLY.
 * It is never imported by any frontend file and never bundled into client JS.
 *
 * PRODUCTION-GRADE SECURITY:
 * All password hashes and JWT secrets are loaded strictly from environment
 * variables. NO hashes, secrets, or fallback credentials are hardcoded here.
 *
 * In local development, values are loaded from `.env` via dotenv.
 * In production (Cloudflare Pages), values are loaded from Cloudflare Pages
 * environment variables configured in the Cloudflare Dashboard.
 * =============================================================================
 */

'use strict';

const path = require('path');
const dotenv = require('dotenv');

// Load .env from project root if not already in environment
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// =============================================================================
// [SECTION 1] — OWNER CREDENTIALS (LOADED FROM ENVIRONMENT)
// =============================================================================
const OWNER_USERNAME = process.env.OWNER_USERNAME || 'Jagan';
const OWNER_BCRYPT_HASH = process.env.OWNER_BCRYPT_HASH;

const OWNER_PERMISSIONS = {
  canViewAllSubmissions: true,
  canUpdateAllStatuses: true,
  canViewAllProfiles: true,
  canViewAnalytics: true,
  canPostChat: true
};

// =============================================================================
// [SECTION 2] — EMPLOYEE CREDENTIALS (LOADED FROM ENVIRONMENT)
// =============================================================================
const EMPLOYEE_USERNAME = process.env.EMPLOYEE_USERNAME || 'Jagan team';
const EMPLOYEE_BCRYPT_HASH = process.env.EMPLOYEE_BCRYPT_HASH;

const EMPLOYEE_PERMISSIONS = {
  canViewAllSubmissions: false,
  canUpdateOwnStatuses: true,
  canCreateClientLinks: true,
  canCreateProfiles: true,
  canPostChat: true
};

// =============================================================================
// [SECTION 3] — SESSION CONFIGURATION (LOADED FROM ENVIRONMENT)
// =============================================================================
const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_MAX_AGE_SECONDS = parseInt(process.env.SESSION_MAX_AGE_SECONDS || '28800', 10);

/**
 * Validates that all required server secrets are present.
 * Throws a descriptive configuration error if any secret is missing.
 */
function assertServerConfig() {
  const missing = [];
  if (!OWNER_BCRYPT_HASH) missing.push('OWNER_BCRYPT_HASH');
  if (!EMPLOYEE_BCRYPT_HASH) missing.push('EMPLOYEE_BCRYPT_HASH');
  if (!JWT_SECRET) missing.push('JWT_SECRET');

  if (missing.length > 0) {
    throw new Error(
      `[loopx-server] Fatal configuration error: Missing required server environment variable(s): ${missing.join(', ')}. ` +
      `Ensure these are defined in your .env file (local) or Cloudflare Dashboard (production).`
    );
  }
}

module.exports = {
  OWNER_USERNAME,
  OWNER_BCRYPT_HASH,
  OWNER_PERMISSIONS,
  EMPLOYEE_USERNAME,
  EMPLOYEE_BCRYPT_HASH,
  EMPLOYEE_PERMISSIONS,
  JWT_SECRET,
  SESSION_MAX_AGE_SECONDS,
  assertServerConfig
};
