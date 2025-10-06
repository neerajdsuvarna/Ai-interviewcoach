-- Add coding-related fields to questions table
ALTER TABLE public.questions 
ADD COLUMN requires_code boolean DEFAULT false,
ADD COLUMN code_language text;

-- Add comment for documentation
COMMENT ON COLUMN public.questions.requires_code IS 'Indicates if this question requires coding to answer';
COMMENT ON COLUMN public.questions.code_language IS 'Programming language required for coding questions (python, javascript, java, cpp, sql, etc.)';
