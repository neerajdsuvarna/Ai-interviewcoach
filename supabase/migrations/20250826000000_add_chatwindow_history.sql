-- Create chatwindow_history table for simple conversation storage
CREATE TABLE public.chatwindow_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Add index for performance
CREATE INDEX idx_chatwindow_history_interview_id ON public.chatwindow_history(interview_id);

-- Enable RLS
ALTER TABLE public.chatwindow_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view chat history for own interviews"
    ON public.chatwindow_history
    FOR SELECT
    USING ( interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()) );

CREATE POLICY "Users can insert chat history for own interviews"
    ON public.chatwindow_history
    FOR INSERT
    WITH CHECK ( interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()) );

CREATE POLICY "Users can update chat history for own interviews"
    ON public.chatwindow_history
    FOR UPDATE
    USING ( interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()) )
    WITH CHECK ( interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()) );

CREATE POLICY "Users can delete chat history for own interviews"
    ON public.chatwindow_history
    FOR DELETE
    USING ( interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()) );

-- Add comment for documentation
COMMENT ON TABLE public.chatwindow_history IS 'Stores chat window conversation history for interviews';
COMMENT ON COLUMN public.chatwindow_history.content IS 'The conversation content in format: user:message\nassistant:response';
