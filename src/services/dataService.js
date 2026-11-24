/**
 * =============================================================================
 * LOOPX UNIFIED DATA SERVICE
 * src/services/dataService.js
 * =============================================================================
 * Central data layer for all application operations:
 *   - Employee profiles (case-insensitive duplicate prevention)
 *   - Shared Google-Forms-style questionnaire configuration & questions
 *   - Client private links (cryptographically random tokens & form snapshots)
 *   - Client form submissions (atomic sequential LX-001 queue numbering & dynamic responses)
 *   - Submission file references and status audit history
 *   - Team discussion / real-time chat with @mentions
 *
 * DUAL MODE OPERATION:
 * ┌─────────────────────────────────────────────────────────────┐
 * │  Supabase NOT configured  →  Local Standby Mode             │
 * │  All data stored in browser localStorage.                   │
 * │  Data is session-local and cleared with browser data.       │
 * │  No real-time chat across different browsers/devices.       │
 * ├─────────────────────────────────────────────────────────────┤
 * │  Supabase configured      →  Live Database Mode             │
 * │  All data persisted in Supabase PostgreSQL.                 │
 * │  Real-time chat via Supabase Realtime channels.             │
 * │  Atomic queue numbers via submit_client_intake() RPC.       │
 * │  File uploads stored in private 'loopx-documents' bucket.   │
 * └─────────────────────────────────────────────────────────────┘
 * =============================================================================
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';

const STORAGE_KEYS = {
  PROFILES: 'loopx_employee_profiles',
  LINKS: 'loopx_client_links',
  SUBMISSIONS: 'loopx_client_submissions',
  STATUS_HISTORY: 'loopx_status_history',
  CHAT_MESSAGES: 'loopx_chat_messages',
  QUEUE_COUNTER: 'loopx_queue_counter',
  FORM_CONFIG: 'loopx_form_config'
};

// Storage byte limits
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per individual file
export const MAX_COMBINED_SIZE = 30 * 1024 * 1024; // 30 MB combined per submission
export const TOTAL_STORAGE_CAPACITY_BYTES = 1024 * 1024 * 1024; // 1 GB allocated tier

// Default LoopX Questionnaire covering all 9 required question types
export const DEFAULT_LOOPX_QUESTIONS = [
  {
    id: 'q_name',
    label: 'Client Full Name',
    description: 'Full legal or primary contact name',
    question_type: 'short_answer',
    options: [],
    is_required: true,
    order_index: 0
  },
  {
    id: 'q_business',
    label: 'Business / Organisation Name',
    description: 'Registered trading or entity name',
    question_type: 'short_answer',
    options: [],
    is_required: true,
    order_index: 1
  },
  {
    id: 'q_phone',
    label: 'Phone Number',
    description: 'Direct contact mobile or office phone',
    question_type: 'phone',
    options: [],
    is_required: true,
    order_index: 2
  },
  {
    id: 'q_email',
    label: 'Email Address',
    description: 'Official business correspondence email',
    question_type: 'email',
    options: [],
    is_required: false,
    order_index: 3
  },
  {
    id: 'q_location',
    label: 'Business Location',
    description: 'City, State, and Country',
    question_type: 'short_answer',
    options: [],
    is_required: true,
    order_index: 4
  },
  {
    id: 'q_sector',
    label: 'Business Type / Sector',
    description: 'Primary operating industry',
    question_type: 'dropdown',
    options: ['Healthcare', 'Real Estate', 'E-Commerce', 'Finance & Banking', 'Logistics', 'Technology', 'Other'],
    is_required: true,
    order_index: 5
  },
  {
    id: 'q_services',
    label: 'Services Required',
    description: 'Select all relevant project capabilities',
    question_type: 'checkboxes',
    options: ['Workflow Automation', 'CRM & ERP Integration', 'Web Application Development', 'Custom Software', 'Cloud Infrastructure', 'API & Database Engineering'],
    is_required: true,
    order_index: 6
  },
  {
    id: 'q_scope',
    label: 'Detailed Project Scope & Requirements',
    description: 'Describe existing workflows, bottlenecks, technical specifications, and expected deliverables',
    question_type: 'long_answer',
    options: [],
    is_required: true,
    order_index: 7
  },
  {
    id: 'q_priority',
    label: 'Priority Level',
    description: 'Urgency and scheduling window',
    question_type: 'multiple_choice',
    options: ['Standard (2-4 Weeks)', 'Expedited (1-2 Weeks)', 'Immediate / Critical (Under 1 Week)'],
    is_required: false,
    order_index: 8
  },
  {
    id: 'q_deadline',
    label: 'Target Completion Date',
    description: 'Desired deadline or launch milestone',
    question_type: 'date',
    options: [],
    is_required: false,
    order_index: 9
  },
  {
    id: 'q_notes',
    label: 'Additional Information / Notes',
    description: 'Budget considerations, existing software links, or team references',
    question_type: 'long_answer',
    options: [],
    is_required: false,
    order_index: 10
  },
  {
    id: 'q_files',
    label: 'Project Documents, Schematics & Photos',
    description: 'Attach any relevant design specs, spreadsheets, or photos (Max 5MB each, 30MB combined)',
    question_type: 'file_upload',
    options: [],
    is_required: false,
    order_index: 11
  }
];

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
    return getLocalItem(STORAGE_KEYS.PROFILES, []);
  },

  async createProfile(name) {
    const cleanName = (name || '').trim();
    if (!cleanName) {
      return { success: false, error: 'Profile name cannot be empty.' };
    }

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

  async updateProfile(profileId, newName) {
    const cleanName = (newName || '').trim();
    if (!cleanName) {
      return { success: false, error: 'Profile name cannot be empty.' };
    }

    const existing = await this.getProfiles();
    const isDuplicate = existing.some(
      (p) => p.id !== profileId && p.name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (isDuplicate) {
      return {
        success: false,
        error: `A profile named "${cleanName}" already exists (names are case-insensitive).`
      };
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('employee_profiles')
        .update({ name: cleanName, updated_at: new Date().toISOString() })
        .eq('id', profileId)
        .select()
        .single();
      if (error) return { success: false, error: error.message };
      return { success: true, profile: data };
    }

    const idx = existing.findIndex((p) => p.id === profileId);
    if (idx === -1) return { success: false, error: 'Profile not found.' };

    existing[idx] = {
      ...existing[idx],
      name: cleanName,
      updated_at: new Date().toISOString()
    };
    setLocalItem(STORAGE_KEYS.PROFILES, existing);
    return { success: true, profile: existing[idx] };
  },

  async deleteProfile(profileId) {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('employee_profiles')
        .delete()
        .eq('id', profileId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    }

    const existing = getLocalItem(STORAGE_KEYS.PROFILES, []);
    const updated = existing.filter((p) => p.id !== profileId);
    setLocalItem(STORAGE_KEYS.PROFILES, updated);
    return { success: true };
  },

  // ---------------------------------------------------------------------------
  // 2. SHARED QUESTIONNAIRE / FORM CONFIGURATION
  // ---------------------------------------------------------------------------
  async getFormConfig() {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: schemaData } = await supabase
          .from('form_schemas')
          .select('*')
          .eq('is_active', true)
          .order('version', { ascending: false })
          .limit(1)
          .single();

        if (schemaData) {
          const { data: qData, error: qErr } = await supabase
            .from('form_questions')
            .select('*')
            .eq('form_id', schemaData.id)
            .order('order_index', { ascending: true });

          if (!qErr && qData && qData.length > 0) {
            return {
              id: schemaData.id,
              title: schemaData.title,
              description: schemaData.description,
              version: schemaData.version,
              questions: qData
            };
          }
        }
      } catch (err) {
        console.warn('Could not load form config from Supabase, using local fallback:', err);
      }
    }

    const localConfig = getLocalItem(STORAGE_KEYS.FORM_CONFIG, null);
    if (localConfig && localConfig.questions && localConfig.questions.length > 0) {
      return localConfig;
    }

    // Default shared form template
    const defaultConfig = {
      id: '00000000-0000-0000-0000-000000000001',
      title: 'LoopX Client Intake Questionnaire',
      description: 'Please provide complete business and technical details for your project onboarding.',
      version: 1,
      questions: DEFAULT_LOOPX_QUESTIONS
    };

    setLocalItem(STORAGE_KEYS.FORM_CONFIG, defaultConfig);
    return defaultConfig;
  },

  async saveFormConfig({ title, description, questions, author = 'Team Member' }) {
    if (!questions || !Array.isArray(questions)) {
      return { success: false, error: 'Questions must be an array.' };
    }

    // Validate questions have labels
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].label || !questions[i].label.trim()) {
        return { success: false, error: `Question #${i + 1} must have a label/title.` };
      }
    }

    const sanitizedQuestions = questions.map((q, idx) => ({
      id: q.id || (crypto.randomUUID ? crypto.randomUUID() : `q_${Date.now()}_${idx}`),
      label: q.label.trim(),
      description: (q.description || '').trim(),
      question_type: q.question_type || 'short_answer',
      options: Array.isArray(q.options) ? q.options.filter((o) => typeof o === 'string' && o.trim() !== '') : [],
      is_required: Boolean(q.is_required),
      order_index: idx
    }));

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: rpcFormId, error: rpcErr } = await supabase.rpc('save_shared_form_questions', {
          p_title: title || 'LoopX Client Intake Questionnaire',
          p_description: description || '',
          p_questions: sanitizedQuestions,
          p_author: author
        });

        if (rpcErr) throw rpcErr;

        const updatedConfig = {
          id: rpcFormId,
          title,
          description,
          questions: sanitizedQuestions
        };
        setLocalItem(STORAGE_KEYS.FORM_CONFIG, updatedConfig);
        return { success: true, config: updatedConfig };
      } catch (err) {
        console.warn('RPC save failed, falling back to local sync:', err);
      }
    }

    const updatedConfig = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'form_' + Date.now(),
      title: title || 'LoopX Client Intake Questionnaire',
      description: description || '',
      version: Date.now(),
      questions: sanitizedQuestions
    };

    setLocalItem(STORAGE_KEYS.FORM_CONFIG, updatedConfig);
    return { success: true, config: updatedConfig };
  },

  // ---------------------------------------------------------------------------
  // 3. CLIENT PRIVATE LINKS
  // ---------------------------------------------------------------------------
  async createClientLink(profileId, profileName, formSnapshot = null) {
    const token = crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : (
      Math.random().toString(36).substring(2) + Date.now().toString(36)
    );

    // If no explicit snapshot passed, attach current shared form questions
    let snapshotToUse = formSnapshot;
    if (!snapshotToUse) {
      const activeConfig = await this.getFormConfig();
      snapshotToUse = activeConfig.questions || DEFAULT_LOOPX_QUESTIONS;
    }

    const linkRecord = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'link_' + Date.now(),
      token: token,
      created_by_profile_id: profileId,
      created_by_name: profileName,
      status: 'created', // 'created' | 'submitted'
      form_snapshot: snapshotToUse,
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

  async getClientLinks(profileId = null) {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('client_links').select('*').order('created_at', { ascending: false });
      if (profileId) query = query.eq('created_by_profile_id', profileId);
      const { data, error } = await query;
      if (error) return [];
      return data || [];
    }
    const all = getLocalItem(STORAGE_KEYS.LINKS, []);
    return profileId ? all.filter((l) => l.created_by_profile_id === profileId) : all;
  },

  async deleteClientLink(linkId) {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('client_links')
        .delete()
        .eq('id', linkId);
      if (error) throw error;
      return { success: true };
    }

    const existingLinks = getLocalItem(STORAGE_KEYS.LINKS, []);
    const updated = existingLinks.filter((l) => l.id !== linkId);
    setLocalItem(STORAGE_KEYS.LINKS, updated);
    return { success: true };
  },

  async getClientLinkByToken(token) {
    if (!token) return null;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_client_link_by_token', { p_token: token });
        if (!rpcErr && rpcData) {
          const res = Array.isArray(rpcData) ? rpcData[0] : rpcData;
          if (res) return res;
        }
      } catch (_) {
        // Fallback
      }

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
  // 4. CLIENT FORM SUBMISSIONS & QUEUE NUMBER GENERATION
  // ---------------------------------------------------------------------------
  async submitClientForm(token, formData, files = []) {
    // 1. Verify link exists and is unsubmitted
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

    // Backend/service-layer file size limits enforcement (5 MB individual, 30 MB combined)
    if (Array.isArray(files) && files.length > 0) {
      let combinedSize = 0;
      for (const f of files) {
        const size = Number(f.size) || 0;
        if (size > MAX_FILE_SIZE) {
          return {
            success: false,
            error: `File "${f.name || 'unnamed'}" (${(size / (1024 * 1024)).toFixed(2)} MB) exceeds the 5 MB individual limit.`
          };
        }
        combinedSize += size;
      }
      if (combinedSize > MAX_COMBINED_SIZE) {
        return {
          success: false,
          error: `Combined file size (${(combinedSize / (1024 * 1024)).toFixed(2)} MB) exceeds the 30 MB maximum limit.`
        };
      }
    }

    // Extract core fields from formData or responses
    const responses = formData.responses || formData;
    const clientName = formData.client_name || responses['Client Full Name'] || responses['Client Name'] || responses['Full Name'] || responses['Name'] || responses['client_name'] || 'Client';
    const businessName = formData.business_name || responses['Business / Organisation Name'] || responses['Business Name'] || responses['Company Name'] || responses['Company'] || responses['Organisation'] || responses['business_name'] || 'Business';
    const phone = formData.phone || responses['Phone Number'] || responses['phone'] || '';
    const email = formData.email || responses['Email Address'] || responses['email'] || '';
    const location = formData.location || responses['Business Location'] || responses['location'] || '';
    const businessType = formData.business_type || responses['Business Type / Sector'] || responses['business_type'] || '';
    const servicesRequired = Array.isArray(formData.services_required)
      ? formData.services_required.join(', ')
      : (formData.services_required || (Array.isArray(responses['Services Required']) ? responses['Services Required'].join(', ') : responses['Services Required']) || '');
    const detailedRequirements = formData.detailed_requirements || responses['Detailed Project Scope & Requirements'] || responses['detailed_requirements'] || '';
    const additionalInfo = formData.additional_info || responses['Additional Information / Notes'] || responses['additional_info'] || '';

    // 2. Supabase Mode via Atomic submit_client_intake RPC
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: intakeResult, error: intakeErr } = await supabase.rpc('submit_client_intake', {
          p_token: token,
          p_client_name: clientName,
          p_business_name: businessName,
          p_phone: phone,
          p_email: email,
          p_location: location,
          p_business_type: businessType,
          p_services_required: servicesRequired,
          p_detailed_requirements: detailedRequirements,
          p_additional_info: additionalInfo,
          p_responses: responses,
          p_files: files
        });

        if (intakeErr) throw intakeErr;

        // Fetch the fresh submitted record
        const freshSub = await this.getSubmissionByToken(token);
        return {
          success: true,
          submission: freshSub,
          queueNumber: intakeResult?.queue_number || freshSub?.queue_number
        };
      } catch (err) {
        console.error('submit_client_intake RPC failed:', err);
        throw err;
      }
    }

    // 3. Local Standby Mode: Atomic Sequential Queue Generation
    const allSubs = getLocalItem(STORAGE_KEYS.SUBMISSIONS, []);
    let currentCounter = getLocalItem(STORAGE_KEYS.QUEUE_COUNTER, 0);
    currentCounter += 1;
    setLocalItem(STORAGE_KEYS.QUEUE_COUNTER, currentCounter);
    let queueNumber = formatQueueNumber(currentCounter);

    while (allSubs.some((s) => s.queue_number === queueNumber)) {
      currentCounter += 1;
      setLocalItem(STORAGE_KEYS.QUEUE_COUNTER, currentCounter);
      queueNumber = formatQueueNumber(currentCounter);
    }

    const submissionRecord = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'sub_' + Date.now(),
      link_id: link.id,
      link_token: token,
      queue_number: queueNumber,
      client_name: clientName,
      business_name: businessName,
      phone: phone,
      email: email,
      location: location,
      business_type: businessType,
      services_required: servicesRequired,
      detailed_requirements: detailedRequirements,
      additional_info: additionalInfo,
      responses: responses,
      current_status: 'Pending',
      created_by_profile_id: link.created_by_profile_id,
      created_by_name: link.created_by_name,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: 'Client Intake Submission',
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
      changed_by: 'Client Intake Submission',
      changed_at: new Date().toISOString()
    });
    setLocalItem(STORAGE_KEYS.STATUS_HISTORY, allHistory);

    return { success: true, submission: submissionRecord, queueNumber };
  },

  // ---------------------------------------------------------------------------
  // 5. PRIVATE FILE STORAGE & UPLOADS
  // ---------------------------------------------------------------------------
  async uploadFile(token, file) {
    if (isSupabaseConfigured && supabase) {
      const bucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'loopx-documents';
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${token}/${Date.now()}_${cleanFileName}`;

      const { data, error } = await supabase.storage.from(bucket).upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false
      });

      if (error) throw error;
      return {
        name: file.name,
        size: file.size,
        type: file.type,
        storagePath: data.path
      };
    }

    return {
      name: file.name,
      size: file.size,
      type: file.type,
      storagePath: `local/${file.name}`
    };
  },

  async getFileDownloadUrl(storagePath) {
    if (isSupabaseConfigured && supabase && storagePath && !storagePath.startsWith('local/')) {
      const bucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'loopx-documents';
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 3600);
      if (error) return null;
      return data.signedUrl;
    }
    return null;
  },

  async getSubmissionByToken(token) {
    if (!token) return null;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_client_submission_by_token', { p_token: token });
        if (!rpcErr && rpcData) {
          const res = Array.isArray(rpcData) ? rpcData[0] : rpcData;
          if (res) return res;
        }
      } catch (_) {
        // Fallback
      }

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

  async updateSubmissionDetails(submissionId, updatedFields, changedByName) {
    const nowIso = new Date().toISOString();
    const updatePayload = {
      ...updatedFields,
      updated_at: nowIso,
      updated_by: changedByName || 'User Edit'
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('client_submissions')
        .update(updatePayload)
        .eq('id', submissionId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const allSubs = getLocalItem(STORAGE_KEYS.SUBMISSIONS, []);
    const idx = allSubs.findIndex((s) => s.id === submissionId);
    if (idx === -1) throw new Error('Submission not found.');

    allSubs[idx] = {
      ...allSubs[idx],
      ...updatePayload
    };
    setLocalItem(STORAGE_KEYS.SUBMISSIONS, allSubs);
    return allSubs[idx];
  },

  async deleteSubmission(submissionId) {
    if (isSupabaseConfigured && supabase) {
      const bucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'loopx-documents';
      // 1. Fetch submission to find associated files
      const { data: sub } = await supabase
        .from('client_submissions')
        .select('*')
        .eq('id', submissionId)
        .single();

      if (sub) {
        // Collect storage paths from sub.files or submission_files table
        const { data: dbFiles } = await supabase
          .from('submission_files')
          .select('storage_path')
          .eq('submission_id', submissionId);

        const pathsToRemove = [];
        if (dbFiles && dbFiles.length > 0) {
          dbFiles.forEach((f) => f.storage_path && pathsToRemove.push(f.storage_path));
        }
        if (Array.isArray(sub.files)) {
          sub.files.forEach((f) => {
            const p = f.storagePath || f.storage_path;
            if (p && !pathsToRemove.includes(p)) {
              pathsToRemove.push(p);
            }
          });
        }

        if (pathsToRemove.length > 0) {
          try {
            await supabase.storage.from(bucket).remove(pathsToRemove);
          } catch (stErr) {
            console.warn('Storage files cleanup warning:', stErr);
          }
        }

        // Delete records from submission_files, status_history, then client_submissions
        await supabase.from('submission_files').delete().eq('submission_id', submissionId);
        await supabase.from('status_history').delete().eq('submission_id', submissionId);
        const { error } = await supabase.from('client_submissions').delete().eq('id', submissionId);
        if (error) throw error;
      }
      return { success: true };
    }

    // Local Standby Mode
    const allSubs = getLocalItem(STORAGE_KEYS.SUBMISSIONS, []);
    const filteredSubs = allSubs.filter((s) => s.id !== submissionId);
    setLocalItem(STORAGE_KEYS.SUBMISSIONS, filteredSubs);

    const allHistory = getLocalItem(STORAGE_KEYS.STATUS_HISTORY, []);
    const filteredHistory = allHistory.filter((h) => h.submission_id !== submissionId);
    setLocalItem(STORAGE_KEYS.STATUS_HISTORY, filteredHistory);

    return { success: true };
  },

  async deleteSubmissionFile(submissionId, fileIdentifier) {
    if (isSupabaseConfigured && supabase) {
      const bucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'loopx-documents';
      const { data: sub } = await supabase
        .from('client_submissions')
        .select('*')
        .eq('id', submissionId)
        .single();

      if (!sub) throw new Error('Submission not found.');

      const existingFiles = Array.isArray(sub.files) ? sub.files : [];
      const targetFile = existingFiles.find(
        (f) => f.storagePath === fileIdentifier || f.name === fileIdentifier || f.storage_path === fileIdentifier
      );

      const targetPath = targetFile?.storagePath || targetFile?.storage_path || fileIdentifier;

      if (targetPath && !targetPath.startsWith('local/')) {
        try {
          await supabase.storage.from(bucket).remove([targetPath]);
        } catch (stErr) {
          console.warn('Failed to remove file from Supabase storage:', stErr);
        }
      }

      await supabase
        .from('submission_files')
        .delete()
        .eq('submission_id', submissionId)
        .or(`storage_path.eq.${targetPath},file_name.eq.${fileIdentifier}`);

      const updatedFiles = existingFiles.filter(
        (f) => f.storagePath !== targetPath && f.name !== fileIdentifier && f.storage_path !== targetPath
      );

      const { data, error } = await supabase
        .from('client_submissions')
        .update({ files: updatedFiles, updated_at: new Date().toISOString() })
        .eq('id', submissionId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, submission: data, updatedFiles };
    }

    // Local Standby Mode
    const allSubs = getLocalItem(STORAGE_KEYS.SUBMISSIONS, []);
    const idx = allSubs.findIndex((s) => s.id === submissionId);
    if (idx === -1) throw new Error('Submission not found.');

    const sub = allSubs[idx];
    const updatedFiles = (sub.files || []).filter(
      (f) => f.name !== fileIdentifier && f.storagePath !== fileIdentifier
    );
    sub.files = updatedFiles;
    sub.updated_at = new Date().toISOString();
    allSubs[idx] = sub;
    setLocalItem(STORAGE_KEYS.SUBMISSIONS, allSubs);

    return { success: true, submission: sub, updatedFiles };
  },

  async deleteMultipleFiles(fileItems = []) {
    for (const item of fileItems) {
      await this.deleteSubmissionFile(item.submissionId, item.storagePath || item.fileName);
    }
    return { success: true, count: fileItems.length };
  },

  async getStorageStats() {
    const totalAllocatedBytes = TOTAL_STORAGE_CAPACITY_BYTES; // 1 GB
    let usedBytes = 0;
    const clientFiles = [];

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: submissions } = await supabase
          .from('client_submissions')
          .select('id, queue_number, client_name, business_name, submitted_at, files');

        if (submissions) {
          submissions.forEach((sub) => {
            const files = Array.isArray(sub.files) ? sub.files : [];
            files.forEach((f) => {
              const size = Number(f.size) || 0;
              usedBytes += size;
              clientFiles.push({
                submissionId: sub.id,
                queueNumber: sub.queue_number,
                clientName: sub.client_name,
                businessName: sub.business_name,
                fileName: f.name || 'Untitled File',
                fileSize: size,
                storagePath: f.storagePath || f.storage_path || '',
                uploadedAt: sub.submitted_at,
                dataUrl: f.dataUrl || null
              });
            });
          });
        }
      } catch (err) {
        console.error('Failed to calculate Supabase storage stats:', err);
      }
    } else {
      const allSubs = getLocalItem(STORAGE_KEYS.SUBMISSIONS, []);
      allSubs.forEach((sub) => {
        const files = Array.isArray(sub.files) ? sub.files : [];
        files.forEach((f) => {
          const size = Number(f.size) || 0;
          usedBytes += size;
          clientFiles.push({
            submissionId: sub.id,
            queueNumber: sub.queue_number,
            clientName: sub.client_name,
            businessName: sub.business_name,
            fileName: f.name || 'Untitled File',
            fileSize: size,
            storagePath: f.storagePath || '',
            uploadedAt: sub.submitted_at,
            dataUrl: f.dataUrl || null
          });
        });
      });
    }

    const availableBytes = Math.max(0, totalAllocatedBytes - usedBytes);
    const usagePercentage = Number(((usedBytes / totalAllocatedBytes) * 100).toFixed(2));

    return {
      totalCapacityBytes: totalAllocatedBytes,
      usedBytes,
      availableBytes,
      usagePercentage,
      totalFileCount: clientFiles.length,
      clientFiles
    };
  },

  // ---------------------------------------------------------------------------
  // 6. TEAM DISCUSSION / CHAT
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
      reply_to: replyTo,
      mentions: mentions,
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

  async editChatMessage(messageId, newContent) {
    const cleanMsg = (newContent || '').trim();
    if (!cleanMsg) return null;
    const nowIso = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('team_messages')
        .update({
          message: cleanMsg,
          updated_at: nowIso,
          is_edited: true
        })
        .eq('id', messageId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const allMsgs = getLocalItem(STORAGE_KEYS.CHAT_MESSAGES, []);
    const idx = allMsgs.findIndex((m) => m.id === messageId);
    if (idx === -1) throw new Error('Message not found.');

    allMsgs[idx].message = cleanMsg;
    allMsgs[idx].updated_at = nowIso;
    allMsgs[idx].is_edited = true;
    setLocalItem(STORAGE_KEYS.CHAT_MESSAGES, allMsgs);
    return allMsgs[idx];
  },

  async deleteChatMessage(messageId) {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('team_messages')
        .delete()
        .eq('id', messageId);
      if (error) throw error;
      return { success: true };
    }

    const allMsgs = getLocalItem(STORAGE_KEYS.CHAT_MESSAGES, []);
    const updated = allMsgs.filter((m) => m.id !== messageId);
    setLocalItem(STORAGE_KEYS.CHAT_MESSAGES, updated);
    return { success: true };
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
