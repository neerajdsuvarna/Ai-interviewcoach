-- -----------------------------------------------------------------------------
-- 2025_08_06_3_update-questions-table.sql
-- -----------------------------------------------------------------------------
-- Purpose  : Introduce `difficulty_category` and `difficulty_experience` columns
--            to the `public.questions` table and remove the obsolete
--            `difficulty_level` column.
-- Author   : ChatGPT auto-generated migration (2025-08-06)
-- -----------------------------------------------------------------------------

BEGIN;

-- 1. Add new columns with sensible defaults so inserts/updates continue to work
-- ALTER TABLE public.questions
--     ADD COLUMN IF NOT EXISTS difficulty_category    text NOT NULL DEFAULT 'medium',
--     ADD COLUMN IF NOT EXISTS difficulty_experience  text NOT NULL DEFAULT 'beginner';

-- -- 2. Migrate any existing data from `difficulty_level` into the new schema
-- UPDATE public.questions
-- SET    difficulty_category = difficulty_level
-- WHERE  difficulty_level IS NOT NULL;

-- -- 3. Drop the old column now that data has been migrated (optional but recommended)
-- ALTER TABLE public.questions
--     DROP COLUMN IF EXISTS difficulty_level;
ALTER TABLE public.questions
    ADD COLUMN difficulty_category text CHECK (difficulty_category IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
    ADD COLUMN difficulty_experience text CHECK (difficulty_experience IN ('beginner', 'intermediate', 'expert')) DEFAULT 'beginner';

-- Optional: Drop the old column if not needed anymore
ALTER TABLE public.questions DROP COLUMN difficulty_level;


COMMIT;

-- -----------------------------------------------------------------------------
-- End of file
-- -----------------------------------------------------------------------------
