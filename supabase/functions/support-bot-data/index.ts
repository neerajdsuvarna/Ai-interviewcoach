// Support Bot Data Retrieval Function
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

interface UserData {
  user_info: {
    id: string
    email: string
    full_name?: string
    plan: string
    created_at: string
  }
  payments: Array<{
    id: string
    amount: number
    provider: string
    payment_status: string
    transaction_id: string
    paid_at: string
    interview_id: string
  }>
  interviews: Array<{
    id: string
    status: string
    scheduled_at: string
    created_at: string
    resume_name?: string
    job_title?: string
    attempt_number: number
    question_set?: number
    retake_from?: string
  }>
  resumes: Array<{
    id: string
    file_name: string
    uploaded_at: string
  }>
  job_descriptions: Array<{
    id: string
    title: string
    created_at: string
  }>
  interview_feedback: Array<{
    id: string
    interview_id: string
    summary?: string
    key_strengths?: string
    improvement_areas?: string
    created_at: string
  }>
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with the user's auth token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized', 
          message: 'Invalid or missing auth token' 
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`�� Fetching support bot data for: ${user.email}`)

    // Fetch all user data in parallel for better performance
    const [
      paymentsResult,
      interviewsResult,
      resumesResult,
      jobDescriptionsResult,
      feedbackResult
    ] = await Promise.allSettled([
      // Fetch payments
      supabaseClient
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .order('paid_at', { ascending: false })
        .limit(10), // Last 10 payments

      // Fetch interviews with related data
      supabaseClient
        .from('interviews')
        .select(`
          *,
          resumes(file_name),
          job_descriptions(title)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20), // Last 20 interviews

      // Fetch resumes
      supabaseClient
        .from('resumes')
        .select('id, file_name, uploaded_at')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false }),

      // Fetch job descriptions
      supabaseClient
        .from('job_descriptions')
        .select('id, title, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      // Fetch interview feedback
      supabaseClient
        .from('interview_feedback')
        .select(`
          id, interview_id, summary, key_strengths, improvement_areas, created_at,
          interviews!inner(user_id)
        `)
        .eq('interviews.user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10) // Last 10 feedback entries
    ])

    // Process results and handle errors
    const payments = paymentsResult.status === 'fulfilled' && paymentsResult.value.data 
      ? paymentsResult.value.data 
      : []

    const interviews = interviewsResult.status === 'fulfilled' && interviewsResult.value.data
      ? interviewsResult.value.data.map(interview => ({
          id: interview.id,
          status: interview.status,
          scheduled_at: interview.scheduled_at,
          created_at: interview.created_at,
          resume_name: interview.resumes?.file_name || 'Unknown Resume',
          job_title: interview.job_descriptions?.title || 'Unknown Job',
          attempt_number: interview.attempt_number || 1,
          question_set: interview.question_set,
          retake_from: interview.retake_from
        }))
      : []

    const resumes = resumesResult.status === 'fulfilled' && resumesResult.value.data
      ? resumesResult.value.data
      : []

    const jobDescriptions = jobDescriptionsResult.status === 'fulfilled' && jobDescriptionsResult.value.data
      ? jobDescriptionsResult.value.data
      : []

    const interviewFeedback = feedbackResult.status === 'fulfilled' && feedbackResult.value.data
      ? feedbackResult.value.data
      : []

    // Prepare user data response
    const userData: UserData = {
      user_info: {
        id: user.id,
        email: user.email || 'No email',
        full_name: user.user_metadata?.full_name || 'No name provided',
        plan: 'basic', // Default plan, you can fetch this from users table if needed
        created_at: user.created_at || 'Unknown'
      },
      payments,
      interviews,
      resumes,
      job_descriptions: jobDescriptions,
      interview_feedback: interviewFeedback
    }

    console.log(`✅ Successfully fetched support bot data:`, {
      payments: payments.length,
      interviews: interviews.length,
      resumes: resumes.length,
      jobDescriptions: jobDescriptions.length,
      feedback: interviewFeedback.length
    })

    return new Response(
      JSON.stringify({
        success: true,
        data: userData,
        message: 'Support bot data retrieved successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('❌ Error fetching support bot data:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: 'An unexpected error occurred while fetching support bot data' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
