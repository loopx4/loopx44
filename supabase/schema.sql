-- =============================================================================
-- LOOPX COMPLETE SECURE DATABASE SCHEMA & SUPABASE CONFIGURATION
-- =============================================================================
-- Production-ready schema with:
-- 1. Shared Google-Forms-style dynamic questionnaire builder
-- 2. Row Level Security (RLS) with defense-in-depth token isolation
-- 3. Atomic sequential queue numbering (LX-001, LX-002, ...)
-- 4. Secure RPC token lookups and submission processing
-- 5. Private file storage policies for loopx-documents
-- Run this script in the Supabase SQL Editor: https://app.supabase.com/project/_/sql
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

-- -----------------------------------------------------------------------------
-- 3. SHARED QUESTIONNAIRE / FORM BUILDER TABLES
-- -----------------------------------------------------------------------------
-- Stores shared form configurations. All employees share and collaborate on the same form.
CREATE TABLE IF NOT EXISTS public.form_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'LoopX Client Intake Questionnaire',
  description TEXT DEFAULT 'Complete your project specifications, operational requirements, and attachments.',
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

-- Stores questions belonging to a form configuration
CREATE TABLE IF NOT EXISTS public.form_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.form_schemas(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT DEFAULT '',
  question_type TEXT NOT NULL CHECK (question_type IN (
    'short_answer', 'long_answer', 'multiple_choice', 'checkboxes',
    'dropdown', 'phone', 'email', 'date', 'file_upload'
  )),
  options JSONB DEFAULT '[]'::jsonb,
  is_required BOOLEAN NOT NULL DEFAULT false,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_questions_form ON public.form_questions(form_id, order_index);

-- Seed default shared form schema if not present
INSERT INTO public.form_schemas (id, title, description, is_active, version)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'LoopX Client Intake Questionnaire',
  'Please provide complete business and technical details for your project onboarding.',
  true,
  1
) ON CONFLICT (id) DO NOTHING;

