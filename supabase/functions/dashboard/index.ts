// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Database {
  public: {
    Tables: {
      resumes: {
        Row: {
          id: string
          user_id: string
          file_url: string
          file_name: string
          uploaded_at: string
        }
      }
      job_descriptions: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string
          file_url: string | null
          technical: boolean
          created_at: string
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
          question_set: number
          created_at: string
        }
      }
      interviews: {
        Row: {
          id: string
          user_id: string
          resume_id: string
          jd_id: string
          status: string
          question_set?: number
          retake_from?: string
          attempt_number: number
          scheduled_at: string
          created_at: string
          updated_at: string
        }
      }
    }
  }
}

interface DashboardPairing {
  id: string
  resume_id: string
  jd_id: string
  resumeName: string
  resumeUrl: string
  jobTitle: string
  jobDescription: string
  technical: boolean
  questionSets: Array<{
    id: string
    questionSetNumber: number
    hasQuestions: boolean
    hasSummary: boolean
    interviews: Array<{
      id: string
      attempt_number: number
      status: string
      scheduled_at: string
      can_retake: boolean
      retake_from?: string
    }>
    total_attempts: number
    best_score?: number
  }>
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse URL first to check for health endpoint
    const url = new URL(req.url)
    
    // Add health check endpoint (no auth required)
    if (url.pathname.endsWith('/health')) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Dashboard function is working!',
          timestamp: new Date().toISOString()
        }),
        {
          status: 200,
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
          error: 'Unauthorized', 
          message: 'Invalid or missing auth token' 
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await handleGetDashboardData(supabaseClient, user)
      
      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: 'An unexpected error occurred' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

async function handleGetDashboardData(supabaseClient: any, user: any) {
  try {
    // Fetch user's resumes
    const { data: resumes, error: resumesError } = await supabaseClient
      .from('resumes')
      .select('*')
      .eq('user_id', user.id)
      .order('uploaded_at', { ascending: false })

    if (resumesError) {
      console.error('Error fetching resumes:', resumesError)
      return new Response(
        JSON.stringify({ 
          error: 'Database error', 
          message: 'Failed to fetch resumes' 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Fetch user's job descriptions
    const { data: jobDescriptions, error: jdError } = await supabaseClient
      .from('job_descriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (jdError) {
      console.error('Error fetching job descriptions:', jdError)
      return new Response(
        JSON.stringify({ 
          error: 'Database error', 
          message: 'Failed to fetch job descriptions' 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create pairings from resumes and job descriptions
    const pairings: DashboardPairing[] = []
    
    for (const resume of resumes) {
      for (const jd of jobDescriptions) {
        // Create a unique ID for this pairing
        const pairingId = `${resume.id}-${jd.id}`
        
        // Fetch question sets for this resume + jd combination
        const { data: questions, error: questionsError } = await supabaseClient
          .from('questions')
          .select('*')
          .eq('resume_id', resume.id)
          .eq('jd_id', jd.id)
          .order('question_set', { ascending: true })

        if (questionsError) {
          console.error('Error fetching questions:', questionsError)
          continue
        }

        // Group questions by question_set
        const questionSetMap = new Map<number, any[]>()
        questions.forEach(question => {
          const setNumber = question.question_set
          if (!questionSetMap.has(setNumber)) {
            questionSetMap.set(setNumber, [])
          }
          questionSetMap.get(setNumber)!.push(question)
        })

        // Create question sets array with interview history
        const questionSets = await Promise.all(Array.from(questionSetMap.entries()).map(async ([setNumber, questionsInSet]) => {
          // Fetch interview history for this question set
          const { data: interviews, error: interviewsError } = await supabaseClient
            .from('interviews')
            .select('id, attempt_number, status, scheduled_at, retake_from')
            .eq('user_id', user.id)
            .eq('resume_id', resume.id)
            .eq('jd_id', jd.id)
            .eq('question_set', setNumber)
            .order('attempt_number', { ascending: true })

          if (interviewsError) {
            console.error('Error fetching interviews for question set:', setNumber, interviewsError)
            return {
              id: `${pairingId}-set-${setNumber}`,
              questionSetNumber: setNumber,
              hasQuestions: questionsInSet.length > 0,
              hasSummary: false,
              interviews: [],
              total_attempts: 0
            }
          }

          const totalAttempts = interviews?.length || 0
          const canRetake = true

          // Fetch metrics for each completed interview
          const interviewHistory = await Promise.all((interviews || []).map(async (interview) => {
            // Fetch feedback with metrics for completed interviews
            let metrics = null
            if (interview.status === 'completed' || interview.status === 'ENDED') {
              const { data: feedback } = await supabaseClient
                .from('interview_feedback')
                .select('metrics, created_at')
                .eq('interview_id', interview.id)
                .single()
              
              if (feedback) {
                metrics = feedback.metrics
              }
            }

            return {
              id: interview.id,
              attempt_number: interview.attempt_number,
              status: interview.status,
              scheduled_at: interview.scheduled_at,
              can_retake: canRetake,
              retake_from: interview.retake_from,
              metrics: metrics
            }
          }))

          return {
            id: `${pairingId}-set-${setNumber}`,
            questionSetNumber: setNumber,
            hasQuestions: questionsInSet.length > 0,
            hasSummary: false,
            interviews: interviewHistory,
            total_attempts: totalAttempts
          }
        }))

        // Only include pairings that have at least one question set
        if (questionSets.length > 0) {
          pairings.push({
            id: pairingId,
            resume_id: resume.id,
            jd_id: jd.id,
            resumeName: resume.file_name.replace(/\.[^/.]+$/, ''), // Remove file extension
            resumeUrl: resume.file_url, // Add resume URL for question generation
            jobTitle: jd.title,
            jobDescription: jd.description,
            technical: jd.technical ?? true,
            questionSets
          })
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: pairings,
        message: `Found ${pairings.length} resume-job description pairings`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: 'An unexpected error occurred' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}
