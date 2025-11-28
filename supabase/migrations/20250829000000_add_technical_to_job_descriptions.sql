-- -----------------------------------------------------------------------------
-- 2025_08_29_add_technical_to_job_descriptions.sql
-- -----------------------------------------------------------------------------
-- Purpose  : Add `technical` boolean field to job_descriptions table
--            to indicate if a job description is for a technical role (TRUE)
--            or non-technical role (FALSE)
-- -----------------------------------------------------------------------------

BEGIN;

-- Add technical column to job_descriptions table
ALTER TABLE public.job_descriptions
    ADD COLUMN IF NOT EXISTS technical boolean NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.job_descriptions.technical IS 'Indicates if the job description is for a technical role (true) or non-technical role (false). Defaults to true for backward compatibility.';

COMMIT;

-- -----------------------------------------------------------------------------
-- End of file
-- -----------------------------------------------------------------------------