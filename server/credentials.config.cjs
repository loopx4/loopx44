/**
 * =============================================================================
 * LOOPX — SERVER-SIDE CREDENTIAL CONFIGURATION
 * server/credentials.config.cjs
 * =============================================================================
 *
 * ⚠️  THIS FILE IS SERVER-ONLY. It must NEVER be imported by any file inside
 *     src/ (frontend). It is never processed by Vite and never reaches the
 *     browser bundle.
 *
 * SECURITY: Passwords are stored as bcrypt hashes (cost factor 12, salted).
 * Plain-text passwords are never stored here, in .env, or anywhere on disk.
 * The bcrypt algorithm is resistant to brute-force and rainbow table attacks.
 *
 * HOW TO CHANGE A PASSWORD:
 * ─────────────────────────────────────────────────────────────────────────────
 * Step 1 — Open a terminal in the project root and run:
 *           node -e "
 *             const b = require('bcryptjs');
 *             b.hash('YOUR_NEW_PASSWORD', 12).then(h => console.log(h));
 *           "
 *
 * Step 2 — Copy the output hash string (starts with $2b$12$...) and replace
 *           the value of OWNER_BCRYPT_HASH or EMPLOYEE_BCRYPT_HASH below.
 *
 * Step 3 — Restart the backend server: npm run dev
 *
 * NEVER store raw passwords here, in .env, in any VITE_ variable, or in git.
 * =============================================================================
 */

'use strict';

// =============================================================================
// [SECTION 1] — OWNER CREDENTIALS (SERVER-SIDE ONLY)
// =============================================================================
// Owner username: not secret — displayed in UI.
// Owner password: stored ONLY as a bcrypt hash below.
//
// Current owner username  : Jagan
// Current bcrypt hash is for password: (store in your password manager only)
//
// To update username: change OWNER_USERNAME string below.
// To update password: generate new hash as instructed above, replace below.
// =============================================================================
const OWNER_USERNAME = 'Jagan';
const OWNER_BCRYPT_HASH = '$2b$12$irbZaFRVJhto9fgNJw/pwuezijqyYsy395ruXdftgoK2XD7FFNoCi';

const OWNER_PERMISSIONS = {
  canViewAllSubmissions: true,
  canUpdateAllStatuses: true,
  canViewAllProfiles: true,
  canViewAnalytics: true,
  canPostChat: true
};

// =============================================================================
// [SECTION 2] — EMPLOYEE CREDENTIALS (SERVER-SIDE ONLY)
// =============================================================================
// Shared team login used by all employees to enter the workspace.
// Individual employee identity is set via profile name inside the workspace,
// not via separate passwords per employee.
//
// Current employee username  : Jagan team
// Current bcrypt hash is for password: (store in your password manager only)
//
// To update username: change EMPLOYEE_USERNAME string below.
// To update password: generate new hash as instructed above, replace below.
// =============================================================================
const EMPLOYEE_USERNAME = 'Jagan team';
const EMPLOYEE_BCRYPT_HASH = '$2b$12$58BUD0.w/H.oAWKSCUQcfuDfL43Jn86shb7P.f9YctuGDgvBVmPKu';

const EMPLOYEE_PERMISSIONS = {
  canViewAllSubmissions: false,
  canUpdateOwnStatuses: true,
  canCreateClientLinks: true,
  canCreateProfiles: true,
  canPostChat: true
};

// =============================================================================
// [SECTION 3] — SESSION CONFIGURATION (SERVER-SIDE ONLY)
// =============================================================================
// JWT_SECRET must be a long random string. Never expose it in frontend code
// or VITE_ variables. Set it in .env (server-side) for production.
//
// To regenerate a secret:
//   node -e "require('crypto').randomBytes(48, (e,b) => console.log(b.toString('hex')))"
//
// SESSION_MAX_AGE_SECONDS: how long a login session stays valid.
//   Default: 28800 seconds = 8 hours. Adjust as needed.
// =============================================================================
const JWT_SECRET =
  process.env.JWT_SECRET ||
  '39094bcc062d23405fd9c8108a8af13980f68f793c9a964155d37378fc3c10c3d0c7ed38ee02c5a9f841ae66dda7df18';

const SESSION_MAX_AGE_SECONDS = parseInt(process.env.SESSION_MAX_AGE_SECONDS || '28800', 10);

// =============================================================================
// EXPORTS — used by server/index.cjs and functions/ only
// =============================================================================
module.exports = {
  OWNER_USERNAME,
  OWNER_BCRYPT_HASH,
  OWNER_PERMISSIONS,
  EMPLOYEE_USERNAME,
  EMPLOYEE_BCRYPT_HASH,
  EMPLOYEE_PERMISSIONS,
  JWT_SECRET,
  SESSION_MAX_AGE_SECONDS
};
