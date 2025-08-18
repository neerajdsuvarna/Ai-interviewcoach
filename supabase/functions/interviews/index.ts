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
        Insert: {
          id?: string
          user_id: string
          resume_id: string
          jd_id: string
          scheduled_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          resume_id?: string
          jd_id?: string
          scheduled_at?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

interface InterviewRequest {
  resume_id: string
  jd_id: string
  scheduled_at?: string
}

interface UpdateInterviewRequest {
  resume_id?: string
  jd_id?: string
  scheduled_at?: string
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
          message: 'Interviews function is working!',
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
      
      // Ensure test user exists in database for foreign key constraints
      try {
        await supabaseClient
          .from('users')
          .upsert({
            id: testUserId,
            email: 'test@example.com',
            full_name: 'Test User',
            plan: 'basic'
          }, { onConflict: 'id' })
        console.log('Test user ensured in database')
        
        // Also ensure test resume and job description exist for foreign key constraints
        const testData = [
          // Test resumes
          { table: 'resumes', data: { id: '550e8400-e29b-41d4-a716-446655440001', user_id: testUserId, file_url: 'https://example.com/test-resume-1.pdf', file_name: 'test-resume-1.pdf' }},
          { table: 'resumes', data: { id: '550e8400-e29b-41d4-a716-446655440003', user_id: testUserId, file_url: 'https://example.com/test-resume-2.pdf', file_name: 'test-resume-2.pdf' }},
          { table: 'resumes', data: { id: '550e8400-e29b-41d4-a716-446655440004', user_id: testUserId, file_url: 'https://example.com/test-resume-3.pdf', file_name: 'test-resume-3.pdf' }},
          // Test job descriptions
          { table: 'job_descriptions', data: { id: '550e8400-e29b-41d4-a716-446655440002', user_id: testUserId, title: 'Test Job Position 1', description: 'Test job description 1', file_url: 'https://example.com/test-jd-1.pdf' }},
          { table: 'job_descriptions', data: { id: '550e8400-e29b-41d4-a716-446655440005', user_id: testUserId, title: 'Test Job Position 2', description: 'Test job description 2', file_url: 'https://example.com/test-jd-2.pdf' }}
        ]
        
        for (const { table, data } of testData) {
          await supabaseClient.from(table).upsert(data, { onConflict: 'id' })
        }
        
        console.log('Test resume and job description ensured in database')
      } catch (error) {
        console.log('Note: Could not ensure test data exists:', error.message)
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

    // Parse URL to extract interview ID for individual operations
    const pathParts = url.pathname.split('/')
    const interviewId = pathParts[pathParts.length - 1] !== 'interviews' ? pathParts[pathParts.length - 1] : null

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        if (interviewId) {
          return await handleGetInterview(supabaseClient, authUser, interviewId)
        } else {
          return await handleGetInterviews(supabaseClient, authUser, url)
        }
      
      case 'POST':
        return await handleCreateInterview(supabaseClient, req, authUser)
      
      case 'PUT':
        if (!interviewId) {
          return new Response(
            JSON.stringify({ error: 'Interview ID required for update' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
        return await handleUpdateInterview(supabaseClient, req, authUser, interviewId)
      
      case 'DELETE':
        if (!interviewId) {
          return new Response(
            JSON.stringify({ error: 'Interview ID required for deletion' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
        return await handleDeleteInterview(supabaseClient, authUser, interviewId)
      
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

async function handleGetInterviews(supabaseClient: any, user: any, url: URL) {
  try {
    const params = url.searchParams
    
    // Parse query parameters for pagination and filtering
    const limit = parseInt(params.get('limit') || '50')
    const offset = parseInt(params.get('offset') || '0')
    const sortBy = params.get('sort_by') || 'scheduled_at'
    const sortOrder = params.get('sort_order') || 'desc'
    const resume_id = params.get('resume_id') // Optional filter by resume
    const jd_id = params.get('jd_id') // Optional filter by job description
    
    // Build the query
    let query = supabaseClient
      .from('interviews')
      .select('*')
      .eq('user_id', user.id)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    // Add filters if provided
    if (resume_id) {
      query = query.eq('resume_id', resume_id)
    }
    if (jd_id) {
      query = query.eq('jd_id', jd_id)
    }

    const { data: interviews, error, count } = await query

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
        data: interviews || [],
        pagination: {
          limit,
          offset,
          total: count || (interviews?.length || 0)
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error fetching interviews:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch interviews', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleGetInterview(supabaseClient: any, user: any, interviewId: string) {
  try {
    const { data: interview, error } = await supabaseClient
      .from('interviews')
      .select('*')
      .eq('id', interviewId)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
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
        data: interview
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error fetching interview:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch interview', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleCreateInterview(supabaseClient: any, req: Request, user: any) {
  try {
    const body = await req.json()
    const { resume_id, jd_id, scheduled_at }: InterviewRequest = body

    // Validate required fields
    if (!resume_id || !jd_id) {
      return new Response(
        JSON.stringify({ 
          error: 'Bad request', 
          message: 'resume_id and jd_id are required' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // If scheduled_at is not provided, set it to current timestamp (like in db_operations.py)
    const interviewData = {
      user_id: user.id,
      resume_id: resume_id.trim(),
      jd_id: jd_id.trim(),
      scheduled_at: scheduled_at || new Date().toISOString()
    }

    // Create new interview
    const { data: newInterview, error } = await supabaseClient
      .from('interviews')
      .insert(interviewData)
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
        data: newInterview,
        message: 'Interview created successfully'
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error creating interview:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create interview', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleUpdateInterview(supabaseClient: any, req: Request, user: any, interviewId: string) {
  try {
    const body = await req.json()
    const { resume_id, jd_id, scheduled_at }: UpdateInterviewRequest = body

    // Build update object with only provided fields
    const updateData: any = {}
    if (resume_id !== undefined) updateData.resume_id = resume_id.trim()
    if (jd_id !== undefined) updateData.jd_id = jd_id.trim()
    if (scheduled_at !== undefined) {
      // Validate ISO date string if provided
      try {
        new Date(scheduled_at).toISOString()
        updateData.scheduled_at = scheduled_at
      } catch {
        return new Response(
          JSON.stringify({ 
            error: 'Bad request', 
            message: 'scheduled_at must be a valid ISO date string' 
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
    }

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

    const { data: updatedInterview, error } = await supabaseClient
      .from('interviews')
      .update(updateData)
      .eq('id', interviewId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
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
        data: updatedInterview,
        message: 'Interview updated successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error updating interview:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update interview', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleDeleteInterview(supabaseClient: any, user: any, interviewId: string) {
  try {
    const { data: deletedInterview, error } = await supabaseClient
      .from('interviews')
      .delete()
      .eq('id', interviewId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
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
        data: deletedInterview,
        message: 'Interview deleted successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error deleting interview:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to delete interview', 
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
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/interviews/health' \
    --header 'Content-Type: application/json'

  Get all interviews:
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/interviews' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json'

  Get all interviews with filters and pagination:
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/interviews?limit=10&offset=0&resume_id=RESUME_UUID&sort_by=scheduled_at&sort_order=asc' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json'

  Get specific interview:
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/interviews/INTERVIEW_UUID' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json'

  Create a new interview:
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/interviews' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json' \
    --data '{"resume_id":"RESUME_UUID","jd_id":"JD_UUID","scheduled_at":"2024-01-15T10:00:00Z"}'

  Update interview:
  curl -i --location --request PUT 'http://127.0.0.1:54321/functions/v1/interviews/INTERVIEW_UUID' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json' \
    --data '{"scheduled_at":"2024-01-16T14:00:00Z"}'

  Delete interview:
  curl -i --location --request DELETE 'http://127.0.0.1:54321/functions/v1/interviews/INTERVIEW_UUID' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json'

*/
