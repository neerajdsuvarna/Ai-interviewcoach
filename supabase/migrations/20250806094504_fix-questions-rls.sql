-- -----------------------------------------------------------------------------
-- Fix questions table RLS policy to allow INSERT operations
-- Purpose: Allow users to insert questions even when interview_id is NULL
-- -----------------------------------------------------------------------------

BEGIN;

-- Add INSERT policy for questions table
-- Allow users to insert questions for their own interviews OR when interview_id is null
DROP POLICY IF EXISTS "Users can add questions for own interviews" ON public.questions;
CREATE POLICY "Users can add questions for own interviews"
    ON public.questions
    FOR INSERT
    WITH CHECK (
        -- Allow if interview_id belongs to user's interview
        (interview_id IS NOT NULL AND interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()))
        OR
        -- Allow if no interview_id but resume_id and jd_id belong to user
        (interview_id IS NULL AND 
         resume_id IN (SELECT id FROM public.resumes WHERE user_id = auth.uid()) AND
         jd_id IN (SELECT id FROM public.job_descriptions WHERE user_id = auth.uid()))
    );

-- Add UPDATE policy for questions table  
DROP POLICY IF EXISTS "Users can update questions for own interviews" ON public.questions;
CREATE POLICY "Users can update questions for own interviews"
    ON public.questions
    FOR UPDATE
    USING (
        (interview_id IS NOT NULL AND interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()))
        OR
        (interview_id IS NULL AND 
         resume_id IN (SELECT id FROM public.resumes WHERE user_id = auth.uid()) AND
         jd_id IN (SELECT id FROM public.job_descriptions WHERE user_id = auth.uid()))
    )
    WITH CHECK (
        (interview_id IS NOT NULL AND interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()))
        OR
        (interview_id IS NULL AND 
         resume_id IN (SELECT id FROM public.resumes WHERE user_id = auth.uid()) AND
         jd_id IN (SELECT id FROM public.job_descriptions WHERE user_id = auth.uid()))
    );

-- Update the existing SELECT policy to also allow access to questions without interview_id
DROP POLICY IF EXISTS "Users can view questions for own interviews" ON public.questions;
CREATE POLICY "Users can view questions for own interviews"
    ON public.questions
    FOR SELECT
    USING (
        (interview_id IS NOT NULL AND interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()))
        OR
        (interview_id IS NULL AND 
         resume_id IN (SELECT id FROM public.resumes WHERE user_id = auth.uid()) AND
         jd_id IN (SELECT id FROM public.job_descriptions WHERE user_id = auth.uid()))
    );

COMMIT;
