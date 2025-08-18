-- Drop users table and use auth.users instead
-- This migration removes the custom users table and updates all references to use Supabase auth.users

-- Drop all foreign key constraints that reference the users table
ALTER TABLE public.resumes DROP CONSTRAINT IF EXISTS resumes_user_id_fkey;
ALTER TABLE public.job_descriptions DROP CONSTRAINT IF EXISTS job_descriptions_user_id_fkey;
ALTER TABLE public.interviews DROP CONSTRAINT IF EXISTS interviews_user_id_fkey;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey;

-- Drop the users table
DROP TABLE IF EXISTS public.users CASCADE;

-- Add new foreign key constraints referencing auth.users
ALTER TABLE public.resumes 
    ADD CONSTRAINT resumes_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.job_descriptions 
    ADD CONSTRAINT job_descriptions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.interviews 
    ADD CONSTRAINT interviews_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.payments 
    ADD CONSTRAINT payments_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS policies to work with auth.users instead of public.users
-- Note: All policies will now use auth.uid() which is the same as the user's id in auth.users

-- Drop old users table policies (table no longer exists)
-- These will be automatically dropped when the table is dropped

-- Update existing policies are already using auth.uid() so they should continue to work

-- Grant necessary permissions for the auth schema
-- This allows our functions to access auth.users table
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT SELECT ON auth.users TO anon, authenticated;

-- Add comment explaining the change
COMMENT ON CONSTRAINT resumes_user_id_fkey ON public.resumes IS 'References auth.users table instead of public.users';
COMMENT ON CONSTRAINT job_descriptions_user_id_fkey ON public.job_descriptions IS 'References auth.users table instead of public.users';
COMMENT ON CONSTRAINT interviews_user_id_fkey ON public.interviews IS 'References auth.users table instead of public.users';
COMMENT ON CONSTRAINT payments_user_id_fkey ON public.payments IS 'References auth.users table instead of public.users';
