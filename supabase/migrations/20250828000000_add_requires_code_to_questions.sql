-- -----------------------------------------------------------------------------
-- 2025_08_28_add_requires_code_to_questions.sql
-- -----------------------------------------------------------------------------
-- Purpose  : Add `requires_code` boolean field to questions table
--            to indicate if a question requires coding/implementation
-- -----------------------------------------------------------------------------

BEGIN;

-- Add requires_code column to questions table
ALTER TABLE public.questions
    ADD COLUMN IF NOT EXISTS requires_code boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.questions.requires_code IS 'Indicates if the question requires coding/implementation (true) or is theory-based (false)';

COMMIT;

-- -----------------------------------------------------------------------------
-- End of file
-- -----------------------------------------------------------------------------
