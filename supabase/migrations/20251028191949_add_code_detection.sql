BEGIN;

ALTER TABLE public.questions
    ADD COLUMN requires_code boolean,
    ADD COLUMN code_language text;


COMMIT;