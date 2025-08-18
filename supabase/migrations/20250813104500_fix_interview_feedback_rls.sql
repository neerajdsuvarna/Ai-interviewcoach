-- Fix RLS policies for interview_feedback table
-- Add missing INSERT, UPDATE, and DELETE policies

-- ============================================================================
-- INTERVIEW_FEEDBACK TABLE POLICIES (COMPLETE SET)
-- ============================================================================

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
