-- Add metrics field to interview_feedback table
ALTER TABLE public.interview_feedback 
ADD COLUMN IF NOT EXISTS metrics jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.interview_feedback.metrics IS 'JSON data containing interview performance metrics including knowledge_depth, communication_clarity, confidence_tone, reasoning_ability, relevance_to_question, motivation_indicator, overall_emotion, and overall_emotion_summary';