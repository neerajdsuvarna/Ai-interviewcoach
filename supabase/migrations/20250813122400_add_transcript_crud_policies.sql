-- Add missing RLS policies for transcripts table to enable CRUD operations
-- This allows authenticated users to perform full CRUD operations on transcripts for their own interviews

-- DROP existing policies if they exist
DROP POLICY IF EXISTS "Users can insert transcripts for own interviews" ON public.transcripts;
DROP POLICY IF EXISTS "Users can update transcripts for own interviews" ON public.transcripts;
DROP POLICY IF EXISTS "Users can delete transcripts for own interviews" ON public.transcripts;

-- INSERT policy: Users can create transcripts for their own interviews
CREATE POLICY "Users can insert transcripts for own interviews"
    ON public.transcripts
    FOR INSERT
    WITH CHECK ( interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()) );

-- UPDATE policy: Users can update transcripts for their own interviews
CREATE POLICY "Users can update transcripts for own interviews"
    ON public.transcripts
    FOR UPDATE
    USING ( interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()) )
    WITH CHECK ( interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()) );

-- DELETE policy: Users can delete transcripts for their own interviews
CREATE POLICY "Users can delete transcripts for own interviews"
    ON public.transcripts
    FOR DELETE
    USING ( interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()) );
