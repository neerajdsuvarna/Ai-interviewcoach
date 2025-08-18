-- Apply RLS policies for interview_feedback table to fix INSERT/UPDATE/DELETE permissions
-- This fixes the "new row violates row-level security policy" error

-- First, check if the policies already exist and drop them if they do
DROP POLICY IF EXISTS "Users can create feedback for own interviews" ON public.interview_feedback;
DROP POLICY IF EXISTS "Users can update feedback for own interviews" ON public.interview_feedback;  
DROP POLICY IF EXISTS "Users can delete feedback for own interviews" ON public.interview_feedback;

-- Allow users to create feedback for their own interviews
CREATE POLICY "Users can create feedback for own interviews"
    ON public.interview_feedback
    FOR INSERT
    WITH CHECK ( interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()) );

-- Allow users to update feedback for their own interviews
CREATE POLICY "Users can update feedback for own interviews"
    ON public.interview_feedback
    FOR UPDATE
    USING ( interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()) )
    WITH CHECK ( interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()) );

-- Allow users to delete feedback for their own interviews
CREATE POLICY "Users can delete feedback for own interviews"
    ON public.interview_feedback
    FOR DELETE
    USING ( interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()) );
