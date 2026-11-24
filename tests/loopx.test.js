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

// ---------------------------------------------------------------------------
// 12. SHARED QUESTIONNAIRE & GOOGLE-FORMS BUILDER
// ---------------------------------------------------------------------------
describe('Shared Questionnaire & Google-Forms Builder', () => {
  beforeEach(() => {
    storageMap.clear();
  });

  it('loads default LoopX intake questionnaire covering all 9 required types', async () => {
    const config = await DataService.getFormConfig();
    expect(config).toBeDefined();
    expect(config.questions.length).toBeGreaterThanOrEqual(10);

    const types = config.questions.map((q) => q.question_type);
    expect(types).toContain('short_answer');
    expect(types).toContain('long_answer');
    expect(types).toContain('multiple_choice');
    expect(types).toContain('checkboxes');
    expect(types).toContain('dropdown');
    expect(types).toContain('phone');
    expect(types).toContain('email');
    expect(types).toContain('date');
    expect(types).toContain('file_upload');
  });

  it('allows adding, editing, reordering, and deleting questions with options', async () => {
    const config = await DataService.getFormConfig();
    const initialQuestions = [...config.questions];

    // 1. Add a custom question with options
    const customQuestion = {
      id: 'q_custom_budget',
      label: 'Estimated Budget Window',
      description: 'Select your project investment tier',
      question_type: 'dropdown',
      options: ['Under $10,000', '$10,000 - $50,000', 'Enterprise ($50,000+)'],
      is_required: true,
      order_index: initialQuestions.length
    };
    initialQuestions.push(customQuestion);

    // 2. Edit an existing question
    initialQuestions[0].label = 'Primary Contact Full Legal Name';

    // 3. Reorder: move the newly added question to the top (order_index 0)
    const reordered = [customQuestion, ...initialQuestions.filter((q) => q.id !== customQuestion.id)];

    // 4. Delete one question
    const afterDelete = reordered.filter((q) => q.id !== 'q_notes');

    // 5. Save the updated configuration
    const saveRes = await DataService.saveFormConfig({
      title: 'Customized LoopX Intake Form',
      description: 'Updated questions for client onboarding',
      questions: afterDelete,
      author: 'Ramesh'
    });
    expect(saveRes.success).toBe(true);

    // 6. Verify shared persistence across all employees
    const savedConfig = await DataService.getFormConfig();
    expect(savedConfig.title).toBe('Customized LoopX Intake Form');
    expect(savedConfig.questions[0].label).toBe('Estimated Budget Window');
    expect(savedConfig.questions[0].options).toEqual(['Under $10,000', '$10,000 - $50,000', 'Enterprise ($50,000+)']);
    expect(savedConfig.questions.find((q) => q.id === 'q_notes')).toBeUndefined();
  });

  it('generates a client link with the form snapshot and accepts dynamic client submission', async () => {
    // 1. Setup custom questions
    const testQuestions = [
      { id: 'q_name', label: 'Client Name', question_type: 'short_answer', is_required: true, order_index: 0 },
      { id: 'q_biz', label: 'Company Name', question_type: 'short_answer', is_required: true, order_index: 1 },
      { id: 'q_contact', label: 'Phone', question_type: 'phone', is_required: true, order_index: 2 },
      { id: 'q_tier', label: 'Selected Plan', question_type: 'dropdown', options: ['Tier A', 'Tier B'], is_required: true, order_index: 3 },
      { id: 'q_addons', label: 'Add-on Features', question_type: 'checkboxes', options: ['Security Pack', '24/7 SLA'], is_required: false, order_index: 4 },
      { id: 'q_launch', label: 'Target Launch Date', question_type: 'date', is_required: false, order_index: 5 }
    ];

    // 2. Create link with this form snapshot
    const link = await DataService.createClientLink('prof_emp1', 'Ramesh', testQuestions);
    expect(link.token).toBeDefined();
    expect(link.form_snapshot.length).toBe(6);

    // 3. Client opens link by token and verifies exact questions snapshot
    const fetchedLink = await DataService.getClientLinkByToken(link.token);
    expect(fetchedLink.form_snapshot[3].label).toBe('Selected Plan');
    expect(fetchedLink.form_snapshot[3].options).toContain('Tier A');

    // 4. Client fills and submits the form
    const clientSubmissionData = {
      responses: {
        'Client Name': 'Alice Cooper',
        'Company Name': 'Alice Wonderland Tech',
        'Phone': '+15551234567',
        'Selected Plan': 'Tier B',
        'Add-on Features': ['Security Pack', '24/7 SLA'],
        'Target Launch Date': '2026-12-01'
      }
    };

    const submitRes = await DataService.submitClientForm(link.token, clientSubmissionData, [
      { name: 'architecture_diagram.png', size: 245000, type: 'image/png', storagePath: `${link.token}/diagram.png` }
    ]);

    expect(submitRes.success).toBe(true);
    expect(submitRes.queueNumber).toBe('LX-001');
    expect(submitRes.submission.client_name).toBe('Alice Cooper');
    expect(submitRes.submission.business_name).toBe('Alice Wonderland Tech');
    expect(submitRes.submission.responses['Selected Plan']).toBe('Tier B');
    expect(submitRes.submission.responses['Add-on Features']).toEqual(['Security Pack', '24/7 SLA']);
    expect(submitRes.submission.files.length).toBe(1);

    // 5. Reopening the link shows read-only locked status
    const verifiedLink = await DataService.getClientLinkByToken(link.token);
    expect(verifiedLink.status).toBe('submitted');

    const readOnlySub = await DataService.getSubmissionByToken(link.token);
    expect(readOnlySub).not.toBeNull();
    expect(readOnlySub.queue_number).toBe('LX-001');

    // 6. Duplicate submission through the same link is strictly rejected
    const duplicateRes = await DataService.submitClientForm(link.token, clientSubmissionData);
    expect(duplicateRes.success).toBe(false);
    expect(duplicateRes.error).toContain('already been submitted');
  });
});

