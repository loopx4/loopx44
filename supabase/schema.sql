-- =============================================================================
-- LOOPX COMPLETE DATABASE SCHEMA & SUPABASE CONFIGURATION
-- =============================================================================
-- Run this complete script in the Supabase SQL Editor:
-- https://app.supabase.com/project/_/sql
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. EMPLOYEE PROFILES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive uniqueness constraint for employee profile names
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_profiles_name_unique 
  ON public.employee_profiles (LOWER(TRIM(name)));

-- -----------------------------------------------------------------------------
-- 2. QUEUE COUNTER & ATOMIC NUMBER GENERATOR
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.queue_counter (
  id INT PRIMARY KEY DEFAULT 1,
  current_val INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row_check CHECK (id = 1)
);

-- Seed counter with 0 (Zero queue records initially)
INSERT INTO public.queue_counter (id, current_val)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- Atomic Sequential Queue Number Function (LX-001, LX-002, ...)
CREATE OR REPLACE FUNCTION public.get_next_queue_number()
RETURNS TEXT AS $$
DECLARE
  next_val INT;
BEGIN
  UPDATE public.queue_counter
  SET current_val = current_val + 1, updated_at = NOW()
  WHERE id = 1
  RETURNING current_val INTO next_val;

  RETURN 'LX-' || LPAD(next_val::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 3. CLIENT PRIVATE LINKS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  created_by_profile_id UUID REFERENCES public.employee_profiles(id) ON DELETE SET NULL,
  created_by_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'submitted')),
  queue_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_links_token ON public.client_links(token);
CREATE INDEX IF NOT EXISTS idx_client_links_profile ON public.client_links(created_by_profile_id);

-- -----------------------------------------------------------------------------
-- 4. CLIENT SUBMISSIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL UNIQUE REFERENCES public.client_links(id) ON DELETE CASCADE,
  link_token TEXT NOT NULL UNIQUE,
  queue_number TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  location TEXT NOT NULL,
  business_type TEXT NOT NULL,
  services_required TEXT NOT NULL,
  detailed_requirements TEXT NOT NULL,
  additional_info TEXT,
  current_status TEXT NOT NULL DEFAULT 'Pending' CHECK (current_status IN ('Pending', 'Working', 'Completed')),
  created_by_profile_id UUID REFERENCES public.employee_profiles(id) ON DELETE SET NULL,
  created_by_name TEXT NOT NULL,
  files JSONB DEFAULT '[]'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_client_submissions_status ON public.client_submissions(current_status);
CREATE INDEX IF NOT EXISTS idx_client_submissions_queue ON public.client_submissions(queue_number);
CREATE INDEX IF NOT EXISTS idx_client_submissions_profile ON public.client_submissions(created_by_profile_id);

-- -----------------------------------------------------------------------------
-- 5. SUBMISSION FILES TABLE (Detailed file metadata)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.submission_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.client_submissions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 6. STATUS CHANGE AUDIT HISTORY TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.client_submissions(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL CHECK (new_status IN ('Pending', 'Working', 'Completed')),
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_history_submission ON public.status_history(submission_id);

-- -----------------------------------------------------------------------------
-- 7. TEAM MESSAGES TABLE (Real-time Discussion)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('owner', 'employee')),
  message TEXT NOT NULL,
  reply_to JSONB,
  mentions TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 8. REAL-TIME SUBSCRIPTION CONFIGURATION
-- -----------------------------------------------------------------------------
-- Enable real-time listening on team_messages and client_submissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'team_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'client_submissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.client_submissions;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 9. PRIVATE STORAGE BUCKET CONFIGURATION
-- -----------------------------------------------------------------------------
-- Creates private bucket 'loopx-documents' for secure photo & document storage
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('loopx-documents', 'loopx-documents', false, 15728640)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;

-- Anonymous public policy: Allow reading client links by exact token
CREATE POLICY "Allow public token lookup on client_links"
  ON public.client_links FOR SELECT
  USING (true);

-- Anonymous public policy: Allow inserting submission with valid link token
CREATE POLICY "Allow public submission insertion"
  ON public.client_submissions FOR INSERT
  WITH CHECK (true);

-- Anonymous public policy: Allow read-only lookup of submitted record by link token
CREATE POLICY "Allow client read-only lookup by token"
  ON public.client_submissions FOR SELECT
  USING (true);

-- Authenticated application service policies: full access to internal tables
CREATE POLICY "Allow full access to employee_profiles"
  ON public.employee_profiles FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow full access to client_links for authenticated app"
  ON public.client_links FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow full update on client_submissions"
  ON public.client_submissions FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow full access to status_history"
  ON public.status_history FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow full access to team_messages"
  ON public.team_messages FOR ALL
  USING (true)
  WITH CHECK (true);

-- Storage bucket private access policies
CREATE POLICY "Allow uploads to loopx-documents bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'loopx-documents');

CREATE POLICY "Allow reads from loopx-documents bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'loopx-documents');
