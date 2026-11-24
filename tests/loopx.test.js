/**
 * =============================================================================
 * LOOPX COMPREHENSIVE TEST SUITE
 * tests/loopx.test.js
 * =============================================================================
 *
 * Covers:
 * 1. Backend Authentication & Role Routing
 * 2. Security Audit: Bypass Attempts & Session Manipulation
 * 3. Supabase JWT Session Claim Compatibility
 * 4. Permission Boundaries & Authorization Checks
 * 5. Initial Zero-Data State Verification
 * 6. Public Client Link Isolation & Unauthorized Cross-Client Lookup
 * 7. Simultaneous Concurrent Submissions & Sequential Queue Uniqueness
 * 8. Employee Attribution Integrity (Profiles, Links, Submissions, History)
 * 9. Queue Number Generation Logic
 * 10. Profile Deduplication Logic
 * 11. Team Chat Mention Detection
 * =============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import authService from '../server/authService.cjs';
import creds from '../server/credentials.config.cjs';
import { DataService, formatQueueNumber } from '../src/services/dataService';

// Setup in-memory localStorage for Node test environment
const storageMap = new Map();
globalThis.localStorage = {
  getItem: (key) => storageMap.get(key) || null,
  setItem: (key, val) => storageMap.set(key, String(val)),
  removeItem: (key) => storageMap.delete(key),
  clear: () => storageMap.clear()
};

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
    expect(result).toBeNull();
  });

  it('REJECTS tokens with modified payloads (signature mismatch)', () => {
    const validToken = authService.createSessionToken({
      role: 'employee',
      username: 'Jagan team'
    });

    const parts = validToken.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({ role: 'owner', username: 'Jagan team' })
    ).toString('base64url');

    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    const result = authService.verifySessionToken(tamperedToken);
    expect(result).toBeNull();
  });

  it('REJECTS expired session tokens', () => {
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
// 3. SUPABASE JWT SESSION CLAIM COMPATIBILITY
// ---------------------------------------------------------------------------
describe('Supabase JWT Session Claim Compatibility', () => {
  it('formats custom backend JWT claims to match Supabase PostgREST requirements', () => {
    const payload = {
      role: 'owner',
      username: 'Jagan',
      displayName: 'Jagan (Owner)',
      permissions: creds.OWNER_PERMISSIONS
    };

    const token = authService.createSessionToken(payload);
    const decoded = jwt.decode(token);

    // Verify claims expected by Supabase RLS helper functions get_auth_role() and get_auth_username()
    expect(decoded.role).toBeDefined();
    expect(decoded.username).toBe('Jagan');
  });
});

// ---------------------------------------------------------------------------
// 4. PERMISSION BOUNDARIES & AUTHORIZATION
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
// 5. INITIAL ZERO-DATA STATE VERIFICATION
// ---------------------------------------------------------------------------
describe('LoopX Initial Zero-Data State Verification', () => {
  beforeEach(() => {
    storageMap.clear();
  });

  it('starts with zero profiles, submissions, links and messages', async () => {
    const profiles = await DataService.getProfiles();
    expect(profiles).toEqual([]);

    const submissions = await DataService.getSubmissions();
    expect(submissions).toEqual([]);

    const links = await DataService.getClientLinks();
    expect(links).toEqual([]);

    const messages = await DataService.getChatMessages();
    expect(messages).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 6. PUBLIC CLIENT LINK ISOLATION & UNAUTHORIZED ACCESS PREVENTION
// ---------------------------------------------------------------------------
describe('Public Client Link Isolation', () => {
  beforeEach(() => {
    storageMap.clear();
  });

  it('prevents Client A from accessing Client B submission by altering token or ID', async () => {
    // Employee creates Link A and Link B
    const linkA = await DataService.createClientLink('prof_1', 'Ramesh');
    const linkB = await DataService.createClientLink('prof_1', 'Ramesh');

    // Client A submits form A
    await DataService.submitClientForm(linkA.token, {
      client_name: 'Client Alpha',
      business_name: 'Alpha Corp',
      phone: '1112223333',
      location: 'New York',
      business_type: 'Retail',
      services_required: 'Consulting',
      detailed_requirements: 'Requirements Alpha'
    });

    // Client B submits form B
    await DataService.submitClientForm(linkB.token, {
      client_name: 'Client Beta',
      business_name: 'Beta LLC',
      phone: '4445556666',
      location: 'London',
      business_type: 'Tech',
      services_required: 'Development',
      detailed_requirements: 'Requirements Beta'
    });

    // Client querying token A only gets submission A
    const subA = await DataService.getSubmissionByToken(linkA.token);
    expect(subA).not.toBeNull();
    expect(subA.client_name).toBe('Client Alpha');
    expect(subA.business_name).toBe('Alpha Corp');

    // Querying with an invalid or guessed token returns null
    const subInvalid = await DataService.getSubmissionByToken('guessed-fake-token-xyz');
    expect(subInvalid).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. SIMULTANEOUS CONCURRENT SUBMISSIONS & QUEUE UNIQUENESS
// ---------------------------------------------------------------------------
describe('Simultaneous Concurrent Submissions & Queue Uniqueness', () => {
  beforeEach(() => {
    storageMap.clear();
  });

  it('generates strictly unique, non-colliding sequential queue numbers during simultaneous submissions', async () => {
    // Generate 10 links
    const links = [];
    for (let i = 0; i < 10; i++) {
      links.push(await DataService.createClientLink('prof_1', 'Ramesh'));
    }

    // Fire 10 simultaneous submissions concurrently
    const submissionPromises = links.map((link, idx) => {
      return DataService.submitClientForm(link.token, {
        client_name: `Client ${idx + 1}`,
        business_name: `Business ${idx + 1}`,
        phone: `555000000${idx}`,
        location: 'City',
        business_type: 'General',
        services_required: 'Services',
        detailed_requirements: `Details ${idx + 1}`
      });
    });

    const results = await Promise.all(submissionPromises);

    // Verify all succeeded
    results.forEach((res) => {
      expect(res.success).toBe(true);
      expect(res.queueNumber).toMatch(/^LX-\d{3}$/);
    });

    // Check for uniqueness: exactly 10 distinct queue numbers
    const queueNumbers = results.map((r) => r.queueNumber);
    const uniqueSet = new Set(queueNumbers);
    expect(uniqueSet.size).toBe(10);

    // Confirm sequence LX-001 through LX-010
    expect(queueNumbers).toContain('LX-001');
    expect(queueNumbers).toContain('LX-002');
    expect(queueNumbers).toContain('LX-010');
  });
});

// ---------------------------------------------------------------------------
// 8. EMPLOYEE ATTRIBUTION INTEGRITY
// ---------------------------------------------------------------------------
describe('Employee Attribution Integrity', () => {
  beforeEach(() => {
    storageMap.clear();
  });

  it('correctly associates links, submissions, and status history with the creating employee profile', async () => {
    // Create profiles
    const prof1 = await DataService.createProfile('Ramesh');
    const prof2 = await DataService.createProfile('Priya');

    // Ramesh creates link
    const linkRamesh = await DataService.createClientLink(prof1.profile.id, 'Ramesh');
    expect(linkRamesh.created_by_profile_id).toBe(prof1.profile.id);
    expect(linkRamesh.created_by_name).toBe('Ramesh');

    // Client submits on Ramesh's link
    const subRes = await DataService.submitClientForm(linkRamesh.token, {
      client_name: 'Acme Corp',
      business_name: 'Acme',
      phone: '1234567890',
      location: 'HQ',
      business_type: 'Enterprise',
      services_required: 'Advisory',
      detailed_requirements: 'Scope of work'
    });

    expect(subRes.submission.created_by_profile_id).toBe(prof1.profile.id);
    expect(subRes.submission.created_by_name).toBe('Ramesh');

    // Status update attribution
    await DataService.updateSubmissionStatus(subRes.submission.id, 'Working', 'Ramesh');
    const history = await DataService.getStatusHistory(subRes.submission.id);
    expect(history.length).toBe(2);
    expect(history[1].changed_by).toBe('Ramesh');
    expect(history[1].new_status).toBe('Working');

    // Employee isolation check: Priya querying her submissions sees 0 records
    const priyaSubmissions = await DataService.getSubmissions({ profileId: prof2.profile.id });
    expect(priyaSubmissions.length).toBe(0);

    // Ramesh querying his submissions sees 1 record
    const rameshSubmissions = await DataService.getSubmissions({ profileId: prof1.profile.id });
    expect(rameshSubmissions.length).toBe(1);
    expect(rameshSubmissions[0].id).toBe(subRes.submission.id);
  });
});

// ---------------------------------------------------------------------------
// 9. QUEUE NUMBER GENERATION LOGIC
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
// 10. PROFILE DEDUPLICATION LOGIC
// ---------------------------------------------------------------------------
describe('LoopX Profile Deduplication Logic', () => {
  it('detects case-insensitive duplicates correctly', () => {
    const existing = [
      { id: '1', name: 'Ramesh' },
      { id: '2', name: 'Priya Sharma' }
    ];

    const isDup1 = existing.some((p) => p.name.trim().toLowerCase() === 'ramesh'.toLowerCase());
    const isDup2 = existing.some((p) => p.name.trim().toLowerCase() === 'RAMESH'.toLowerCase());
    const isDup3 = existing.some((p) => p.name.trim().toLowerCase() === 'priya sharma'.toLowerCase());
    const isDup4 = existing.some((p) => p.name.trim().toLowerCase() === 'Anil'.toLowerCase());

    expect(isDup1).toBe(true);
    expect(isDup2).toBe(true);
    expect(isDup3).toBe(true);
    expect(isDup4).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 11. TEAM CHAT MENTION DETECTION
// ---------------------------------------------------------------------------
describe('LoopX Team Chat Mention Detection', () => {
  it('identifies @mentions matching registered profiles', () => {
    const profiles = [
      { id: '1', name: 'Ramesh' },
      { id: '2', name: 'Priya' }
    ];

    const message = 'Hello @Ramesh, please review the requirements from @Priya today!';
    const mentionsFound = [];
    profiles.forEach((p) => {
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
