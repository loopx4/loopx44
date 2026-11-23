/**
 * =============================================================================
 * LOOPX AUTHENTICATION & CREDENTIAL CONFIGURATION
 * src/config/auth.config.js
 * =============================================================================
 *
 * ⚠️  SECURITY NOTE FOR DEVELOPERS:
 * Credentials in VITE_ environment variables are bundled into the browser JS
 * bundle at build time. This is acceptable for a private internal management
 * tool (not a public SaaS), but means anyone with access to the built JS can
 * read them. For a fully secure deployment, replace this with a backend
 * authentication endpoint (e.g. Supabase Auth, or a serverless function that
 * verifies credentials server-side before issuing a session token).
 *
 * HOW TO CHANGE CREDENTIALS — TWO OPTIONS:
 *
 * Option A — Edit this file directly in VS Code:
 *   Change the string values in SECTION 1 and SECTION 2 below.
 *
 * Option B — Use your .env file (recommended for version control safety):
 *   Edit the .env file in the project root and set:
 *     VITE_OWNER_USERNAME=YourOwnerUsername
 *     VITE_OWNER_PASSWORD=YourOwnerPassword
 *     VITE_EMPLOYEE_USERNAME=YourEmployeeUsername
 *     VITE_EMPLOYEE_PASSWORD=YourEmployeePassword
 *   The .env file is excluded from git via .gitignore.
 *   The .env.example file documents all variables safely (no real passwords).
 *
 * NEVER commit real passwords to .env.example or any public GitHub file.
 * =============================================================================
 */

// =============================================================================
// [SECTION 1] — OWNER CREDENTIALS
// =============================================================================
// To change the owner login: edit the username and password strings below,
// OR set VITE_OWNER_USERNAME and VITE_OWNER_PASSWORD in your .env file.
// The .env variable takes priority over the hardcoded fallback string.
// =============================================================================
export const OWNER_CONFIG = {
  username: import.meta.env.VITE_OWNER_USERNAME || 'Jagan',
  password: import.meta.env.VITE_OWNER_PASSWORD || '12345678910',
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
// This is the shared team login used by all employees to enter the workspace.
// To change: edit strings below OR set VITE_EMPLOYEE_USERNAME / VITE_EMPLOYEE_PASSWORD in .env.
// Individual employee identity is established via their chosen Profile Name
// inside the workspace — NOT via separate passwords per employee.
// =============================================================================
export const EMPLOYEE_CONFIG = {
  username: import.meta.env.VITE_EMPLOYEE_USERNAME || 'Jagan team',
  password: import.meta.env.VITE_EMPLOYEE_PASSWORD || '123456789',
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
// [SECTION 3] — AUTHENTICATION SERVICE & ROLE IDENTIFIER
// Single common login verifies credentials and automatically identifies the role.
// =============================================================================
export function authenticateUser(username, password) {
  const trimmedUser = (username || '').trim();
  const trimmedPass = (password || '').trim();

  // Check Owner Credentials
  if (
    trimmedUser.toLowerCase() === OWNER_CONFIG.username.toLowerCase() &&
    trimmedPass === OWNER_CONFIG.password
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
    trimmedUser.toLowerCase() === EMPLOYEE_CONFIG.username.toLowerCase() &&
    trimmedPass === EMPLOYEE_CONFIG.password
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
