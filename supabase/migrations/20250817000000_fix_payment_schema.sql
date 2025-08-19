-- Fix payment and interview schema for Dodo payment flow

-- Add status column to interviews table
ALTER TABLE public.interviews 
ADD COLUMN status text DEFAULT 'created';

-- Add created_at column to interviews table
ALTER TABLE public.interviews 
ADD COLUMN created_at timestamp with time zone DEFAULT now();

-- Make interview_id optional in payments table
ALTER TABLE public.payments 
ALTER COLUMN interview_id DROP NOT NULL;

-- Make user_id optional in payments table (for webhook processing)
ALTER TABLE public.payments 
ALTER COLUMN user_id DROP NOT NULL;

-- Add metadata column to payments table
ALTER TABLE public.payments 
ADD COLUMN metadata jsonb;

-- Add indexes for better performance
CREATE INDEX idx_payments_transaction_id ON public.payments(transaction_id);
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_interviews_user_id ON public.interviews(user_id);
