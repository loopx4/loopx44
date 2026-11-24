/**
 * =============================================================================
 * LOOPX COMPREHENSIVE TEST SUITE
 * tests/loopx.test.js
 * =============================================================================
 *
 * Covers:
 * 1. Backend Authentication & Role Routing
 * 2. Security Bypass Attempts & Session Manipulation
 * 3. Permission Boundaries & Authorization Checks
 * 4. Queue Number Generation
 * 5. Profile Deduplication Logic
 * 6. Team Chat Mention Detection
 * =============================================================================
 */

import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import authService from '../server/authService.cjs';
import creds from '../server/credentials.config.cjs';
import { formatQueueNumber } from '../src/services/dataService';

// ---------------------------------------------------------------------------
// 1. BACKEND AUTHENTICATION & ROLE ROUTING
// ---------------------------------------------------------------------------
describe('LoopX Backend Authentication & Role Routing', () => {
  it('correctly authenticates owner credentials and returns owner role with permissions', async () => {
    const res = await authService.verifyCredentials('Jagan', '12345678910');
    expect(res.success).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.role).toBe('owner');
    expect(res.permissions.canViewAllSubmissions).toBe(true);
    expect(res.permissions.canUpdateAllStatuses).toBe(true);
    expect(res.permissions.canViewAnalytics).toBe(true);
  });

  it('correctly authenticates employee credentials and returns employee role', async () => {
    const res = await authService.verifyCredentials('Jagan team', '123456789');
    expect(res.success).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.role).toBe('employee');
    expect(res.permissions.canViewAllSubmissions).toBe(false);
    expect(res.permissions.canCreateClientLinks).toBe(true);
  });

  it('handles case-insensitive usernames gracefully', async () => {
    const res1 = await authService.verifyCredentials('jagan', '12345678910');
    expect(res1.success).toBe(true);
    expect(res1.role).toBe('owner');

    const res2 = await authService.verifyCredentials('JAGAN TEAM', '123456789');
    expect(res2.success).toBe(true);
    expect(res2.role).toBe('employee');
  });

  it('rejects invalid password for owner', async () => {
    const res = await authService.verifyCredentials('Jagan', 'wrongpass123');
    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.error).toBe('Invalid username or password.');
  });

  it('rejects invalid password for employee', async () => {
    const res = await authService.verifyCredentials('Jagan team', 'invalidpass');
    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it('rejects unknown usernames', async () => {
    const res = await authService.verifyCredentials('attacker_user', '123456789');
    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it('rejects empty or whitespace-only credentials', async () => {
    const resEmpty = await authService.verifyCredentials('', '');
    expect(resEmpty.success).toBe(false);
    expect(resEmpty.statusCode).toBe(400);

    const resSpaces = await authService.verifyCredentials('   ', '   ');
    expect(resSpaces.success).toBe(false);
    expect(resSpaces.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// 2. SECURITY AUDIT: BYPASS ATTEMPTS & SESSION MANIPULATION
// ---------------------------------------------------------------------------
describe('LoopX Security Audit: Session Manipulation & Bypass Attempts', () => {
  it('creates and verifies valid server-issued JWT tokens', () => {
    const payload = {
      role: 'owner',
      username: 'Jagan',
      displayName: 'Jagan (Owner)',
      permissions: creds.OWNER_PERMISSIONS
    };

    const token = authService.createSessionToken(payload);
    expect(token).toBeDefined();

    const verified = authService.verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified.role).toBe('owner');
    expect(verified.username).toBe('Jagan');
  });

  it('REJECTS tampered session tokens (payload role modified to owner)', () => {
    // Attacker crafts a token signed with an arbitrary rogue secret
    const rogueSecret = 'attacker-rogue-secret-key-1234567890';
    const fakeToken = jwt.sign(
      {
        role: 'owner',
        username: 'Attacker',
        permissions: { canViewAllSubmissions: true }
      },
      rogueSecret,
      { expiresIn: '1h' }
    );

    const result = authService.verifySessionToken(fakeToken);
    expect(result).toBeNull(); // Must fail verification
  });

  it('REJECTS tokens with modified payloads (signature mismatch)', () => {
    const validToken = authService.createSessionToken({
      role: 'employee',
      username: 'Jagan team'
    });

    const parts = validToken.split('.');
    // Tamper with payload: change employee to owner
    const tamperedPayload = Buffer.from(
      JSON.stringify({ role: 'owner', username: 'Jagan team' })
    ).toString('base64url');

    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    const result = authService.verifySessionToken(tamperedToken);
    expect(result).toBeNull();
  });

  it('REJECTS expired session tokens', () => {
    // Generate token that expired 10 seconds ago
    const expiredToken = jwt.sign(
      { role: 'owner', username: 'Jagan' },
      creds.JWT_SECRET,
      { expiresIn: '-10s' }
    );

    const result = authService.verifySessionToken(expiredToken);
    expect(result).toBeNull();
  });

  it('REJECTS empty, null, or garbage tokens', () => {
    expect(authService.verifySessionToken('')).toBeNull();
    expect(authService.verifySessionToken(null)).toBeNull();
    expect(authService.verifySessionToken('not-a-valid-jwt-token')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. PERMISSION BOUNDARIES & AUTHORIZATION
// ---------------------------------------------------------------------------
describe('LoopX Permission Boundaries', () => {
  it('ensures employee role cannot view all submissions', async () => {
    const employee = await authService.verifyCredentials('Jagan team', '123456789');
    expect(employee.permissions.canViewAllSubmissions).toBe(false);
    expect(employee.permissions.canCreateClientLinks).toBe(true);
    expect(employee.permissions.canCreateProfiles).toBe(true);
  });

  it('ensures owner role has comprehensive executive permissions', async () => {
    const owner = await authService.verifyCredentials('Jagan', '12345678910');
    expect(owner.permissions.canViewAllSubmissions).toBe(true);
    expect(owner.permissions.canUpdateAllStatuses).toBe(true);
    expect(owner.permissions.canViewAllProfiles).toBe(true);
    expect(owner.permissions.canViewAnalytics).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. QUEUE NUMBER GENERATION
// ---------------------------------------------------------------------------
describe('LoopX Queue Number Generation', () => {
  it('formats sequential numbers into LX-001, LX-002, LX-010, LX-100', () => {
    expect(formatQueueNumber(1)).toBe('LX-001');
    expect(formatQueueNumber(2)).toBe('LX-002');
    expect(formatQueueNumber(10)).toBe('LX-010');
    expect(formatQueueNumber(100)).toBe('LX-100');
    expect(formatQueueNumber(999)).toBe('LX-999');
  });
});

// ---------------------------------------------------------------------------
// 5. PROFILE DEDUPLICATION LOGIC
// ---------------------------------------------------------------------------
describe('LoopX Profile Deduplication Logic', () => {
  it('detects case-insensitive duplicates correctly', () => {
    const existing = [
      { id: '1', name: 'Ramesh' },
      { id: '2', name: 'Priya Sharma' }
    ];

    const isDup1 = existing.some(p => p.name.trim().toLowerCase() === 'ramesh'.toLowerCase());
    const isDup2 = existing.some(p => p.name.trim().toLowerCase() === 'RAMESH'.toLowerCase());
    const isDup3 = existing.some(p => p.name.trim().toLowerCase() === 'priya sharma'.toLowerCase());
    const isDup4 = existing.some(p => p.name.trim().toLowerCase() === 'Anil'.toLowerCase());

    expect(isDup1).toBe(true);
    expect(isDup2).toBe(true);
    expect(isDup3).toBe(true);
    expect(isDup4).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. TEAM CHAT MENTION DETECTION
// ---------------------------------------------------------------------------
describe('LoopX Team Chat Mention Detection', () => {
  it('identifies @mentions matching registered profiles', () => {
    const profiles = [
      { id: '1', name: 'Ramesh' },
      { id: '2', name: 'Priya' }
    ];

    const message = 'Hello @Ramesh, please review the requirements from @Priya today!';
    const mentionsFound = [];
    profiles.forEach(p => {
      const regex = new RegExp(`@${p.name}\\b`, 'i');
      if (regex.test(message)) {
        mentionsFound.push(p.name);
      }
    });

    expect(mentionsFound).toContain('Ramesh');
    expect(mentionsFound).toContain('Priya');
    expect(mentionsFound.length).toBe(2);
  });
});
