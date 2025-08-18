-- -----------------------------------------------------------------------------
-- Add INSERT policy for payments table
-- -----------------------------------------------------------------------------
-- Purpose  : Add missing INSERT policy for payments table to allow users
--            to create payment records for their own interviews
-- -----------------------------------------------------------------------------

-- Add INSERT policy for payments table
DROP POLICY IF EXISTS "Users can create own payments" ON public.payments;
CREATE POLICY "Users can create own payments"
    ON public.payments
    FOR INSERT
    WITH CHECK ( user_id = auth.uid() );

-- Also add UPDATE and DELETE policies for completeness
DROP POLICY IF EXISTS "Users can update own payments" ON public.payments;
CREATE POLICY "Users can update own payments"
    ON public.payments
    FOR UPDATE
    USING ( user_id = auth.uid() )
    WITH CHECK ( user_id = auth.uid() );

DROP POLICY IF EXISTS "Users can delete own payments" ON public.payments;
CREATE POLICY "Users can delete own payments"
    ON public.payments
    FOR DELETE
    USING ( user_id = auth.uid() );
