// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Database {
  public: {
    Tables: {
      interviews: {
        Row: {
          id: string
          user_id: string
          resume_id: string
          jd_id: string
          scheduled_at: string
          status: string
          created_at: string
          question_set?: number
          retake_from?: string
          attempt_number: number
        }
        Insert: {
          id?: string
          user_id: string
          resume_id: string
          jd_id: string
          scheduled_at?: string
          status?: string
          created_at?: string
          question_set?: number
          retake_from?: string
          attempt_number?: number
        }
        Update: {
          id?: string
          user_id?: string
          resume_id?: string
          jd_id?: string
          scheduled_at?: string
          status?: string
          created_at?: string
          question_set?: number
          retake_from?: string
          attempt_number?: number
        }
      }
      payments: {
        Row: {
          id: string
          user_id: string
          interview_id?: string
          amount: number
          provider: string
          payment_status: string
          transaction_id: string
          paid_at: string
        }
        Update: {
          id?: string
          user_id?: string
          interview_id?: string
          amount?: number
          provider?: string
          payment_status?: string
          transaction_id?: string
          paid_at?: string
        }
      }
      questions: {
        Row: {
          id: string
          interview_id?: string
          resume_id?: string
          jd_id?: string
          question_text: string
          expected_answer?: string
          difficulty_category: string
          difficulty_experience: string
          requires_code?: boolean
          code_language?: string
          question_set: number
          created_at: string
        }
        Update: {
          id?: string
          interview_id?: string
          resume_id?: string
          jd_id?: string
          question_text?: string
          expected_answer?: string
          difficulty_category?: string
          difficulty_experience?: string
          requires_code?: boolean
          code_language?: string
          question_set?: number
          created_at?: string
        }
      }
    }
  }
}

interface InterviewSetupRequest {
  payment_id: string
  resume_id: string
  jd_id: string
  question_set?: number
  retake_from?: string
}

