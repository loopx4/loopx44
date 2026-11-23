/**
 * =============================================================================
 * LOOPX UNIFIED DATA SERVICE
 * =============================================================================
 * Handles all database operations for:
 * - Employee profiles (with case-insensitive duplicate prevention)
 * - Client private links (cryptographically random tokens)
 * - Client form submissions (unique atomic sequential LX-001 queue numbering)
 * - Submission files & status audit history
 * - Team discussion / chat with real-time updates & mentions
 * 
 * Works seamlessly with Supabase when configured, or local fallback storage
 * when awaiting initial Supabase connection.
 * =============================================================================
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';

const STORAGE_KEYS = {
  PROFILES: 'loopx_employee_profiles',
  LINKS: 'loopx_client_links',
  SUBMISSIONS: 'loopx_client_submissions',
  STATUS_HISTORY: 'loopx_status_history',
  CHAT_MESSAGES: 'loopx_chat_messages',
  QUEUE_COUNTER: 'loopx_queue_counter'
};

// Safe Local Storage Helpers
function getLocalItem(key, defaultValue) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : defaultValue;
  } catch (err) {
    console.error(`Error reading ${key} from storage:`, err);
    return defaultValue;
  }
}

function setLocalItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error writing ${key} to storage:`, err);
  }
}

// Generate Next Sequential Queue Number (e.g. LX-001, LX-002)
export function formatQueueNumber(seq) {
  return `LX-${String(seq).padStart(3, '0')}`;
}

export const DataService = {
  // ---------------------------------------------------------------------------
  // 1. EMPLOYEE PROFILES
  // ---------------------------------------------------------------------------
  async getProfiles() {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('employee_profiles')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
    // Local storage (Initially empty array [])
    return getLocalItem(STORAGE_KEYS.PROFILES, []);
  },

  async createProfile(name) {
    const cleanName = (name || '').trim();
    if (!cleanName) {
      return { success: false, error: 'Profile name cannot be empty.' };
    }

    // Check existing profiles for case-insensitive duplicates
    const existing = await this.getProfiles();
    const isDuplicate = existing.some(
      (p) => p.name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (isDuplicate) {
      return {
        success: false,
        error: `A profile named "${cleanName}" already exists (names are case-insensitive).`
      };
    }

    const newProfile = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'prof_' + Date.now(),
      name: cleanName,
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('employee_profiles')
        .insert([{ id: newProfile.id, name: newProfile.name }])
        .select()
        .single();
      if (error) return { success: false, error: error.message };
      return { success: true, profile: data };
    }

    const updated = [...existing, newProfile];
    setLocalItem(STORAGE_KEYS.PROFILES, updated);
    return { success: true, profile: newProfile };
  },

  // ---------------------------------------------------------------------------
  // 2. CLIENT PRIVATE LINKS
  // ---------------------------------------------------------------------------
  async createClientLink(profileId, profileName) {
    // Generate secure unpredictable random token
    const token = crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : (
      Math.random().toString(36).substring(2) + Date.now().toString(36)
    );

    const linkRecord = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'link_' + Date.now(),
      token: token,
      created_by_profile_id: profileId,
      created_by_name: profileName,
      status: 'created', // 'created' | 'submitted'
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('client_links')
        .insert([linkRecord])
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const existingLinks = getLocalItem(STORAGE_KEYS.LINKS, []);
    existingLinks.unshift(linkRecord);
    setLocalItem(STORAGE_KEYS.LINKS, existingLinks);
    return linkRecord;
  },

  async getClientLinkByToken(token) {
    if (!token) return null;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('client_links')
        .select('*')
        .eq('token', token)
        .single();
      if (error) return null;
      return data;
    }

    const existingLinks = getLocalItem(STORAGE_KEYS.LINKS, []);
    return existingLinks.find((l) => l.token === token) || null;
  },

  // ---------------------------------------------------------------------------
  // 3. CLIENT FORM SUBMISSIONS & QUEUE NUMBER GENERATION
  // ---------------------------------------------------------------------------
  async submitClientForm(token, formData, files = []) {
    // 1. Verify link exists and has not been submitted yet
    const link = await this.getClientLinkByToken(token);
    if (!link) {
      return { success: false, error: 'Invalid or expired client link.' };
    }

    if (link.status === 'submitted') {
      return {
        success: false,
        error: 'This link has already been submitted. Reopening in read-only mode.'
      };
    }

    // 2. Generate atomic sequential queue number (LX-001, LX-002, ...)
    let queueNumber = '';
    let submissionRecord = null;

    if (isSupabaseConfigured && supabase) {
      // Supabase RPC for atomic queue number generation or direct insert
      const { data: qData, error: qErr } = await supabase.rpc('get_next_queue_number');
      if (qErr || !qData) {
        throw new Error('Failed to generate atomic queue number: ' + (qErr?.message || 'Unknown error'));
      }
      queueNumber = qData;

      const submissionPayload = {
        link_id: link.id,
        link_token: token,
        queue_number: queueNumber,
        client_name: formData.client_name,
        business_name: formData.business_name,
        phone: formData.phone,
        email: formData.email || '',
        location: formData.location,
        business_type: formData.business_type,
        services_required: formData.services_required,
        detailed_requirements: formData.detailed_requirements,
        additional_info: formData.additional_info || '',
        current_status: 'Pending',
        created_by_profile_id: link.created_by_profile_id,
        created_by_name: link.created_by_name,
        submitted_at: new Date().toISOString(),
        files: files
      };

      const { data: subData, error: subErr } = await supabase
        .from('client_submissions')
        .insert([submissionPayload])
        .select()
        .single();

      if (subErr) throw subErr;

      // Update link status to 'submitted'
      await supabase
        .from('client_links')
        .update({ status: 'submitted', queue_number: queueNumber })
        .eq('id', link.id);

      // Audit status history
      await supabase.from('status_history').insert([{
        submission_id: subData.id,
        old_status: null,
        new_status: 'Pending',
        changed_by: 'Client Submission',
        changed_at: new Date().toISOString()
      }]);

      return { success: true, submission: subData, queueNumber };
    }

    // Local Fallback Atomic Queue Generation
    const allSubs = getLocalItem(STORAGE_KEYS.SUBMISSIONS, []);
    let currentCounter = getLocalItem(STORAGE_KEYS.QUEUE_COUNTER, 0);
    currentCounter += 1;
    setLocalItem(STORAGE_KEYS.QUEUE_COUNTER, currentCounter);
    queueNumber = formatQueueNumber(currentCounter);

    // Ensure queue number never duplicates
    while (allSubs.some((s) => s.queue_number === queueNumber)) {
      currentCounter += 1;
      setLocalItem(STORAGE_KEYS.QUEUE_COUNTER, currentCounter);
      queueNumber = formatQueueNumber(currentCounter);
    }

    submissionRecord = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'sub_' + Date.now(),
      link_id: link.id,
      link_token: token,
      queue_number: queueNumber,
      client_name: formData.client_name,
      business_name: formData.business_name,
      phone: formData.phone,
      email: formData.email || '',
      location: formData.location,
      business_type: formData.business_type,
      services_required: formData.services_required,
      detailed_requirements: formData.detailed_requirements,
      additional_info: formData.additional_info || '',
      current_status: 'Pending',
      created_by_profile_id: link.created_by_profile_id,
      created_by_name: link.created_by_name,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: 'Client Submission',
      files: files
    };

    allSubs.unshift(submissionRecord);
    setLocalItem(STORAGE_KEYS.SUBMISSIONS, allSubs);

    // Update link status
    const allLinks = getLocalItem(STORAGE_KEYS.LINKS, []);
    const linkIdx = allLinks.findIndex((l) => l.id === link.id);
    if (linkIdx !== -1) {
      allLinks[linkIdx].status = 'submitted';
      allLinks[linkIdx].queue_number = queueNumber;
      setLocalItem(STORAGE_KEYS.LINKS, allLinks);
    }

    // Append to status history
    const allHistory = getLocalItem(STORAGE_KEYS.STATUS_HISTORY, []);
    allHistory.push({
      id: crypto.randomUUID ? crypto.randomUUID() : 'hist_' + Date.now(),
      submission_id: submissionRecord.id,
      old_status: null,
      new_status: 'Pending',
      changed_by: 'Client Submission',
      changed_at: new Date().toISOString()
    });
    setLocalItem(STORAGE_KEYS.STATUS_HISTORY, allHistory);

    return { success: true, submission: submissionRecord, queueNumber };
  },

  async getSubmissionByToken(token) {
    if (!token) return null;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('client_submissions')
        .select('*')
        .eq('link_token', token)
        .single();
      if (error) return null;
      return data;
    }

    const allSubs = getLocalItem(STORAGE_KEYS.SUBMISSIONS, []);
    return allSubs.find((s) => s.link_token === token) || null;
  },

  async getSubmissions({ profileId = null, status = null } = {}) {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('client_submissions').select('*').order('submitted_at', { ascending: false });
      if (profileId) {
        query = query.eq('created_by_profile_id', profileId);
      }
      if (status && status !== 'Total') {
        query = query.eq('current_status', status);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }

    let allSubs = getLocalItem(STORAGE_KEYS.SUBMISSIONS, []);
    if (profileId) {
      allSubs = allSubs.filter((s) => s.created_by_profile_id === profileId);
    }
    if (status && status !== 'Total') {
      allSubs = allSubs.filter((s) => s.current_status === status);
    }
    return allSubs;
  },

  async updateSubmissionStatus(submissionId, newStatus, changedByName) {
    if (!['Pending', 'Working', 'Completed'].includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    const nowIso = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      // Fetch current status for history
      const { data: curr } = await supabase
        .from('client_submissions')
        .select('current_status')
        .eq('id', submissionId)
        .single();

      const oldStatus = curr ? curr.current_status : null;

      const { data, error } = await supabase
        .from('client_submissions')
        .update({
          current_status: newStatus,
          updated_at: nowIso,
          updated_by: changedByName
        })
        .eq('id', submissionId)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('status_history').insert([{
        submission_id: submissionId,
        old_status: oldStatus,
        new_status: newStatus,
        changed_by: changedByName,
        changed_at: nowIso
      }]);

      return data;
    }

    const allSubs = getLocalItem(STORAGE_KEYS.SUBMISSIONS, []);
    const idx = allSubs.findIndex((s) => s.id === submissionId);
    if (idx === -1) throw new Error('Submission not found.');

    const oldStatus = allSubs[idx].current_status;
    allSubs[idx].current_status = newStatus;
    allSubs[idx].updated_at = nowIso;
    allSubs[idx].updated_by = changedByName;
    setLocalItem(STORAGE_KEYS.SUBMISSIONS, allSubs);

    const allHistory = getLocalItem(STORAGE_KEYS.STATUS_HISTORY, []);
    allHistory.push({
      id: crypto.randomUUID ? crypto.randomUUID() : 'hist_' + Date.now(),
      submission_id: submissionId,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: changedByName,
      changed_at: nowIso
    });
    setLocalItem(STORAGE_KEYS.STATUS_HISTORY, allHistory);

    return allSubs[idx];
  },

  async getStatusHistory(submissionId) {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('status_history')
        .select('*')
        .eq('submission_id', submissionId)
        .order('changed_at', { ascending: true });
      if (error) return [];
      return data || [];
    }

    const allHistory = getLocalItem(STORAGE_KEYS.STATUS_HISTORY, []);
    return allHistory.filter((h) => h.submission_id === submissionId);
  },

  // ---------------------------------------------------------------------------
  // 4. TEAM DISCUSSION / CHAT
  // ---------------------------------------------------------------------------
  async getChatMessages() {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('team_messages')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) return [];
      return data || [];
    }

    return getLocalItem(STORAGE_KEYS.CHAT_MESSAGES, []);
  },

  async sendChatMessage({ senderName, senderRole, message, replyTo = null, mentions = [] }) {
    const cleanMsg = (message || '').trim();
    if (!cleanMsg) return null;

    const newMsg = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'msg_' + Date.now(),
      sender_name: senderName,
      sender_role: senderRole,
      message: cleanMsg,
      reply_to: replyTo, // { id, sender_name, snippet }
      mentions: mentions, // Array of profile names mentioned
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('team_messages')
        .insert([newMsg])
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const allMsgs = getLocalItem(STORAGE_KEYS.CHAT_MESSAGES, []);
    allMsgs.push(newMsg);
    setLocalItem(STORAGE_KEYS.CHAT_MESSAGES, allMsgs);
    return newMsg;
  },

  subscribeToChat(onNewMessage) {
    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel('team_discussion')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'team_messages' },
          (payload) => {
            if (payload.new && onNewMessage) {
              onNewMessage(payload.new);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    // Local fallback: listener on window storage event for multi-tab sync
    const handler = (e) => {
      if (e.key === STORAGE_KEYS.CHAT_MESSAGES) {
        const msgs = JSON.parse(e.newValue || '[]');
        if (msgs.length > 0 && onNewMessage) {
          onNewMessage(msgs[msgs.length - 1]);
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }
};
