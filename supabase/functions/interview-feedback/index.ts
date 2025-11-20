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
      interview_feedback: {
        Row: {
          id: string
          interview_id: string
          key_strengths: string | null
          improvement_areas: string | null
          summary: string | null
          audio_url: string | null
          metrics: any | null  // ✅ ADD THIS
          created_at: string
        }
        Insert: {
          id?: string
          interview_id: string
          key_strengths?: string | null
          improvement_areas?: string | null
          summary?: string | null
          audio_url?: string | null
          metrics?: any | null  // ✅ ADD THIS
          created_at?: string
        }
        Update: {
          id?: string
          interview_id?: string
          key_strengths?: string | null
          improvement_areas?: string | null
          summary?: string | null
          audio_url?: string | null
          metrics?: any | null  // ✅ ADD THIS
          created_at?: string
        }
      }
      interviews: {
        Row: {
          id: string
          user_id: string
          resume_id: string
          jd_id: string
          scheduled_at: string
          created_at: string
          updated_at: string
        }
      }
    }
  }
}

interface FeedbackRequest {
  interview_id: string
  key_strengths?: string | null
  improvement_areas?: string | null
  summary?: string | null
  audio_url?: string | null
  metrics?: any | null  // ✅ ADD THIS
}

interface UpdateFeedbackRequest {
  key_strengths?: string | null
  improvement_areas?: string | null
  summary?: string | null
  audio_url?: string | null
  metrics?: any | null  // ✅ ADD THIS
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
          message: 'Interview feedback function is working!',
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

    // Check if using service role token for testing/admin access
    const authHeader = req.headers.get('Authorization') || ''
    let isServiceRole = false
    
