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
        Insert: {
          id?: string
          interview_id?: string
          resume_id?: string
          jd_id?: string
          question_text: string
          expected_answer?: string
          difficulty_category?: string
          difficulty_experience?: string
          requires_code?: boolean
          code_language?: string
          question_set: number
          created_at?: string
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

interface CreateQuestionRequest {
  resume_id?: string
  jd_id?: string
  interview_id?: string
  questions: Array<{
    question_text: string
    expected_answer?: string
    difficulty_category?: string
    difficulty_experience?: string
    requires_code?: boolean
    code_language?: string
  }>
  question_set: number
}

interface UpdateQuestionRequest {
  question_text?: string
  expected_answer?: string
  difficulty_category?: string
  difficulty_experience?: string
  requires_code?: boolean
  code_language?: string
  question_set?: number
  interview_id?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

    // Parse URL for question ID in case of specific operations
    const url = new URL(req.url)
    const questionId = url.pathname.split('/').pop()
    const isSpecificQuestion = questionId && questionId !== 'questions'

    // Handle different HTTP methods
    switch (req.method) {
      case 'POST':
        return await handleCreateQuestions(supabaseClient, req, user)
      
      case 'GET':
        if (isSpecificQuestion) {
          return await handleGetQuestion(supabaseClient, questionId, user)
        } else {
          return await handleGetQuestions(supabaseClient, req, user)
        }
      
      case 'PUT':
        if (!isSpecificQuestion) {
          return new Response(
            JSON.stringify({ error: 'Question ID required for update' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
        return await handleUpdateQuestion(supabaseClient, req, questionId, user)
      
      case 'DELETE':
        if (!isSpecificQuestion) {
          return new Response(
            JSON.stringify({ error: 'Question ID required for deletion' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
        return await handleDeleteQuestion(supabaseClient, questionId, user)
      
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
    return new Response(
      JSON.stringify({ 
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

async function handleCreateQuestions(supabaseClient: any, req: Request, authUser: any) {
  try {
    const body = await req.json().catch(() => ({}))
    const { 
      resume_id, 
      jd_id, 
      interview_id,
      questions, 
      question_set 
    }: CreateQuestionRequest = body

    // Validate required fields
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Bad request', 
          message: 'Questions array is required and must not be empty' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (question_set === undefined || question_set === null) {
      return new Response(
        JSON.stringify({ 
          error: 'Bad request', 
          message: 'question_set is required' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Prepare data for insertion
    const questionsData = questions.map(q => ({
      interview_id: interview_id || null,
      resume_id: resume_id || null,
      jd_id: jd_id || null,
      question_text: q.question_text,
      expected_answer: q.expected_answer || null,
      difficulty_category: q.difficulty_category || 'medium',
      difficulty_experience: q.difficulty_experience || 'beginner',
      requires_code: q.requires_code || false,
      code_language: q.code_language || "",
      question_set: question_set
    }))

    // Insert questions
    const { data: newQuestions, error } = await supabaseClient
      .from('questions')
      .insert(questionsData)
      .select()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ 
          error: 'Database error', 
          message: error.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: newQuestions,
        message: `Created ${newQuestions.length} questions successfully`,
        count: newQuestions.length
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error creating questions:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create questions', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleGetQuestions(supabaseClient: any, req: Request, authUser: any) {
  try {
    const url = new URL(req.url)
    const resume_id = url.searchParams.get('resume_id')
    const jd_id = url.searchParams.get('jd_id')
    const interview_id = url.searchParams.get('interview_id')
    const question_set = url.searchParams.get('question_set')
    const difficulty_category = url.searchParams.get('difficulty_category')
    const difficulty_experience = url.searchParams.get('difficulty_experience')
    const limit = url.searchParams.get('limit')

    let query = supabaseClient.from('questions').select('*')

    // Apply filters
    if (resume_id) query = query.eq('resume_id', resume_id)
    if (jd_id) query = query.eq('jd_id', jd_id)
    if (interview_id) query = query.eq('interview_id', interview_id)
    if (question_set) query = query.eq('question_set', parseInt(question_set))
    if (difficulty_category) query = query.eq('difficulty_category', difficulty_category)
    if (difficulty_experience) query = query.eq('difficulty_experience', difficulty_experience)

    // Apply limit
    if (limit && !isNaN(parseInt(limit))) {
      query = query.limit(parseInt(limit))
    }

    // Order by created_at desc
    query = query.order('created_at', { ascending: false })

    const { data: questions, error } = await query

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ 
          error: 'Database error', 
          message: error.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: questions,
        count: questions.length,
        filters_applied: {
          resume_id,
          jd_id,
          interview_id,
          question_set,
          difficulty_category,
          difficulty_experience,
          limit
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error fetching questions:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch questions', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleGetQuestion(supabaseClient: any, questionId: string, authUser: any) {
  try {
    const { data: question, error } = await supabaseClient
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return new Response(
          JSON.stringify({ 
            error: 'Question not found', 
            message: 'Question with the specified ID does not exist' 
          }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ 
          error: 'Database error', 
          message: error.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: question
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error fetching question:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch question', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleUpdateQuestion(supabaseClient: any, req: Request, questionId: string, authUser: any) {
  try {
    const body = await req.json()
    const { 
      question_text, 
      expected_answer, 
      difficulty_category, 
      difficulty_experience,
      requires_code,
      code_language,
      question_set,
      interview_id 
    }: UpdateQuestionRequest = body

    // Build update object with only provided fields
    const updateData: any = {}
    if (question_text !== undefined) updateData.question_text = question_text
    if (expected_answer !== undefined) updateData.expected_answer = expected_answer
    if (difficulty_category !== undefined) updateData.difficulty_category = difficulty_category
    if (difficulty_experience !== undefined) updateData.difficulty_experience = difficulty_experience
    if (requires_code !== undefined) updateData.requires_code = requires_code
    if (code_language !== undefined) updateData.code_language = code_language
    if (question_set !== undefined) updateData.question_set = question_set
    if (interview_id !== undefined) updateData.interview_id = interview_id

    if (Object.keys(updateData).length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Bad request', 
          message: 'No valid fields provided for update' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const { data: updatedQuestion, error } = await supabaseClient
      .from('questions')
      .update(updateData)
      .eq('id', questionId)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ 
          error: 'Database error', 
          message: error.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: updatedQuestion,
        message: 'Question updated successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error updating question:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update question', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleDeleteQuestion(supabaseClient: any, questionId: string, authUser: any) {
  try {
    const { data: deletedQuestion, error } = await supabaseClient
      .from('questions')
      .delete()
      .eq('id', questionId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return new Response(
          JSON.stringify({ 
            error: 'Question not found', 
            message: 'Question with the specified ID does not exist or already deleted' 
          }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ 
          error: 'Database error', 
          message: error.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: deletedQuestion,
        message: 'Question deleted successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error deleting question:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to delete question', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  Create questions:
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/questions' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json' \
    --data '{
      "resume_id": "uuid-here",
      "jd_id": "uuid-here", 
      "questions": [
        {
          "question_text": "Tell me about yourself",
          "expected_answer": "I am a software developer...",
          "difficulty_category": "easy",
          "difficulty_experience": "beginner"
        }
      ],
      "question_set": 1
    }'

  Get all questions:
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/questions' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN'

  Get questions with filters:
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/questions?resume_id=uuid&question_set=1&limit=10' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN'

  Get specific question:
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/questions/QUESTION_ID' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN'

  Update question:
  curl -i --location --request PUT 'http://127.0.0.1:54321/functions/v1/questions/QUESTION_ID' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json' \
    --data '{"question_text": "Updated question text", "difficulty_category": "hard"}'

  Delete question:
  curl -i --location --request DELETE 'http://127.0.0.1:54321/functions/v1/questions/QUESTION_ID' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN'

*/
