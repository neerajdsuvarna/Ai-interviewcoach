// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Method not allowed',
          message: 'Only GET requests are supported' 
        }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

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

    // Get interview_id from URL paramete
    const url = new URL(req.url)
    const interviewId = url.searchParams.get('interview_id')

    if (!interviewId) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Bad request', 
          message: 'interview_id parameter is required' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(' Fetching interview data for:', interviewId);

    // Get interview with job description and questions in one query
    const { data: interview, error: interviewError } = await supabaseClient
      .from('interviews')
      .select(`
        *,
        job_descriptions!inner(title, description),
        questions!inner(
          id,
          question_text, 
          expected_answer, 
          difficulty_category,
          question_set
        )
      `)
      .eq('id', interviewId)
      .eq('user_id', user.id)
      .single()

    if (interviewError || !interview) {
      console.error('❌ Interview not found:', interviewError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Interview not found', 
          message: 'Interview not found or you do not have access to it' 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // ✅ Process questions to get one from each difficulty level
    const allQuestions = interview.questions || [];
    const processedQuestions = [];

    // Group questions by difficulty category
    const questionsByDifficulty = {
      easy: allQuestions.filter(q => q.difficulty_category === 'easy'),
      medium: allQuestions.filter(q => q.difficulty_category === 'medium'),
      hard: allQuestions.filter(q => q.difficulty_category === 'hard')
    };

    // Take one question from each difficulty level
    if (questionsByDifficulty.easy.length > 0) {
      processedQuestions.push(questionsByDifficulty.easy[0]);
    }
    if (questionsByDifficulty.medium.length > 0) {
      processedQuestions.push(questionsByDifficulty.medium[0]);
    }
    if (questionsByDifficulty.hard.length > 0) {
      processedQuestions.push(questionsByDifficulty.hard[0]);
    }

    console.log('✅ Interview data fetched successfully:', {
      interview_id: interview.id,
      job_title: interview.job_descriptions.title,
      questions_count: processedQuestions.length,
      difficulty_breakdown: {
        easy: questionsByDifficulty.easy.length,
        medium: questionsByDifficulty.medium.length,
        hard: questionsByDifficulty.hard.length
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          interview: {
            id: interview.id,
            status: interview.status,
            created_at: interview.created_at
          },
          job_description: {
            title: interview.job_descriptions.title,
            description: interview.job_descriptions.description
          },
          resume: {
            file_name: interview.resume_id // We can add resume details if needed
          },
          questions: processedQuestions // ✅ Return only 3 questions (one from each difficulty)
        },
        message: 'Interview data fetched successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('💥 Interview data fetch error:', error);
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