-- Add evaluation field to transcripts table
ALTER TABLE public.transcripts 
ADD COLUMN IF NOT EXISTS evaluation_data jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.transcripts.evaluation_data IS 'JSON data containing interview evaluation results and performance metrics';