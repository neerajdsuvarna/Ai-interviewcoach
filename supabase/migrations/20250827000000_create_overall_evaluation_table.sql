-- Create overall_evaluation table to store performance trend analysis results
CREATE TABLE public.overall_evaluation (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    analysis_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Add comment for documentation
COMMENT ON TABLE public.overall_evaluation IS 'Stores overall performance trend analysis results for users, including metrics, trends, insights, and recommendations';
COMMENT ON COLUMN public.overall_evaluation.analysis_data IS 'JSON data containing complete analysis output: success, total_interviews, numeric_trends, llm_insights, summary (with latest_interview_metrics, average_metrics_across_all_interviews, trend_analysis, performance_insights, focus_areas)';

-- Add index for performance (querying by user_id and created_at)
CREATE INDEX idx_overall_evaluation_user_id ON public.overall_evaluation(user_id);
CREATE INDEX idx_overall_evaluation_created_at ON public.overall_evaluation(created_at DESC);
CREATE INDEX idx_overall_evaluation_user_created ON public.overall_evaluation(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.overall_evaluation ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- OVERALL_EVALUATION TABLE POLICIES
-- ============================================================================

-- Users can view their own evaluations
DROP POLICY IF EXISTS "Users can view own evaluations" ON public.overall_evaluation;
CREATE POLICY "Users can view own evaluations"
    ON public.overall_evaluation
    FOR SELECT
    USING ( user_id = auth.uid() );

-- Users can create their own evaluations
DROP POLICY IF EXISTS "Users can create own evaluations" ON public.overall_evaluation;
CREATE POLICY "Users can create own evaluations"
    ON public.overall_evaluation
    FOR INSERT
    WITH CHECK ( user_id = auth.uid() );

-- Users can update their own evaluations
DROP POLICY IF EXISTS "Users can update own evaluations" ON public.overall_evaluation;
CREATE POLICY "Users can update own evaluations"
    ON public.overall_evaluation
    FOR UPDATE
    USING ( user_id = auth.uid() )
    WITH CHECK ( user_id = auth.uid() );

-- Users can delete their own evaluations
DROP POLICY IF EXISTS "Users can delete own evaluations" ON public.overall_evaluation;
CREATE POLICY "Users can delete own evaluations"
    ON public.overall_evaluation
    FOR DELETE
    USING ( user_id = auth.uid() );