// ---------------------------------------------------------------------------
// 13. STORAGE LIMIT ENFORCEMENT (5 MB INDIVIDUAL, 30 MB COMBINED)
// ---------------------------------------------------------------------------
describe('LoopX Storage Limit Enforcement', () => {
  beforeEach(() => {
    storageMap.clear();
  });

  it('enforces 5MB individual file limit', () => {
    const validFile = { name: 'spec.pdf', size: 4.8 * 1024 * 1024 }; // 4.8 MB
    const oversizedFile = { name: 'huge_video.mp4', size: 5.2 * 1024 * 1024 }; // 5.2 MB

    expect(validFile.size <= 5 * 1024 * 1024).toBe(true);
    expect(oversizedFile.size > 5 * 1024 * 1024).toBe(true);
  });

  it('enforces 30MB combined file limit per submission', () => {
    const validFiles = [
      { name: 'doc1.pdf', size: 4.5 * 1024 * 1024 },
      { name: 'doc2.pdf', size: 4.5 * 1024 * 1024 },
      { name: 'doc3.pdf', size: 4.5 * 1024 * 1024 },
      { name: 'doc4.pdf', size: 4.5 * 1024 * 1024 }
    ];
    const totalValid = validFiles.reduce((acc, f) => acc + f.size, 0);
    expect(totalValid <= 30 * 1024 * 1024).toBe(true);

    const excessiveFiles = [
      { name: 'doc1.pdf', size: 5 * 1024 * 1024 },
      { name: 'doc2.pdf', size: 5 * 1024 * 1024 },
      { name: 'doc3.pdf', size: 5 * 1024 * 1024 },
      { name: 'doc4.pdf', size: 5 * 1024 * 1024 },
      { name: 'doc5.pdf', size: 5 * 1024 * 1024 },
      { name: 'doc6.pdf', size: 5 * 1024 * 1024 },
      { name: 'doc7.pdf', size: 5 * 1024 * 1024 } // Total 35 MB
    ];
    const totalExcessive = excessiveFiles.reduce((acc, f) => acc + f.size, 0);
    expect(totalExcessive > 30 * 1024 * 1024).toBe(true);
  });

  it('rejects submission at service layer if an individual file exceeds 5MB', async () => {
    const link = await DataService.createClientLink('prof_limit', 'Tester');
    const oversizedFiles = [
      { name: 'large_raw_video.mov', size: 6 * 1024 * 1024 } // 6 MB
    ];

    const res = await DataService.submitClientForm(link.token, {
      responses: { 'Client Name': 'Limit Test' }
    }, oversizedFiles);

    expect(res.success).toBe(false);
    expect(res.error).toContain('5 MB individual limit');
  });

  it('rejects submission at service layer if combined files exceed 30MB', async () => {
    const link = await DataService.createClientLink('prof_limit2', 'Tester');
    const excessiveFiles = [
      { name: 'part1.zip', size: 5 * 1024 * 1024 },
      { name: 'part2.zip', size: 5 * 1024 * 1024 },
      { name: 'part3.zip', size: 5 * 1024 * 1024 },
      { name: 'part4.zip', size: 5 * 1024 * 1024 },
      { name: 'part5.zip', size: 5 * 1024 * 1024 },
      { name: 'part6.zip', size: 5 * 1024 * 1024 },
      { name: 'part7.zip', size: 2 * 1024 * 1024 } // Total 32 MB
    ];

    const res = await DataService.submitClientForm(link.token, {
      responses: { 'Client Name': 'Limit Test 2' }
    }, excessiveFiles);

    expect(res.success).toBe(false);
    expect(res.error).toContain('30 MB maximum limit');
  });
});

