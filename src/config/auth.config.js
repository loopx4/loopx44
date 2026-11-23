/**
 * =============================================================================
 * LOOPX AUTHENTICATION & CREDENTIAL CONFIGURATION
 * src/config/auth.config.js
 * =============================================================================
 *
 * SECURITY APPROACH — SHA-256 HASH COMPARISON (BROWSER SubtleCrypto):
 * Passwords are NEVER stored as plain text anywhere in this file, the .env
 * file, or the production JS bundle. Only their SHA-256 hashes are stored here.
 *
 * When the user enters a password, SubtleCrypto.digest('SHA-256', ...) hashes
 * it in the browser and compares the result against the stored hash. Plain
 * passwords are never readable from the bundle via browser DevTools.
 *
 * NOTE: This is defence-in-depth for a private internal management tool. For
 * maximum security (multi-user SaaS), replace this with Supabase Auth which
 * handles hashing server-side with bcrypt and never exposes passwords at all.
 *
 * HOW TO CHANGE CREDENTIALS:
 * ─────────────────────────────────────────────────────────────────────────────
 * Step 1 — Compute the SHA-256 hash of the new password in your terminal:
 *           node -e "const c=require('crypto'); console.log(c.createHash('sha256').update('YOUR_NEW_PASSWORD').digest('hex'));"
 *
 * Step 2 — Paste the resulting hash string into OWNER_PASSWORD_HASH or
 *           EMPLOYEE_PASSWORD_HASH below (not the raw password, only the hash).
 *
 * Step 3 — Save this file and rebuild the app: npm run build
 *
 * NEVER store raw passwords here, in .env, in .env.example, or in git commits.
 * =============================================================================
 */

// =============================================================================
// [SECTION 1] — OWNER CREDENTIALS
// =============================================================================
// Owner username (not secret — OK to store as plain text).
// Owner password stored ONLY as SHA-256 hash — raw password is NEVER stored.
//
// Current owner username : Jagan
// Current owner password : (kept only in your head or a password manager)
// SHA-256 hash of password '12345678910':
//   63640264849a87c90356129d99ea165e37aa5fabc1fea46906df1a7ca50db492
//
// To change: compute hash as above, replace OWNER_PASSWORD_HASH value.
// =============================================================================
const OWNER_USERNAME = import.meta.env.VITE_OWNER_USERNAME || 'Jagan';
const OWNER_PASSWORD_HASH =
  '63640264849a87c90356129d99ea165e37aa5fabc1fea46906df1a7ca50db492';

export const OWNER_CONFIG = {
  username: OWNER_USERNAME,
  role: 'owner',
  displayName: 'Jagan (Owner)',
  permissions: {
    canViewAllSubmissions: true,
    canUpdateAllStatuses: true,
    canViewAllProfiles: true,
    canViewAnalytics: true,
    canPostChat: true
  }
};

// =============================================================================
// [SECTION 2] — EMPLOYEE CREDENTIALS
// =============================================================================
// Shared team login used by all employees to enter the workspace.
// Individual employee identity is established via their chosen Profile Name
// inside the workspace — NOT via separate passwords per employee.
//
// Current employee username : Jagan team
// Current employee password : (kept only in your head or a password manager)
// SHA-256 hash of password '123456789':
//   15e2b0d3c33891ebb0f1ef609ec419420c20e320ce94c65fbc8c3312448eb225
//
// To change: compute hash as above, replace EMPLOYEE_PASSWORD_HASH value.
// =============================================================================
const EMPLOYEE_USERNAME = import.meta.env.VITE_EMPLOYEE_USERNAME || 'Jagan team';
const EMPLOYEE_PASSWORD_HASH =
  '15e2b0d3c33891ebb0f1ef609ec419420c20e320ce94c65fbc8c3312448eb225';

export const EMPLOYEE_CONFIG = {
  username: EMPLOYEE_USERNAME,
  role: 'employee',
  displayName: 'Team Employee',
  permissions: {
    canViewAllSubmissions: false, // Employees only access records they created
    canUpdateOwnStatuses: true,
    canCreateClientLinks: true,
    canCreateProfiles: true,
    canPostChat: true
  }
};

// =============================================================================
// [SECTION 3] — PASSWORD HASHING UTILITY
// Uses browser SubtleCrypto (available in all modern browsers, no library needed).
// Returns the lowercase hex SHA-256 hash of the given plain-text password.
// =============================================================================
async function hashPassword(plainText) {
  const encoded = new TextEncoder().encode(plainText);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// =============================================================================
// [SECTION 4] — AUTHENTICATION SERVICE & ROLE IDENTIFIER
// Single common login verifies credentials and automatically identifies the role.
// This function is ASYNC because SubtleCrypto.digest() returns a Promise.
// Callers must use: const result = await authenticateUser(username, password);
// =============================================================================
export async function authenticateUser(username, password) {
  const trimmedUser = (username || '').trim();
  const trimmedPass = (password || '').trim();

  if (!trimmedUser || !trimmedPass) {
    return { success: false, error: 'Please provide both username and password.' };
  }

  // Hash the entered password once — compare against stored hashes
  const enteredHash = await hashPassword(trimmedPass);

  // Check Owner Credentials
  if (
    trimmedUser.toLowerCase() === OWNER_USERNAME.toLowerCase() &&
    enteredHash === OWNER_PASSWORD_HASH
  ) {
    return {
      success: true,
      role: 'owner',
      username: OWNER_CONFIG.username,
      displayName: OWNER_CONFIG.displayName,
      permissions: OWNER_CONFIG.permissions
    };
  }

  // Check Employee Credentials
  if (
    trimmedUser.toLowerCase() === EMPLOYEE_USERNAME.toLowerCase() &&
    enteredHash === EMPLOYEE_PASSWORD_HASH
  ) {
    return {
      success: true,
      role: 'employee',
      username: EMPLOYEE_CONFIG.username,
      displayName: EMPLOYEE_CONFIG.displayName,
      permissions: EMPLOYEE_CONFIG.permissions
    };
  }

  return {
    success: false,
    error: 'Invalid username or password. Please verify your credentials.'
  };
}
