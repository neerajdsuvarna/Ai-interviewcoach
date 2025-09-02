-- Add interview retake fields to interviews table
-- This enables users to retake interviews with the same question set

-- Add question_set field to link interviews with specific question sets
ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS question_set integer;

-- Add retake_from field to reference the original interview for retakes
ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS retake_from uuid REFERENCES public.interviews(id);

-- Add attempt_number field to track how many times a user has attempted the same question set
ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS attempt_number integer DEFAULT 1;

-- Add comments for documentation
COMMENT ON COLUMN public.interviews.question_set IS 'Question set number that this interview uses (links to questions table)';
COMMENT ON COLUMN public.interviews.retake_from IS 'Reference to original interview if this is a retake attempt';
COMMENT ON COLUMN public.interviews.attempt_number IS 'Attempt number for this question set (1 for first attempt, 2+ for retakes)';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_interviews_retake_from ON public.interviews(retake_from);
CREATE INDEX IF NOT EXISTS idx_interviews_question_set ON public.interviews(question_set);
CREATE INDEX IF NOT EXISTS idx_interviews_attempt_chain ON public.interviews(retake_from, attempt_number);
CREATE INDEX IF NOT EXISTS idx_interviews_question_set_attempt ON public.interviews(question_set, attempt_number);

-- Add constraint to ensure attempt_number is always positive
ALTER TABLE public.interviews 
ADD CONSTRAINT check_attempt_number_positive CHECK (attempt_number > 0);

-- Add constraint to ensure retake_from is not self-referencing
ALTER TABLE public.interviews 
ADD CONSTRAINT check_retake_from_not_self CHECK (retake_from != id);