// ---------------------------------------------------------------------------
// 14. EMPLOYEE PROFILE MANAGEMENT (EDIT & DELETE)
// ---------------------------------------------------------------------------
describe('Employee Profile Management (Edit & Delete)', () => {
  beforeEach(() => {
    storageMap.clear();
  });

  it('allows renaming a profile with case-insensitive deduplication check', async () => {
    const p1 = await DataService.createProfile('Ramesh Kumar');
    const p2 = await DataService.createProfile('Priya Sharma');
    expect(p1.success).toBe(true);
    expect(p2.success).toBe(true);

    // Rename p1 to something new
    const renameRes = await DataService.updateProfile(p1.profile.id, 'Ramesh K.');
    expect(renameRes.success).toBe(true);
    expect(renameRes.profile.name).toBe('Ramesh K.');

    // Attempt to rename p1 to Priya Sharma (should fail due to duplicate)
    const dupRes = await DataService.updateProfile(p1.profile.id, 'priya sharma');
    expect(dupRes.success).toBe(false);
    expect(dupRes.error).toContain('already exists');
  });

  it('allows deleting an employee profile', async () => {
    const p1 = await DataService.createProfile('Anil Kapoor');
    const p2 = await DataService.createProfile('Sunita Rao');

    let all = await DataService.getProfiles();
    expect(all.length).toBe(2);

    const delRes = await DataService.deleteProfile(p1.profile.id);
    expect(delRes.success).toBe(true);

    all = await DataService.getProfiles();
    expect(all.length).toBe(1);
    expect(all[0].name).toBe('Sunita Rao');
  });
});

// ---------------------------------------------------------------------------
// 15. SCALABLE SHARED EMPLOYEE MANAGEMENT (>10 EMPLOYEES)
// ---------------------------------------------------------------------------
describe('Scalable Shared Employee Management (>10 Employees)', () => {
  beforeEach(() => {
    storageMap.clear();
  });

  it('supports creating and managing >10 employee profiles seamlessly with total isolation', async () => {
    const names = [
      'Emp One', 'Emp Two', 'Emp Three', 'Emp Four', 'Emp Five',
      'Emp Six', 'Emp Seven', 'Emp Eight', 'Emp Nine', 'Emp Ten',
      'Emp Eleven', 'Emp Twelve', 'Emp Thirteen', 'Emp Fourteen', 'Emp Fifteen'
    ];

    for (const name of names) {
      const res = await DataService.createProfile(name);
      expect(res.success).toBe(true);
    }

    const allProfiles = await DataService.getProfiles();
    expect(allProfiles.length).toBe(15);

    // Create client links for two different profiles beyond the 10th
    const link11 = await DataService.createClientLink(allProfiles[10].id, allProfiles[10].name);
    const link14 = await DataService.createClientLink(allProfiles[13].id, allProfiles[13].name);

    // Verify profile attribution isolation
    const emp11Links = await DataService.getClientLinks(allProfiles[10].id);
    const emp14Links = await DataService.getClientLinks(allProfiles[13].id);

    expect(emp11Links.length).toBe(1);
    expect(emp11Links[0].token).toBe(link11.token);
    expect(emp14Links.length).toBe(1);
    expect(emp14Links[0].token).toBe(link14.token);
  });
});