interface InterviewSetupResponse {
  success: boolean
  data?: {
    interview_id: string
    status: string
    payment_id: string
    resume_id: string
    jd_id: string
    created_at: string
  }
  message?: string
  error?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Method not allowed',
          message: 'Only POST requests are supported' 
        }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

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
          success: false,
          error: 'Unauthorized', 
          message: 'Invalid or missing auth token' 
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('✅ User authenticated:', {
      user_id: user.id,
      email: user.email
    });

    // Parse request body
    const body = await req.json()
    const { payment_id, resume_id, jd_id, question_set, retake_from }: InterviewSetupRequest = body

    // Validate required fields
    if (!payment_id || !resume_id || !jd_id) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Bad request', 
          message: 'payment_id, resume_id, and jd_id are required' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate UUIDs - but payment_id is a Dodo transaction ID, not a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

    // Only validate resume_id and jd_id as UUIDs
    if (!uuidRegex.test(resume_id) || !uuidRegex.test(jd_id)) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Bad request', 
          message: 'resume_id and jd_id must be valid UUIDs' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate payment_id is not empty (but don't require UUID format)
    if (!payment_id || !payment_id.trim()) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Bad request', 
          message: 'payment_id cannot be empty' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('📋 Interview setup request:', {
      payment_id,
      resume_id,
      jd_id,
      question_set,
      user_id: user.id
    });

    // Step 1: Verify payment exists and belongs to user
    console.log('🔍 Step 1: Verifying payment...');
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('transaction_id', payment_id)
      .eq('user_id', user.id)
      .single()

    if (paymentError || !payment) {
      console.error('❌ Payment verification failed:', paymentError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Payment not found', 
          message: 'Payment not found or you do not have access to it' 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('✅ Payment verified:', {
      payment_id: payment.id,
      amount: payment.amount,
      status: payment.payment_status,
      existing_interview_id: payment.interview_id // ← Check if interview already exists
    });

    // ✅ NEW: Check if interview already exists for this payment
    if (payment.interview_id) {
      console.log('🔍 Interview already exists for this payment, checking details...');
      
      const { data: existingInterview, error: interviewCheckError } = await supabaseClient
        .from('interviews')
        .select('*')
        .eq('id', payment.interview_id)
        .eq('user_id', user.id)
        .single()
      
      if (existingInterview && !interviewCheckError) {
        console.log('✅ Existing interview found:', {
          interview_id: existingInterview.id,
          status: existingInterview.status,
          created_at: existingInterview.created_at
        });
        
        // Return existing interview data
        const response: InterviewSetupResponse = {
          success: true,
          data: {
            interview_id: existingInterview.id,
            status: existingInterview.status,
            payment_id: payment_id,
            resume_id: existingInterview.resume_id,
            jd_id: existingInterview.jd_id,
            created_at: existingInterview.created_at
          },
          message: 'Interview already exists for this payment'
        };
        
        console.log(' Returning existing interview:', response.data);
        
        return new Response(
          JSON.stringify(response),
          {
            status: 200, // Use 200 instead of 201 since it's not new
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
    }

    // ✅ NEW: Check if there's already an interview with STARTED status for this user/resume/jd combination
    console.log('🔍 Checking for existing interview with same resume/jd...');
    const { data: existingInterview, error: existingInterviewError } = await supabaseClient
      .from('interviews')
      .select('*')
      .eq('user_id', user.id)
      .eq('resume_id', resume_id)
      .eq('jd_id', jd_id)
      .eq('status', 'STARTED')
      .single()

    if (existingInterview && !existingInterviewError) {
      console.log('⚠️ Found existing STARTED interview for same resume/jd:', {
        interview_id: existingInterview.id,
        status: existingInterview.status,
        created_at: existingInterview.created_at
      });
      
      // Update payment with existing interview_id
      const { error: paymentUpdateError } = await supabaseClient
        .from('payments')
        .update({ interview_id: existingInterview.id })
        .eq('transaction_id', payment_id)
      
      if (paymentUpdateError) {
        console.error('❌ Failed to update payment with existing interview_id:', paymentUpdateError);
      } else {
        console.log('✅ Updated payment with existing interview_id');
      }
      
      // Return existing interview data
      const response: InterviewSetupResponse = {
        success: true,
        data: {
          interview_id: existingInterview.id,
          status: existingInterview.status,
          payment_id: payment_id,
          resume_id: existingInterview.resume_id,
          jd_id: existingInterview.jd_id,
          created_at: existingInterview.created_at
        },
        message: 'Using existing interview for this resume/job description'
      };
      
      console.log(' Returning existing interview:', response.data);
      
      return new Response(
        JSON.stringify(response),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Step 2: Verify resume belongs to user
    console.log('🔍 Step 2: Verifying resume...');
    const { data: resume, error: resumeError } = await supabaseClient
      .from('resumes')
      .select('id')
      .eq('id', resume_id)
      .eq('user_id', user.id)
      .single()

    if (resumeError || !resume) {
      console.error('❌ Resume verification failed:', resumeError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Resume not found', 
          message: 'Resume not found or you do not have access to it' 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('✅ Resume verified:', { resume_id: resume.id });

    // Step 3: Verify job description belongs to user
    console.log('🔍 Step 3: Verifying job description...');
    const { data: jobDescription, error: jdError } = await supabaseClient
      .from('job_descriptions')
      .select('id')
      .eq('id', jd_id)
      .eq('user_id', user.id)
      .single()

    if (jdError || !jobDescription) {
      console.error('❌ Job description verification failed:', jdError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Job description not found', 
          message: 'Job description not found or you do not have access to it' 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('✅ Job description verified:', { jd_id: jobDescription.id });

    // Step 4: Create interview record (only if no existing interview found)
    console.log('🔍 Step 4: Creating new interview record...');
    
    // Handle retake logic
    let attemptNumber = 1;
    if (retake_from) {
      console.log('🔄 Processing retake interview...');
      
      // Get current attempt count for this question set
      const { data: currentAttempts, error: attemptsError } = await supabaseClient
        .from('interviews')
        .select('attempt_number')
        .eq('user_id', user.id)
        .eq('resume_id', resume_id)
        .eq('jd_id', jd_id)
        .eq('question_set', question_set)

      if (attemptsError) {
        console.error('❌ Error fetching current attempts:', attemptsError);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Database error', 
            message: 'Failed to check current attempts' 
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      attemptNumber = (currentAttempts?.length || 0) + 1;
      console.log(`📊 Retake attempt number: ${attemptNumber}`);
    }
    
    const { data: newInterview, error: interviewError } = await supabaseClient
      .from('interviews')
      .insert({
        user_id: user.id,
        resume_id: resume_id,
        jd_id: jd_id,
        status: 'STARTED',
        scheduled_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        ...(typeof question_set === 'number' ? { question_set } : {}),
        ...(retake_from ? { retake_from, attempt_number: attemptNumber } : {})
      } as any)
      .select()
      .single()

    if (interviewError || !newInterview) {
      console.error('❌ Interview creation failed:', interviewError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Database error', 
          message: 'Failed to create interview record' 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('✅ New interview created:', {
      interview_id: newInterview.id,
      status: newInterview.status
    });

    // Step 5: Update payment with interview_id
    console.log('🔍 Step 5: Updating payment with interview_id...');
    const { error: paymentUpdateError } = await supabaseClient
      .from('payments')
      .update({ interview_id: newInterview.id })
      .eq('transaction_id', payment_id)

    if (paymentUpdateError) {
      console.error('❌ Payment update failed:', paymentUpdateError);
      console.warn('⚠️ Payment update failed, but interview was created');
    } else {
      console.log('✅ Payment updated with interview_id');
    }

    // Step 6: Update questions with interview_id
    console.log('🔍 Step 6: Updating questions with interview_id...');
    let updateQuery = supabaseClient
      .from('questions')
      .update({ interview_id: newInterview.id })
      .eq('resume_id', resume_id)
      .eq('jd_id', jd_id)
      .is('interview_id', null) // Only update questions that don't have interview_id
    if (typeof question_set === 'number') {
      updateQuery = updateQuery.eq('question_set', question_set)
    }
    const { error: questionsUpdateError } = await updateQuery

    if (questionsUpdateError) {
      console.error('❌ Questions update failed:', questionsUpdateError);
      console.warn('⚠️ Questions update failed, but interview was created');
    } else {
      console.log('✅ Questions updated with interview_id');
    }

    // Step 7: Return success response
    const response: InterviewSetupResponse = {
      success: true,
      data: {
        interview_id: newInterview.id,
        status: newInterview.status,
        payment_id: payment_id,
        resume_id: resume_id,
        jd_id: jd_id,
        created_at: newInterview.created_at
      },
      message: 'Interview setup completed successfully'
    };

    console.log('🎉 Interview setup completed successfully:', response.data);

    return new Response(
      JSON.stringify(response),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('💥 Interview setup error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/interview-setup' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json' \
    --data '{
      "payment_id": "PAYMENT_UUID",
      "resume_id": "RESUME_UUID", 
      "jd_id": "JD_UUID"
    }'

  Expected Response:
  {
    "success": true,
    "data": {
      "interview_id": "INTERVIEW_UUID",
      "status": "STARTED",
      "payment_id": "PAYMENT_UUID",
      "resume_id": "RESUME_UUID",
      "jd_id": "JD_UUID",
      "created_at": "2024-01-15T10:00:00Z"
    },
    "message": "Interview setup completed successfully"
  }

*/