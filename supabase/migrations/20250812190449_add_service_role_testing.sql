-- Add service role access for testing
CREATE POLICY "Service role can manage all resumes"
    ON public.resumes
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
