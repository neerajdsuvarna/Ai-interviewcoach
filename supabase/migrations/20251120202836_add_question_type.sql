BEGIN;

ALTER TABLE public.questions
    ADD COLUMN q_type text;

COMMIT;