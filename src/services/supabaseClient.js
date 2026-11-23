import { createClient } from '@supabase/supabase-js';

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
