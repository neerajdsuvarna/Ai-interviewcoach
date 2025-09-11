import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

interface Database {
  public: {
    Tables: {
      interviews: {
        Row: {
          id: string
          user_id: string
          resume_id: string | null
          jd_id: string | null
          status?: string
          question_set?: number
          retake_from?: string
          attempt_number: number
          scheduled_at: string
          created_at: string
          updated_at: string
        }
      }
      payments: {
        Row: {
          id: string
          user_id: string
          interview_id: string
          amount: number
          provider: string
          payment_status: string
          transaction_id: string
          paid_at: string
        }
      }
    }
  }
}

serve(async (req) => {
  console.log('Request method:', req.method)
  console.log('Request URL:', req.url)
  console.log('Request headers:', Object.fromEntries(req.headers.entries()))

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request')
    return new Response('ok', { 
      status: 200, 
      headers: corsHeaders 
    })
  }

  try {
    // Create Supabase client with the user's auth token
    const supabaseClient = createClient<Database>(
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

    console.log('Authenticated user:', user.id, user.email)

    // Fetch user's interviews
    const { data: interviews, error: interviewsError } = await supabaseClient
      .from('interviews')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (interviewsError) {
      console.error('Error fetching interviews:', interviewsError)
      return new Response(
        JSON.stringify({ 
          error: 'Database error', 
          message: 'Failed to fetch interviews' 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Fetch user's payments
    const { data: payments, error: paymentsError } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('user_id', user.id)
      .order('paid_at', { ascending: false })

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError)
      return new Response(
        JSON.stringify({ 
          error: 'Database error', 
          message: 'Failed to fetch payments' 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Format the response data according to your training article
    const userData = {
      // Basic Information
      name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
      email: user.email || '',
      userId: user.id,
      isAuthenticated: true,
      
      // Account Summary
      totalPayments: payments?.length || 0,
      totalInterviews: interviews?.length || 0,
      startedInterviews: (interviews || []).filter(interview => interview.status === 'STARTED').length,
      endedInterviews: (interviews || []).filter(interview => interview.status === 'ENDED').length,
      
      // Payment Information
      allPayments: (payments || []).map(payment => ({
        id: payment.id,
        amount: payment.amount,
        status: payment.payment_status,
        date: payment.paid_at,
        transactionId: payment.transaction_id,
        currency: 'USD' // Default currency as mentioned in your article
      })),
      latestPayment: (payments && payments.length > 0) ? {
        id: payments[0].id,
        amount: payments[0].amount,
        status: payments[0].payment_status,
        date: payments[0].paid_at,
        transactionId: payments[0].transaction_id,
        currency: 'USD'
      } : null,
      
      // Interview Information
      allInterviews: (interviews || []).map(interview => ({
        id: interview.id,
        status: interview.status || 'CREATED',
        date: interview.created_at,
        resumeId: interview.resume_id,
        jdId: interview.jd_id,
        feedback: null // This would need to be fetched from interview_feedback table if it exists
      })),
      latestInterview: (interviews && interviews.length > 0) ? {
        id: interviews[0].id,
        status: interviews[0].status || 'CREATED',
        date: interviews[0].created_at,
        resumeId: interviews[0].resume_id,
        jdId: interviews[0].jd_id
      } : null,
      currentInterview: (interviews || []).find(interview => interview.status === 'STARTED') || null
    }

    console.log('Returning comprehensive user data:', userData)

    return new Response(
      JSON.stringify(userData),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in helpjam-user-data function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
