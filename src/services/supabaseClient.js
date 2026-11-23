/**
 * =============================================================================
 * LOOPX SUPABASE CLIENT & CONNECTION CONFIGURATION
 * src/services/supabaseClient.js
 * =============================================================================
 *
 * HOW TO CONNECT SUPABASE:
 * 1. Create a free project at https://supabase.com
 * 2. Run the full SQL script at: supabase/schema.sql
 *    (paste contents into Supabase → SQL Editor → New Query → Run)
 * 3. Go to Supabase → Project Settings → API and copy:
 *      - Project URL  (e.g. https://abcdefgh.supabase.co)
 *      - anon / public key  (starts with eyJ...)
 * 4. Open .env in the project root and fill in:
 *      VITE_SUPABASE_URL=https://your-project.supabase.co
 *      VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
 *      VITE_SUPABASE_STORAGE_BUCKET=loopx-documents
 * 5. Restart the dev server: npm run dev
 *
 * STORAGE BUCKET:
 * The private bucket 'loopx-documents' is created by schema.sql automatically.
 * Max file size per upload: 15MB (enforced in ClientSubmissionPage.jsx).
 * To change the bucket name, update VITE_SUPABASE_STORAGE_BUCKET in .env.
 *
 * SECURITY:
 * - Only the anon (public) key is used in the frontend.
 * - The service_role key (admin) must NEVER be used in frontend code.
 * - Row Level Security (RLS) policies are defined in supabase/schema.sql.
 *
 * CURRENT STATUS:
 * isSupabaseConfigured = true  → Live database active, real-time chat enabled.
 * isSupabaseConfigured = false → Standby mode: data stored in browser localStorage only.
 *                                All data is lost when localStorage is cleared.
 * =============================================================================
 */
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// [SECTION — SUPABASE CONNECTION]
// These values are read from your .env file.
// To change: edit VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
// ---------------------------------------------------------------------------
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.trim().startsWith('http') &&
  supabaseAnonKey.trim().length > 10
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
  : null;

export const SUPABASE_STATUS = {
  isConfigured: isSupabaseConfigured,
  url: supabaseUrl ? supabaseUrl.replace(/https?:\/\//, '').split('.')[0] + '...' : 'Not Configured',
  storageBucket: import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'loopx-documents'
};
