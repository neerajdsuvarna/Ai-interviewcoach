-- -----------------------------------------------------------------------------
-- 2025_08_05_2_Add_RLS_Security.sql
-- -----------------------------------------------------------------------------
-- Purpose  : Enable Row-Level Security (RLS) on all application tables and
--            create minimum-viable RLS policies so the API immediately works
--            with authenticated users.
-- Author   : ChatGPT auto-generated consolidation (2025-08-06)
-- -----------------------------------------------------------------------------
-- NOTE
-- ----
--  • This migration assumes that the base tables were created by the script
--    `2025_08_05_1_create-base-table.sql`.
--  • Policies here are intentionally simple.  Enhance or tighten them as your
--    security model evolves.
--  • All policies use `auth.uid()` which resolves to the currently-authenticated
--    Supabase Auth user.
-- -----------------------------------------------------------------------------

-- Enable RLS on every application table -----------------------------------------------------
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_descriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments           ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own profile"   ON public.users;
CREATE POLICY "Users can view own profile"
    ON public.users
    FOR SELECT
    USING ( id = auth.uid() );

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
    ON public.users
    FOR UPDATE
    USING ( id = auth.uid() )
    WITH CHECK ( id = auth.uid() );

CREATE POLICY "Allow insert for anyone"
    ON public.users
    FOR INSERT
    TO public
    WITH CHECK (true);


-- ============================================================================
-- RESUMES TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own resumes"   ON public.resumes;
CREATE POLICY "Users can view own resumes"
    ON public.resumes
    FOR SELECT
    USING ( user_id = auth.uid() );

DROP POLICY IF EXISTS "Users can add own resumes"    ON public.resumes;
CREATE POLICY "Users can add own resumes"
    ON public.resumes
    FOR INSERT
    WITH CHECK ( user_id = auth.uid() );

DROP POLICY IF EXISTS "Users can update own resumes" ON public.resumes;
CREATE POLICY "Users can update own resumes"
    ON public.resumes
    FOR UPDATE
    USING ( user_id = auth.uid() )
    WITH CHECK ( user_id = auth.uid() );

DROP POLICY IF EXISTS "Users can delete own resumes" ON public.resumes;
CREATE POLICY "Users can delete own resumes"
    ON public.resumes
    FOR DELETE
    USING ( user_id = auth.uid() );

-- ============================================================================
-- JOB_DESCRIPTIONS TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own JDs"       ON public.job_descriptions;
CREATE POLICY "Users can view own JDs"
    ON public.job_descriptions
    FOR SELECT
    USING ( user_id = auth.uid() );

DROP POLICY IF EXISTS "Users can manage own JDs"     ON public.job_descriptions;
CREATE POLICY "Users can manage own JDs"
    ON public.job_descriptions
    FOR ALL -- INSERT, UPDATE, DELETE
    USING ( user_id = auth.uid() )
    WITH CHECK ( user_id = auth.uid() );

-- ============================================================================
-- INTERVIEWS TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own interviews" ON public.interviews;
CREATE POLICY "Users can view own interviews"
    ON public.interviews
    FOR SELECT
    USING ( user_id = auth.uid() );

DROP POLICY IF EXISTS "Users can schedule own interviews" ON public.interviews;
CREATE POLICY "Users can schedule own interviews"
    ON public.interviews
    FOR INSERT
    WITH CHECK ( user_id = auth.uid() );

-- Updates/deletes are allowed only for owner (adjust as needed)
DROP POLICY IF EXISTS "Users can manage own interviews" ON public.interviews;
CREATE POLICY "Users can manage own interviews"
    ON public.interviews
    FOR UPDATE
    USING ( user_id = auth.uid() );

-- ============================================================================
-- QUESTIONS TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view questions for own interviews" ON public.questions;
CREATE POLICY "Users can view questions for own interviews"
    ON public.questions
    FOR SELECT
    USING ( interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()) );

-- Insert/update/delete restricted; typically administered by backend

-- ============================================================================
-- TRANSCRIPTS TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view transcripts for own interviews" ON public.transcripts;
CREATE POLICY "Users can view transcripts for own interviews"
    ON public.transcripts
    FOR SELECT
    USING ( interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()) );

-- Insert/update handled by backend; deny to clients by omission

-- ============================================================================
-- INTERVIEW_FEEDBACK TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view feedback for own interviews" ON public.interview_feedback;
CREATE POLICY "Users can view feedback for own interviews"
    ON public.interview_feedback
    FOR SELECT
    USING ( interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()) );

-- ============================================================================
-- PAYMENTS TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments"
    ON public.payments
    FOR SELECT
    USING ( user_id = auth.uid() );

-- --------------------------------------------------------------------------------
-- End of file
-- --------------------------------------------------------------------------------