// ---------------------------------------------------------------------------
// 16. CLIENT LINK DELETION
// ---------------------------------------------------------------------------
describe('Client Link Deletion', () => {
  beforeEach(() => {
    storageMap.clear();
  });

  it('allows deleting an unsubmitted or stale client link', async () => {
    const link = await DataService.createClientLink('prof_test', 'Tester');
    let links = await DataService.getClientLinks();
    expect(links.length).toBe(1);

    const delRes = await DataService.deleteClientLink(link.id);
    expect(delRes.success).toBe(true);

    links = await DataService.getClientLinks();
    expect(links.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 17. CLIENT SUBMISSION EDIT & DELETE
// ---------------------------------------------------------------------------
describe('Client Submission Edit & Delete', () => {
  beforeEach(() => {
    storageMap.clear();
  });

  it('allows updating client details on an existing submission', async () => {
    const link = await DataService.createClientLink('prof_edit', 'Tester');
    const subRes = await DataService.submitClientForm(link.token, {
      responses: {
        'Client Full Name': 'Original Name',
        'Business / Organisation Name': 'Original Corp',
        'Business Location': 'New York, USA'
      }
    });

    expect(subRes.success).toBe(true);
    const subId = subRes.submission.id;

    // Update details
    const updated = await DataService.updateSubmissionDetails(subId, {
      client_name: 'Updated Name',
      business_name: 'Updated Corp Inc',
      location: 'San Francisco, USA'
    }, 'Jagan (Owner)');

    expect(updated.client_name).toBe('Updated Name');
    expect(updated.business_name).toBe('Updated Corp Inc');
    expect(updated.location).toBe('San Francisco, USA');
    expect(updated.updated_by).toBe('Jagan (Owner)');
  });

  it('allows deleting a client submission and cascades to associated records', async () => {
    const link = await DataService.createClientLink('prof_del', 'Tester');
    const subRes = await DataService.submitClientForm(link.token, {
      responses: {
        'Client Full Name': 'To Be Deleted',
        'Business / Organisation Name': 'Delete Corp'
      }
    }, [
      { name: 'file1.pdf', size: 120000, storagePath: `${link.token}/file1.pdf` }
    ]);

    expect(subRes.success).toBe(true);
    let subs = await DataService.getSubmissions();
    expect(subs.length).toBe(1);

    const delRes = await DataService.deleteSubmission(subRes.submission.id);
    expect(delRes.success).toBe(true);

    subs = await DataService.getSubmissions();
    expect(subs.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 18. SUBMISSION FILE DELETION & STORAGE USAGE METRICS
// ---------------------------------------------------------------------------
describe('Submission File Deletion & Owner Storage Statistics', () => {
  beforeEach(() => {
    storageMap.clear();
  });

  it('deletes an individual file from a submission and accurately updates storage stats', async () => {
    const link = await DataService.createClientLink('prof_storage', 'Tester');
    const subRes = await DataService.submitClientForm(link.token, {
      responses: {
        'Client Full Name': 'Storage Client',
        'Business / Organisation Name': 'Storage Corp'
      }
    }, [
      { name: 'docA.pdf', size: 2 * 1024 * 1024, storagePath: `${link.token}/docA.pdf` },
      { name: 'docB.pdf', size: 3 * 1024 * 1024, storagePath: `${link.token}/docB.pdf` }
    ]);

    expect(subRes.success).toBe(true);

    // Initial stats: 5 MB used
    let stats = await DataService.getStorageStats();
    expect(stats.totalFileCount).toBe(2);
    expect(stats.usedBytes).toBe(5 * 1024 * 1024);
    expect(stats.totalCapacityBytes).toBe(1024 * 1024 * 1024); // 1 GB
    expect(stats.availableBytes).toBe(1024 * 1024 * 1024 - 5 * 1024 * 1024);

    // Delete docA.pdf
    const delFileRes = await DataService.deleteSubmissionFile(subRes.submission.id, 'docA.pdf');
    expect(delFileRes.success).toBe(true);
    expect(delFileRes.updatedFiles.length).toBe(1);
    expect(delFileRes.updatedFiles[0].name).toBe('docB.pdf');

    // Updated stats: 3 MB used
    stats = await DataService.getStorageStats();
    expect(stats.totalFileCount).toBe(1);
    expect(stats.usedBytes).toBe(3 * 1024 * 1024);
  });
});

// ---------------------------------------------------------------------------
// 19. TEAM CHAT MESSAGE EDIT & DELETE
// ---------------------------------------------------------------------------
describe('Team Chat Message Edit & Delete', () => {
  beforeEach(() => {
    storageMap.clear();
  });

  it('allows editing an existing chat message', async () => {
    const msg = await DataService.sendChatMessage({
      senderName: 'Ramesh',
      senderRole: 'employee',
      message: 'Initial draft message'
    });

    expect(msg.message).toBe('Initial draft message');

    const edited = await DataService.editChatMessage(msg.id, 'Updated clear message');
    expect(edited.message).toBe('Updated clear message');
    expect(edited.is_edited).toBe(true);

    const allMsgs = await DataService.getChatMessages();
    expect(allMsgs[0].message).toBe('Updated clear message');
    expect(allMsgs[0].is_edited).toBe(true);
  });

  it('allows deleting a chat message', async () => {
    const msg = await DataService.sendChatMessage({
      senderName: 'Ramesh',
      senderRole: 'employee',
      message: 'Accidental message'
    });

    let msgs = await DataService.getChatMessages();
    expect(msgs.length).toBe(1);

    const delRes = await DataService.deleteChatMessage(msg.id);
    expect(delRes.success).toBe(true);

    msgs = await DataService.getChatMessages();
    expect(msgs.length).toBe(0);
  });
});