    try {
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        // Simple JWT payload decode (for local testing only)
        const payload = JSON.parse(atob(token.split('.')[1]))
        isServiceRole = payload.role === 'service_role'
      }
    } catch (error) {
      console.log('Error decoding token:', error)
    }
    
    let authUser: any
    
    if (isServiceRole) {
      // For service role, create a mock user for testing
      const testUserId = '93870675-4e88-45a1-bd71-390b1b77cc2f'
      authUser = {
        id: testUserId,
        email: 'test@example.com'
      }
      console.log('Using service role token with mock user for testing')
      
      // Ensure test data exists for foreign key constraints
      try {
        // Test interview
        await supabaseClient
          .from('interviews')
          .upsert({
            id: '550e8400-e29b-41d4-a716-446655440099',
            user_id: testUserId,
            resume_id: '550e8400-e29b-41d4-a716-446655440001',
            jd_id: '550e8400-e29b-41d4-a716-446655440002',
            scheduled_at: new Date().toISOString()
          }, { onConflict: 'id' })
        
        console.log('Test interview ensured in database')
      } catch (error) {
        console.log('Note: Could not ensure test interview exists:', error.message)
      }
    } else {
      // For regular user tokens, verify authentication
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
      
      authUser = user
    }

    // Parse URL to extract feedback ID for individual operations
    const pathParts = url.pathname.split('/')
    const feedbackId = pathParts[pathParts.length - 1] !== 'interview-feedback' ? pathParts[pathParts.length - 1] : null

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        if (feedbackId) {
          return await handleGetFeedback(supabaseClient, authUser, feedbackId)
        } else {
          return await handleGetFeedbacks(supabaseClient, authUser, url)
        }
      
      case 'POST':
        return await handleCreateFeedback(supabaseClient, req, authUser)
      
      case 'PUT':
        if (!feedbackId) {
          return new Response(
            JSON.stringify({ error: 'Feedback ID required for update' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
        return await handleUpdateFeedback(supabaseClient, req, authUser, feedbackId)
      
      case 'DELETE':
        if (!feedbackId) {
          return new Response(
            JSON.stringify({ error: 'Feedback ID required for deletion' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
        return await handleDeleteFeedback(supabaseClient, authUser, feedbackId)
      
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

async function handleGetFeedbacks(supabaseClient: any, user: any, url: URL) {
  try {
    const params = url.searchParams
    
    // Parse query parameters for pagination and filtering
    const limit = parseInt(params.get('limit') || '50')
    const offset = parseInt(params.get('offset') || '0')
    const sortBy = params.get('sort_by') || 'created_at'
    const sortOrder = params.get('sort_order') || 'desc'
    const interview_id = params.get('interview_id') // Optional filter by interview
    
    // Build the query - use a join to ensure user owns the interview and get interview timing
    let query = supabaseClient
      .from('interview_feedback')
      .select(`
        id,
        interview_id,
        key_strengths,
        improvement_areas,
        summary,
        audio_url,
        metrics,
        created_at,
        interviews!inner(
          user_id,
          created_at
        )
      `)
      .eq('interviews.user_id', user.id)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    // Add filters if provided
    if (interview_id) {
      query = query.eq('interview_id', interview_id)
    }

    const { data: feedbacks, error, count } = await query

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

    // Clean up the response and calculate interview duration and questions count
    const cleanedFeedbacks = await Promise.all(feedbacks?.map(async (feedback) => {
      const { interviews, ...cleanFeedback } = feedback
      
      // Calculate interview duration in minutes
      const interviewStart = new Date(interviews.created_at)
      const interviewEnd = new Date(feedback.created_at)
      const durationMs = interviewEnd.getTime() - interviewStart.getTime()
      const durationMinutes = Math.round(durationMs / (1000 * 60))
      
      // Fetch transcript to count questions
      let questionsCount = 0
      try {
        const { data: transcript } = await supabaseClient
          .from('transcripts')
          .select('full_transcript')
          .eq('interview_id', feedback.interview_id)
          .single()
        
        if (transcript?.full_transcript) {
          try {
            const transcriptData = JSON.parse(transcript.full_transcript)
            if (Array.isArray(transcriptData)) {
              // Count user responses (candidate answers) instead of assistant questions
              questionsCount = transcriptData.filter(message => 
                message.role === 'user'
              ).length
              
              // Debug logging to verify
              console.log(`Interview ${feedback.interview_id}: Found ${questionsCount} user responses in transcript`)
              console.log('Total transcript messages:', transcriptData.length)
              console.log('User messages:', transcriptData.filter(m => m.role === 'user').length)
              console.log('Assistant messages:', transcriptData.filter(m => m.role === 'assistant').length)
            }
          } catch (parseError) {
            console.log('Error parsing transcript JSON:', parseError)
            questionsCount = 0
          }
        }
      } catch (transcriptError) {
        console.log('Error fetching transcript:', transcriptError)
        questionsCount = 0
      }
      
      return {
        ...cleanFeedback,
        interview_duration_minutes: durationMinutes,
        interview_start_time: interviews.created_at,
        responses_count: questionsCount  // Renamed to be more accurate
      }
    }) || [])

    return new Response(
      JSON.stringify({
        success: true,
        data: cleanedFeedbacks,
        count: count || cleanedFeedbacks.length
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error fetching interview feedbacks:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch interview feedbacks', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleGetFeedback(supabaseClient: any, user: any, feedbackId: string) {
  try {
    // Use a join to ensure user owns the interview
    const { data: feedback, error } = await supabaseClient
      .from('interview_feedback')
      .select(`
        id,
        interview_id,
        key_strengths,
        improvement_areas,
        summary,
        audio_url,
        metrics,
        created_at,
        interviews!inner(user_id)
      `)
      .eq('id', feedbackId)
      .eq('interviews.user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return new Response(
          JSON.stringify({ 
            error: 'Feedback not found', 
            message: 'Interview feedback does not exist or you do not have access to it' 
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

    // Clean up the response to remove the interviews join data
    const { interviews, ...cleanFeedback } = feedback

    return new Response(
      JSON.stringify({
        success: true,
        data: cleanFeedback
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error fetching interview feedback:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch interview feedback', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleCreateFeedback(supabaseClient: any, req: Request, user: any) {
  try {
    const body = await req.json()
    const { interview_id, key_strengths, improvement_areas, summary, audio_url, metrics }: FeedbackRequest = body  // ✅ ADD metrics

    // Validate required fields
    if (!interview_id) {
      return new Response(
        JSON.stringify({ 
          error: 'Bad request', 
          message: 'interview_id is required' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Verify that the interview exists and belongs to the user
    const { data: interview, error: interviewError } = await supabaseClient
      .from('interviews')
      .select('id, user_id')
      .eq('id', interview_id)
      .eq('user_id', user.id)
      .single()

    if (interviewError || !interview) {
      return new Response(
        JSON.stringify({ 
          error: 'Interview not found', 
          message: 'Interview does not exist or you do not have access to it' 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if feedback already exists for this interview
    const { data: existingFeedback } = await supabaseClient
      .from('interview_feedback')
      .select('id')
      .eq('interview_id', interview_id)
      .single()

    if (existingFeedback) {
      return new Response(
        JSON.stringify({ 
          error: 'Feedback already exists', 
          message: 'Feedback for this interview already exists. Use PUT to update it.' 
        }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const feedbackData = {
      interview_id: interview_id.trim(),
      key_strengths: key_strengths?.trim() || null,
      improvement_areas: improvement_areas?.trim() || null,
      summary: summary?.trim() || null,
      audio_url: audio_url?.trim() || null,
      metrics: metrics || null  // ✅ ADD THIS
    }

    // Create new feedback
    const { data: newFeedback, error } = await supabaseClient
      .from('interview_feedback')
      .insert(feedbackData)
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
        data: newFeedback,
        message: 'Interview feedback created successfully'
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error creating interview feedback:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create interview feedback', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleUpdateFeedback(supabaseClient: any, req: Request, user: any, feedbackId: string) {
  try {
    const body = await req.json()
    const { key_strengths, improvement_areas, summary, audio_url, metrics }: UpdateFeedbackRequest = body  // ✅ ADD metrics

    // Build update object with only provided fields
    const updateData: any = {}
    if (key_strengths !== undefined) updateData.key_strengths = key_strengths?.trim() || null
    if (improvement_areas !== undefined) updateData.improvement_areas = improvement_areas?.trim() || null
    if (summary !== undefined) updateData.summary = summary?.trim() || null
    if (audio_url !== undefined) updateData.audio_url = audio_url?.trim() || null
    if (metrics !== undefined) updateData.metrics = metrics || null  // ✅ ADD THIS

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

    // Verify ownership through interview relationship
    const { data: feedbackWithInterview, error: verifyError } = await supabaseClient
      .from('interview_feedback')
      .select(`
        id,
        interviews!inner(user_id)
      `)
      .eq('id', feedbackId)
      .eq('interviews.user_id', user.id)
      .single()

    if (verifyError || !feedbackWithInterview) {
      return new Response(
        JSON.stringify({ 
          error: 'Feedback not found', 
          message: 'Interview feedback does not exist or you do not have access to it' 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const { data: updatedFeedback, error } = await supabaseClient
      .from('interview_feedback')
      .update(updateData)
      .eq('id', feedbackId)
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
        data: updatedFeedback,
        message: 'Interview feedback updated successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error updating interview feedback:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update interview feedback', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleDeleteFeedback(supabaseClient: any, user: any, feedbackId: string) {
  try {
    // Verify ownership through interview relationship and delete
    const { data: deletedFeedback, error } = await supabaseClient
      .from('interview_feedback')
      .delete()
      .eq('id', feedbackId)
      .eq('interview_id', (await supabaseClient
        .from('interviews')
        .select('id')
        .eq('user_id', user.id)
        .then((result: any) => result.data?.map((i: any) => i.id) || [])
      ))
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return new Response(
          JSON.stringify({ 
            error: 'Feedback not found', 
            message: 'Interview feedback does not exist or you do not have access to it' 
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
        data: deletedFeedback,
        message: 'Interview feedback deleted successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error deleting interview feedback:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to delete interview feedback', 
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

  Health check:
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/interview-feedback/health' \
    --header 'Content-Type: application/json'

  Get all feedback for user:
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/interview-feedback' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json'

  Get all feedback with filters and pagination:
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/interview-feedback?limit=10&offset=0&interview_id=INTERVIEW_UUID&sort_by=created_at&sort_order=desc' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json'

  Get specific feedback:
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/interview-feedback/FEEDBACK_UUID' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json'

  Create new feedback:
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/interview-feedback' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json' \
    --data '{"interview_id":"INTERVIEW_UUID","key_strengths":"Great communication skills","improvement_areas":"Technical depth could be improved","summary":"Overall good interview performance","audio_url":"https://example.com/audio.mp3"}'

  Update feedback:
  curl -i --location --request PUT 'http://127.0.0.1:54321/functions/v1/interview-feedback/FEEDBACK_UUID' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json' \
    --data '{"key_strengths":"Excellent communication and problem-solving","summary":"Updated feedback summary"}'

  Delete feedback:
  curl -i --location --request DELETE 'http://127.0.0.1:54321/functions/v1/interview-feedback/FEEDBACK_UUID' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json'

*/
