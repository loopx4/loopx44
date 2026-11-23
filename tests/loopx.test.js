import { describe, it, expect, beforeEach } from 'vitest';
import { authenticateUser } from '../src/config/auth.config';
import { formatQueueNumber } from '../src/services/dataService';

describe('LoopX Authentication & Role Routing', () => {
  it('correctly authenticates owner credentials and returns owner role', () => {
    const res = authenticateUser('Jagan', '12345678910');
    expect(res.success).toBe(true);
    expect(res.role).toBe('owner');
    expect(res.permissions.canViewAllSubmissions).toBe(true);
  });

  it('correctly authenticates employee credentials and returns employee role', () => {
    const res = authenticateUser('Jagan team', '123456789');
    expect(res.success).toBe(true);
    expect(res.role).toBe('employee');
    expect(res.permissions.canViewAllSubmissions).toBe(false);
  });

  it('handles case-insensitive usernames gracefully', () => {
    const res = authenticateUser('jagan', '12345678910');
    expect(res.success).toBe(true);
    expect(res.role).toBe('owner');
  });

  it('rejects invalid password for owner', () => {
    const res = authenticateUser('Jagan', 'wrongpass');
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('rejects invalid username', () => {
    const res = authenticateUser('Stranger', '123456789');
    expect(res.success).toBe(false);
  });
});

describe('LoopX Queue Number Generation', () => {
  it('formats sequential numbers into LX-001, LX-002, LX-010, LX-100', () => {
    expect(formatQueueNumber(1)).toBe('LX-001');
    expect(formatQueueNumber(2)).toBe('LX-002');
    expect(formatQueueNumber(10)).toBe('LX-010');
    expect(formatQueueNumber(100)).toBe('LX-100');
    expect(formatQueueNumber(999)).toBe('LX-999');
  });
});

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

describe('LoopX Permission Boundaries', () => {
  it('ensures employee role cannot view all submissions', () => {
    const employee = authenticateUser('Jagan team', '123456789');
    expect(employee.permissions.canViewAllSubmissions).toBe(false);
    expect(employee.permissions.canCreateClientLinks).toBe(true);
  });

  it('ensures owner role has comprehensive executive permissions', () => {
    const owner = authenticateUser('Jagan', '12345678910');
    expect(owner.permissions.canViewAllSubmissions).toBe(true);
    expect(owner.permissions.canUpdateAllStatuses).toBe(true);
    expect(owner.permissions.canViewAnalytics).toBe(true);
  });
});

