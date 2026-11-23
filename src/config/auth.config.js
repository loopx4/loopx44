/**
 * =============================================================================
 * LOOPX AUTHENTICATION & CREDENTIAL CONFIGURATION
 * =============================================================================
 * You can edit the credentials below directly in VS Code, or override them
 * in your .env file using VITE_OWNER_* and VITE_EMPLOYEE_* variables.
 * =============================================================================
 */

// =============================================================================
// [SECTION 1] — OWNER CREDENTIALS
// Edit owner access credentials below.
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
// Edit shared employee workspace entry credentials below.
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
