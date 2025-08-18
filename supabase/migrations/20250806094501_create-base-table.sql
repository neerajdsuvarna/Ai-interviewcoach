-- Users table
CREATE TABLE public.users (
    id uuid PRIMARY KEY NOT NULL,
    email text NOT NULL UNIQUE,
    full_name text NOT NULL,
    plan text NOT NULL DEFAULT 'basic',
    created_at timestamp with time zone DEFAULT now()
);

-- Resumes table
CREATE TABLE public.resumes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    file_url text NOT NULL,
    file_name text NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now()
);

-- Job Descriptions table
CREATE TABLE public.job_descriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text NOT NULL,
    file_url text,
    created_at timestamp with time zone DEFAULT now()
);

-- Interviews table
CREATE TABLE public.interviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    resume_id uuid REFERENCES public.resumes(id) ON DELETE SET NULL,
    jd_id uuid REFERENCES public.job_descriptions(id) ON DELETE SET NULL,
    scheduled_at timestamp with time zone DEFAULT now()
);

-- Questions table
CREATE TABLE public.questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id uuid REFERENCES public.interviews(id) ON DELETE CASCADE,
    resume_id uuid REFERENCES public.resumes(id) ON DELETE SET NULL,
    jd_id uuid REFERENCES public.job_descriptions(id) ON DELETE SET NULL,
    question_text text NOT NULL,
    expected_answer text,
    difficulty_level text NOT NULL DEFAULT 'medium',
    question_set integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Transcripts table
CREATE TABLE public.transcripts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id uuid NOT NULL UNIQUE REFERENCES public.interviews(id) ON DELETE CASCADE,
    full_transcript text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Interview Feedback table
CREATE TABLE public.interview_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id uuid NOT NULL UNIQUE REFERENCES public.interviews(id) ON DELETE CASCADE,
    key_strengths text,
    improvement_areas text,
    summary text,
    audio_url text,
    created_at timestamp with time zone DEFAULT now()
);

-- Payments table
CREATE TABLE public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
    amount numeric(12,2) NOT NULL,
    provider text NOT NULL DEFAULT 'dodo',
    payment_status text NOT NULL DEFAULT 'success',
    transaction_id text NOT NULL,
    paid_at timestamp with time zone DEFAULT now()
);
