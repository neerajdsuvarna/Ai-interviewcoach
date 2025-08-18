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
      transcripts: {
        Row: {
          id: string
          interview_id: string
          full_transcript: string
          created_at: string
        }
        Insert: {
          id?: string
          interview_id: string
          full_transcript: string
          created_at?: string
        }
        Update: {
          id?: string
          interview_id?: string
          full_transcript?: string
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

interface TranscriptRequest {
  interview_id: string
  full_transcript: string
}

interface UpdateTranscriptRequest {
  full_transcript?: string
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
          message: 'Transcripts function is working!',
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

    // Parse URL to extract transcript ID for individual operations
    const pathParts = url.pathname.split('/')
    const transcriptId = pathParts[pathParts.length - 1] !== 'transcripts' ? pathParts[pathParts.length - 1] : null

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        if (transcriptId) {
          return await handleGetTranscript(supabaseClient, authUser, transcriptId)
        } else {
          return await handleGetTranscripts(supabaseClient, authUser, url)
        }
      
      case 'POST':
        return await handleCreateTranscript(supabaseClient, req, authUser)
      
      case 'PUT':
        if (!transcriptId) {
          return new Response(
            JSON.stringify({ error: 'Transcript ID required for update' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
        return await handleUpdateTranscript(supabaseClient, req, authUser, transcriptId)
      
      case 'DELETE':
        if (!transcriptId) {
          return new Response(
            JSON.stringify({ error: 'Transcript ID required for deletion' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
        return await handleDeleteTranscript(supabaseClient, authUser, transcriptId)
      
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

async function handleGetTranscripts(supabaseClient: any, user: any, url: URL) {
  try {
    const params = url.searchParams
    
    // Parse query parameters for pagination and filtering
    const limit = parseInt(params.get('limit') || '50')
    const offset = parseInt(params.get('offset') || '0')
    const sortBy = params.get('sort_by') || 'created_at'
    const sortOrder = params.get('sort_order') || 'desc'
    const interview_id = params.get('interview_id') // Optional filter by interview
    
    // Build the query - use a join to ensure user owns the interview
    let query = supabaseClient
      .from('transcripts')
      .select(`
        id,
        interview_id,
        full_transcript,
        created_at,
        interviews!inner(user_id)
      `)
      .eq('interviews.user_id', user.id)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    // Add filters if provided
    if (interview_id) {
      query = query.eq('interview_id', interview_id)
    }

    const { data: transcripts, error, count } = await query

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

    // Clean up the response to remove the interviews join data
    const cleanedTranscripts = transcripts?.map(transcript => {
      const { interviews, ...cleanTranscript } = transcript
      return cleanTranscript
    }) || []

    return new Response(
      JSON.stringify({
        success: true,
        data: cleanedTranscripts,
        pagination: {
          limit,
          offset,
          total: count || cleanedTranscripts.length
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error fetching transcripts:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch transcripts', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleGetTranscript(supabaseClient: any, user: any, transcriptId: string) {
  try {
    // Use a join to ensure user owns the interview
    const { data: transcript, error } = await supabaseClient
      .from('transcripts')
      .select(`
        id,
        interview_id,
        full_transcript,
        created_at,
        interviews!inner(user_id)
      `)
      .eq('id', transcriptId)
      .eq('interviews.user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return new Response(
          JSON.stringify({ 
            error: 'Transcript not found', 
            message: 'Transcript does not exist or you do not have access to it' 
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
    const { interviews, ...cleanTranscript } = transcript

    return new Response(
      JSON.stringify({
        success: true,
        data: cleanTranscript
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error fetching transcript:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch transcript', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleCreateTranscript(supabaseClient: any, req: Request, user: any) {
  try {
    const body = await req.json()
    const { interview_id, full_transcript }: TranscriptRequest = body

    // Validate required fields
    if (!interview_id || !full_transcript) {
      return new Response(
        JSON.stringify({ 
          error: 'Bad request', 
          message: 'interview_id and full_transcript are required' 
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

    // Check if transcript already exists for this interview
    const { data: existingTranscript } = await supabaseClient
      .from('transcripts')
      .select('id')
      .eq('interview_id', interview_id)
      .single()

    if (existingTranscript) {
      return new Response(
        JSON.stringify({ 
          error: 'Transcript already exists', 
          message: 'Transcript for this interview already exists. Use PUT to update it.' 
        }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const transcriptData = {
      interview_id: interview_id.trim(),
      full_transcript: full_transcript.trim()
    }

    // Create new transcript
    const { data: newTranscript, error } = await supabaseClient
      .from('transcripts')
      .insert(transcriptData)
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
        data: newTranscript,
        message: 'Transcript created successfully'
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error creating transcript:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create transcript', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleUpdateTranscript(supabaseClient: any, req: Request, user: any, transcriptId: string) {
  try {
    const body = await req.json()
    const { full_transcript }: UpdateTranscriptRequest = body

    // Build update object with only provided fields
    const updateData: any = {}
    if (full_transcript !== undefined) updateData.full_transcript = full_transcript?.trim()

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
    const { data: transcriptWithInterview, error: verifyError } = await supabaseClient
      .from('transcripts')
      .select(`
        id,
        interviews!inner(user_id)
      `)
      .eq('id', transcriptId)
      .eq('interviews.user_id', user.id)
      .single()

    if (verifyError || !transcriptWithInterview) {
      return new Response(
        JSON.stringify({ 
          error: 'Transcript not found', 
          message: 'Transcript does not exist or you do not have access to it' 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const { data: updatedTranscript, error } = await supabaseClient
      .from('transcripts')
      .update(updateData)
      .eq('id', transcriptId)
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
        data: updatedTranscript,
        message: 'Transcript updated successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error updating transcript:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update transcript', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleDeleteTranscript(supabaseClient: any, user: any, transcriptId: string) {
  try {
    // Verify ownership through interview relationship and delete
    const { data: deletedTranscript, error } = await supabaseClient
      .from('transcripts')
      .delete()
      .eq('id', transcriptId)
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
            error: 'Transcript not found', 
            message: 'Transcript does not exist or you do not have access to it' 
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
        data: deletedTranscript,
        message: 'Transcript deleted successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error deleting transcript:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to delete transcript', 
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
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/transcripts/health' \
    --header 'Content-Type: application/json'

  Get all transcripts for user:
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/transcripts' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json'

  Get all transcripts with filters and pagination:
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/transcripts?limit=10&offset=0&interview_id=INTERVIEW_UUID&sort_by=created_at&sort_order=desc' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json'

  Get specific transcript:
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/transcripts/TRANSCRIPT_UUID' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json'

  Create new transcript:
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/transcripts' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json' \
    --data '{"interview_id":"INTERVIEW_UUID","full_transcript":"This is the complete interview transcript text here..."}'

  Update transcript:
  curl -i --location --request PUT 'http://127.0.0.1:54321/functions/v1/transcripts/TRANSCRIPT_UUID' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json' \
    --data '{"full_transcript":"Updated transcript content here..."}'

  Delete transcript:
  curl -i --location --request DELETE 'http://127.0.0.1:54321/functions/v1/transcripts/TRANSCRIPT_UUID' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json'

*/