-- Seed default LoopX questions covering all required question types
INSERT INTO public.form_questions (id, form_id, label, description, question_type, options, is_required, order_index)
VALUES
  ('00000000-0000-0000-0001-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Client Full Name', 'Full legal or primary contact name', 'short_answer', '[]'::jsonb, true, 0),
  ('00000000-0000-0000-0001-000000000002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Business / Organisation Name', 'Registered trading or entity name', 'short_answer', '[]'::jsonb, true, 1),
  ('00000000-0000-0000-0001-000000000003'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Phone Number', 'Direct contact mobile or office phone', 'phone', '[]'::jsonb, true, 2),
  ('00000000-0000-0000-0001-000000000004'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Email Address', 'Official business correspondence email', 'email', '[]'::jsonb, false, 3),
  ('00000000-0000-0000-0001-000000000005'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Business Location', 'City, State, and Country', 'short_answer', '[]'::jsonb, true, 4),
  ('00000000-0000-0000-0001-000000000006'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Business Type / Sector', 'Primary operating industry', 'dropdown', '["Healthcare", "Real Estate", "E-Commerce", "Finance & Banking", "Logistics", "Technology", "Other"]'::jsonb, true, 5),
  ('00000000-0000-0000-0001-000000000007'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Services Required', 'Select all relevant project capabilities', 'checkboxes', '["Workflow Automation", "CRM & ERP Integration", "Web Application Development", "Custom Software", "Cloud Infrastructure", "API & Database Engineering"]'::jsonb, true, 6),
  ('00000000-0000-0000-0001-000000000008'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Detailed Project Scope & Requirements', 'Describe existing workflows, bottlenecks, technical specifications, and expected deliverables', 'long_answer', '[]'::jsonb, true, 7),
  ('00000000-0000-0000-0001-000000000009'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Priority Level', 'Urgency and scheduling window', 'multiple_choice', '["Standard (2-4 Weeks)", "Expedited (1-2 Weeks)", "Immediate / Critical (Under 1 Week)"]'::jsonb, false, 8),
  ('00000000-0000-0000-0001-000000000010'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Target Completion Date', 'Desired deadline or launch milestone', 'date', '[]'::jsonb, false, 9),
  ('00000000-0000-0000-0001-000000000011'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Additional Information / Notes', 'Budget considerations, existing software links, or team references', 'long_answer', '[]'::jsonb, false, 10),
  ('00000000-0000-0000-0001-000000000012'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Project Documents, Schematics & Photos', 'Attach any relevant design specs, spreadsheets, or photos (Max 15MB total)', 'file_upload', '[]'::jsonb, false, 11)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. CLIENT PRIVATE LINKS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  form_id UUID REFERENCES public.form_schemas(id) ON DELETE SET NULL,
  created_by_profile_id UUID REFERENCES public.employee_profiles(id) ON DELETE SET NULL,
  created_by_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'submitted')),
  queue_number TEXT,
  form_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_links_token ON public.client_links(token);
CREATE INDEX IF NOT EXISTS idx_client_links_profile ON public.client_links(created_by_profile_id);

-- -----------------------------------------------------------------------------
-- 5. CLIENT SUBMISSIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL UNIQUE REFERENCES public.client_links(id) ON DELETE CASCADE,
  link_token TEXT NOT NULL UNIQUE,
  queue_number TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL DEFAULT '',
  business_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT,
  location TEXT NOT NULL DEFAULT '',
  business_type TEXT NOT NULL DEFAULT '',
  services_required TEXT NOT NULL DEFAULT '',
  detailed_requirements TEXT NOT NULL DEFAULT '',
  additional_info TEXT,
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
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
CREATE INDEX IF NOT EXISTS idx_client_submissions_token ON public.client_submissions(link_token);

-- -----------------------------------------------------------------------------
-- 6. SUBMISSION FILES TABLE (Detailed file metadata)
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

CREATE INDEX IF NOT EXISTS idx_submission_files_submission ON public.submission_files(submission_id);

-- -----------------------------------------------------------------------------
-- 7. STATUS CHANGE AUDIT HISTORY TABLE
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
-- 8. TEAM MESSAGES TABLE (Real-time Team Discussion)
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

CREATE INDEX IF NOT EXISTS idx_team_messages_created ON public.team_messages(created_at);

-- -----------------------------------------------------------------------------
-- 9. REAL-TIME SUBSCRIPTION CONFIGURATION
-- -----------------------------------------------------------------------------
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
-- 10. PRIVATE STORAGE BUCKET CONFIGURATION
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('loopx-documents', 'loopx-documents', false, 5242880)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 5242880;

-- -----------------------------------------------------------------------------
-- 11. AUTHENTICATION & SECURITY DEFINER HELPER FUNCTIONS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() ->> 'role',
    current_setting('request.jwt.claims', true)::json ->> 'role',
    ''
  );
EXCEPTION WHEN OTHERS THEN
  RETURN '';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_auth_username()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'username',
    auth.jwt() -> 'app_metadata' ->> 'username',
    auth.jwt() ->> 'username',
    current_setting('request.jwt.claims', true)::json ->> 'username',
    ''
  );
EXCEPTION WHEN OTHERS THEN
  RETURN '';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_client_token()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN COALESCE(
    NULLIF(current_setting('request.headers', true)::json ->> 'x-client-token', ''),
    NULLIF(current_setting('request.headers', true)::json ->> 'x-token', ''),
    ''
  );
EXCEPTION WHEN OTHERS THEN
  RETURN '';
END;
$$;

-- Atomic Sequential Queue Number Function (LX-001, LX-002, ...)
-- Row-level locking on queue_counter guarantees no duplicate numbers under concurrency
CREATE OR REPLACE FUNCTION public.get_next_queue_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  next_val INT;
BEGIN
  UPDATE public.queue_counter
  SET current_val = current_val + 1, updated_at = NOW()
  WHERE id = 1
  RETURNING current_val INTO next_val;

  RETURN 'LX-' || LPAD(next_val::TEXT, 3, '0');
END;
$$;

-- Revoke anonymous access from direct queue number generation
-- Anonymous clients can only consume a queue number by submitting a valid unsubmitted link token
REVOKE ALL ON FUNCTION public.get_next_queue_number() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_next_queue_number() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_next_queue_number() TO authenticated, service_role;

-- Secure RPC function to lookup client link by token without exposing table to enumeration
CREATE OR REPLACE FUNCTION public.get_client_link_by_token(p_token TEXT)
RETURNS SETOF public.client_links
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_token IS NULL OR TRIM(p_token) = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM public.client_links
  WHERE token = TRIM(p_token)
  LIMIT 1;
END;
$$;

-- Secure RPC function to lookup client submission by token without exposing table to enumeration
CREATE OR REPLACE FUNCTION public.get_client_submission_by_token(p_token TEXT)
RETURNS SETOF public.client_submissions
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_token IS NULL OR TRIM(p_token) = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM public.client_submissions
  WHERE link_token = TRIM(p_token)
  LIMIT 1;
END;
$$;

-- Secure RPC function to save shared form configuration and questions atomically
CREATE OR REPLACE FUNCTION public.save_shared_form_questions(
  p_title TEXT,
  p_description TEXT,
  p_questions JSONB,
  p_author TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_form_id UUID;
  v_q JSONB;
  v_idx INT := 0;
BEGIN
  -- Verify caller is authorized team member
  IF public.get_auth_role() NOT IN ('owner', 'employee') AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: only team members can edit the shared questionnaire.';
  END IF;

  -- Get active form or create one
  SELECT id INTO v_form_id FROM public.form_schemas WHERE is_active = true LIMIT 1;
  IF v_form_id IS NULL THEN
    INSERT INTO public.form_schemas (title, description, is_active, version, updated_by)
    VALUES (COALESCE(p_title, 'LoopX Client Intake Questionnaire'), p_description, true, 1, p_author)
    RETURNING id INTO v_form_id;
  ELSE
    UPDATE public.form_schemas
    SET title = COALESCE(p_title, title),
        description = COALESCE(p_description, description),
        version = version + 1,
        updated_at = NOW(),
        updated_by = p_author
    WHERE id = v_form_id;
  END IF;

  -- Replace questions with updated questions list
  DELETE FROM public.form_questions WHERE form_id = v_form_id;

  IF p_questions IS NOT NULL THEN
    FOR v_q IN SELECT * FROM jsonb_array_elements(p_questions)
    LOOP
      INSERT INTO public.form_questions (
        form_id,
        label,
        description,
        question_type,
        options,
        is_required,
        order_index
      ) VALUES (
        v_form_id,
        COALESCE(v_q->>'label', 'Untitled Question'),
        COALESCE(v_q->>'description', ''),
        COALESCE(v_q->>'question_type', 'short_answer'),
        COALESCE(v_q->'options', '[]'::jsonb),
        COALESCE((v_q->>'is_required')::boolean, false),
        COALESCE((v_q->>'order_index')::int, v_idx)
      );
      v_idx := v_idx + 1;
    END LOOP;
  END IF;

  RETURN v_form_id;
END;
$$;

-- Atomic Client Submission Function
-- Validates token status = 'created', generates sequential queue number,
-- creates submission, updates link to 'submitted', and records status history in one transaction.
CREATE OR REPLACE FUNCTION public.submit_client_intake(
  p_token TEXT,
  p_client_name TEXT,
  p_business_name TEXT,
  p_phone TEXT,
  p_email TEXT,
  p_location TEXT,
  p_business_type TEXT,
  p_services_required TEXT,
  p_detailed_requirements TEXT,
  p_additional_info TEXT,
  p_responses JSONB,
  p_files JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_link RECORD;
  v_queue_num TEXT;
  v_submission_id UUID;
  v_result JSONB;
  v_total_files_size BIGINT := 0;
  v_file_elem JSONB;
  v_file_size BIGINT;
BEGIN
  -- 1. Strictly validate link token
  IF p_token IS NULL OR TRIM(p_token) = '' THEN
    RAISE EXCEPTION 'Link token cannot be empty.';
  END IF;

  SELECT * INTO v_link
  FROM public.client_links
  WHERE token = TRIM(p_token)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid client submission link.';
  END IF;

  IF v_link.status = 'submitted' THEN
    RAISE EXCEPTION 'This client link has already been submitted.';
  END IF;

  -- 2. Validate individual (5MB) and combined (30MB) file limits on backend
  IF p_files IS NOT NULL AND jsonb_array_length(p_files) > 0 THEN
    v_total_files_size := 0;
    FOR v_file_elem IN SELECT * FROM jsonb_array_elements(p_files)
    LOOP
      v_file_size := COALESCE((v_file_elem->>'size')::BIGINT, 0);
      IF v_file_size > 5242880 THEN -- 5 MB
        RAISE EXCEPTION 'File "%" exceeds the 5 MB individual limit.', COALESCE(v_file_elem->>'name', 'unnamed');
      END IF;
      v_total_files_size := v_total_files_size + v_file_size;
    END LOOP;

    IF v_total_files_size > 31457280 THEN -- 30 MB
      RAISE EXCEPTION 'Combined file size (% bytes) exceeds the 30 MB maximum limit.', v_total_files_size;
    END IF;
  END IF;

  -- 3. Generate atomic queue number (only consumed upon valid submission!)
  v_queue_num := public.get_next_queue_number();

  -- 3. Insert submission
  INSERT INTO public.client_submissions (
    link_id,
    link_token,
    queue_number,
    client_name,
    business_name,
    phone,
    email,
    location,
    business_type,
    services_required,
    detailed_requirements,
    additional_info,
    responses,
    current_status,
    created_by_profile_id,
    created_by_name,
    files,
    submitted_at,
    updated_at,
    updated_by
  ) VALUES (
    v_link.id,
    v_link.token,
    v_queue_num,
    COALESCE(p_client_name, ''),
    COALESCE(p_business_name, ''),
    COALESCE(p_phone, ''),
    p_email,
    COALESCE(p_location, ''),
    COALESCE(p_business_type, ''),
    COALESCE(p_services_required, ''),
    COALESCE(p_detailed_requirements, ''),
    p_additional_info,
    COALESCE(p_responses, '{}'::jsonb),
    'Pending',
    v_link.created_by_profile_id,
    v_link.created_by_name,
    COALESCE(p_files, '[]'::jsonb),
    NOW(),
    NOW(),
    'Client Intake Submission'
  )
  RETURNING id INTO v_submission_id;

  -- 4. Mark link as submitted
  UPDATE public.client_links
  SET status = 'submitted',
      queue_number = v_queue_num
  WHERE id = v_link.id;

  -- 5. Audit log
  INSERT INTO public.status_history (
    submission_id,
    old_status,
    new_status,
    changed_by,
    changed_at
  ) VALUES (
    v_submission_id,
    NULL,
    'Pending',
    'Client Intake Submission',
    NOW()
  );

  -- 6. Insert file metadata records if any
  IF p_files IS NOT NULL AND jsonb_array_length(p_files) > 0 THEN
    INSERT INTO public.submission_files (
      submission_id,
      file_name,
      file_size,
      file_type,
      storage_path,
      created_at
    )
    SELECT
      v_submission_id,
      COALESCE(f->>'name', 'file'),
      COALESCE((f->>'size')::bigint, 0),
      COALESCE(f->>'type', 'application/octet-stream'),
      COALESCE(f->>'storagePath', ''),
      NOW()
    FROM jsonb_array_elements(p_files) AS f;
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'submission_id', v_submission_id,
    'queue_number', v_queue_num,
    'link_id', v_link.id,
    'status', 'submitted'
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execution permissions
REVOKE ALL ON FUNCTION public.get_client_link_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_link_by_token(TEXT) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_client_submission_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_submission_by_token(TEXT) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.save_shared_form_questions(TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_shared_form_questions(TEXT, TEXT, JSONB, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.submit_client_intake(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_client_intake(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB) TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- A. EMPLOYEE PROFILES POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Profiles: Read access"
  ON public.employee_profiles FOR SELECT
  USING (true);

CREATE POLICY "Profiles: Owner insert"
  ON public.employee_profiles FOR INSERT
  WITH CHECK (
    public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Profiles: Owner update"
  ON public.employee_profiles FOR UPDATE
  USING (
    public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Profiles: Owner delete"
  ON public.employee_profiles FOR DELETE
  USING (
    public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
  );

-- -----------------------------------------------------------------------------
-- B. QUEUE COUNTER POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "QueueCounter: Admin full access"
  ON public.queue_counter FOR ALL
  USING (
    public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
  );

-- -----------------------------------------------------------------------------
-- C. FORM SCHEMAS & QUESTIONS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "FormSchemas: Read active"
  ON public.form_schemas FOR SELECT
  USING (true);

CREATE POLICY "FormQuestions: Read active"
  ON public.form_questions FOR SELECT
  USING (true);

CREATE POLICY "FormSchemas: Team manage"
  ON public.form_schemas FOR ALL
  USING (
    public.get_auth_role() IN ('owner', 'employee')
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    public.get_auth_role() IN ('owner', 'employee')
    OR auth.role() = 'service_role'
  );

CREATE POLICY "FormQuestions: Team manage"
  ON public.form_questions FOR ALL
  USING (
    public.get_auth_role() IN ('owner', 'employee')
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    public.get_auth_role() IN ('owner', 'employee')
    OR auth.role() = 'service_role'
  );

-- -----------------------------------------------------------------------------
-- D. CLIENT LINKS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "ClientLinks: Select access"
  ON public.client_links FOR SELECT
  USING (
    public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
    OR (
      public.get_auth_role() = 'employee'
      AND created_by_name = public.get_auth_username()
    )
    OR (
      public.get_client_token() <> ''
      AND token = public.get_client_token()
    )
  );

CREATE POLICY "ClientLinks: Team insert"
  ON public.client_links FOR INSERT
  WITH CHECK (
    public.get_auth_role() IN ('owner', 'employee')
    OR auth.role() = 'service_role'
  );

CREATE POLICY "ClientLinks: Update access"
  ON public.client_links FOR UPDATE
  USING (
    public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
    OR (
      public.get_auth_role() = 'employee'
      AND created_by_name = public.get_auth_username()
    )
    OR (
      status = 'created'
      AND public.get_client_token() <> ''
      AND token = public.get_client_token()
    )
  )
  WITH CHECK (
    public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
    OR (
      public.get_auth_role() = 'employee'
      AND created_by_name = public.get_auth_username()
    )
    OR status = 'submitted'
  );

CREATE POLICY "ClientLinks: Delete access"
  ON public.client_links FOR DELETE
  USING (
    public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
    OR (
      public.get_auth_role() = 'employee'
      AND created_by_name = public.get_auth_username()
    )
  );

-- -----------------------------------------------------------------------------
-- E. CLIENT SUBMISSIONS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Submissions: Select access"
  ON public.client_submissions FOR SELECT
  USING (
    public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
    OR (
      public.get_auth_role() = 'employee'
      AND created_by_name = public.get_auth_username()
    )
    OR (
      public.get_client_token() <> ''
      AND link_token = public.get_client_token()
    )
  );

CREATE POLICY "Submissions: Insert intake"
  ON public.client_submissions FOR INSERT
  WITH CHECK (
    public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.client_links
      WHERE client_links.id = client_submissions.link_id
        AND client_links.token = client_submissions.link_token
        AND client_links.status = 'created'
    )
  );

CREATE POLICY "Submissions: Update access"
  ON public.client_submissions FOR UPDATE
  USING (
    public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
    OR (
      public.get_auth_role() = 'employee'
      AND created_by_name = public.get_auth_username()
    )
  )
  WITH CHECK (
    public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
    OR (
      public.get_auth_role() = 'employee'
      AND created_by_name = public.get_auth_username()
    )
  );

CREATE POLICY "Submissions: Owner delete"
  ON public.client_submissions FOR DELETE
  USING (
    public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
  );

-- -----------------------------------------------------------------------------
-- F. SUBMISSION FILES POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "SubmissionFiles: Select access"
  ON public.submission_files FOR SELECT
  USING (
    public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.client_submissions cs
      WHERE cs.id = submission_files.submission_id
        AND (
          (public.get_auth_role() = 'employee' AND cs.created_by_name = public.get_auth_username())
          OR (public.get_client_token() <> '' AND cs.link_token = public.get_client_token())
        )
    )
  );

CREATE POLICY "SubmissionFiles: Insert access"
  ON public.submission_files FOR INSERT
  WITH CHECK (
    public.get_auth_role() IN ('owner', 'employee')
    OR auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.client_submissions cs
      WHERE cs.id = submission_files.submission_id
    )
  );

CREATE POLICY "SubmissionFiles: Admin manage"
  ON public.submission_files FOR ALL
  USING (
    public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
  );

-- -----------------------------------------------------------------------------
-- G. STATUS AUDIT HISTORY POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "StatusHistory: Select access"
  ON public.status_history FOR SELECT
  USING (
    public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.client_submissions cs
      WHERE cs.id = status_history.submission_id
        AND (
          (public.get_auth_role() = 'employee' AND cs.created_by_name = public.get_auth_username())
          OR (public.get_client_token() <> '' AND cs.link_token = public.get_client_token())
        )
    )
  );

CREATE POLICY "StatusHistory: Insert access"
  ON public.status_history FOR INSERT
  WITH CHECK (
    public.get_auth_role() IN ('owner', 'employee')
    OR auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.client_submissions cs
      WHERE cs.id = status_history.submission_id
    )
  );

-- No UPDATE or DELETE allowed on status_history (immutable audit log).

-- -----------------------------------------------------------------------------
-- H. TEAM MESSAGES POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "TeamMessages: Team select"
  ON public.team_messages FOR SELECT
  USING (
    public.get_auth_role() IN ('owner', 'employee')
    OR auth.role() = 'service_role'
  );

CREATE POLICY "TeamMessages: Team insert"
  ON public.team_messages FOR INSERT
  WITH CHECK (
    public.get_auth_role() IN ('owner', 'employee')
    OR auth.role() = 'service_role'
  );

CREATE POLICY "TeamMessages: Owner manage"
  ON public.team_messages FOR ALL
  USING (
    public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
  );

CREATE POLICY "TeamMessages: Author update"
  ON public.team_messages FOR UPDATE
  USING (
    sender_name = public.get_auth_username()
    OR public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    sender_name = public.get_auth_username()
    OR public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
  );

CREATE POLICY "TeamMessages: Author delete"
  ON public.team_messages FOR DELETE
  USING (
    sender_name = public.get_auth_username()
    OR public.get_auth_role() = 'owner'
    OR auth.role() = 'service_role'
  );

-- -----------------------------------------------------------------------------
-- I. STORAGE BUCKET POLICIES (loopx-documents)
-- -----------------------------------------------------------------------------
CREATE POLICY "Storage: Upload to loopx-documents with valid link"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'loopx-documents'
    AND (
      public.get_auth_role() IN ('owner', 'employee')
      OR auth.role() = 'service_role'
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.client_links
          WHERE client_links.token = (storage.foldername(name))[1]
            AND client_links.status = 'created'
        )
      )
    )
  );

CREATE POLICY "Storage: Read loopx-documents restricted"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'loopx-documents'
    AND (
      public.get_auth_role() = 'owner'
      OR auth.role() = 'service_role'
      OR (
        public.get_auth_role() = 'employee'
        AND EXISTS (
          SELECT 1 FROM public.client_links
          WHERE client_links.token = (storage.foldername(name))[1]
            AND client_links.created_by_name = public.get_auth_username()
        )
      )
      OR (
        public.get_client_token() <> ''
        AND (storage.foldername(name))[1] = public.get_client_token()
      )
    )
  );

CREATE POLICY "Storage: Delete loopx-documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'loopx-documents'
    AND (
      public.get_auth_role() = 'owner'
      OR auth.role() = 'service_role'
      OR (
        public.get_auth_role() = 'employee'
        AND EXISTS (
          SELECT 1 FROM public.client_links
          WHERE client_links.token = (storage.foldername(name))[1]
            AND client_links.created_by_name = public.get_auth_username()
        )
      )
    )
  );
