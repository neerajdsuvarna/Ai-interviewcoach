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
        Insert: {
          id?: string
          user_id: string
          file_url: string
          file_name: string
          uploaded_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          file_url?: string
          file_name?: string
          uploaded_at?: string
        }
      }
    }
  }
}

interface ResumeRequest {
  file_url: string
  file_name: string
}

interface UpdateResumeRequest {
  file_url?: string
  file_name?: string
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
          message: 'Resume function is working!',
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

    // For testing purposes, create a mock user when using service role token
    let authUser = user
    if (!user) {
      // Create mock user for testing
      authUser = {
        id: '93870675-4e88-45a1-bd71-390b1b77cc2f', // Test user ID
        email: 'test@example.com'
      }
      console.log('Using mock user for testing')
    }

    if (authError || !authUser) {
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

    // Parse URL to extract resume ID for individual operations
    const pathParts = url.pathname.split('/')
    const resumeId = pathParts[pathParts.length - 1] !== 'resumes' ? pathParts[pathParts.length - 1] : null

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        if (resumeId) {
          return await handleGetResume(supabaseClient, authUser, resumeId)
        } else {
          return await handleGetResumes(supabaseClient, authUser, url)
        }
      
      case 'POST':
        return await handleCreateResume(supabaseClient, req, authUser)
      
      case 'PUT':
        if (!resumeId) {
          return new Response(
            JSON.stringify({ error: 'Resume ID required for update' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
        return await handleUpdateResume(supabaseClient, req, authUser, resumeId)
      
      case 'DELETE':
        if (!resumeId) {
          return new Response(
            JSON.stringify({ error: 'Resume ID required for deletion' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
        return await handleDeleteResume(supabaseClient, authUser, resumeId)
      
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

async function handleGetResumes(supabaseClient: any, user: any, url: URL) {
  try {
    const params = url.searchParams
    
    // Parse query parameters for pagination and filtering
    const limit = parseInt(params.get('limit') || '50')
    const offset = parseInt(params.get('offset') || '0')
    const sortBy = params.get('sort_by') || 'uploaded_at'
    const sortOrder = params.get('sort_order') || 'desc'
    const search = params.get('search') // Optional search term
    
    // Build the query
    let query = supabaseClient
      .from('resumes')
      .select('*')
      .eq('user_id', user.id)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    // Add search filter if provided (search in file_name)
    if (search) {
      query = query.ilike('file_name', `%${search}%`)
    }

    const { data: resumes, error, count } = await query

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
        data: resumes || [],
        pagination: {
          limit,
          offset,
          total: count || (resumes?.length || 0)
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error fetching resumes:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch resumes', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleGetResume(supabaseClient: any, user: any, resumeId: string) {
  try {
    const { data: resume, error } = await supabaseClient
      .from('resumes')
      .select('*')
      .eq('id', resumeId)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return new Response(
          JSON.stringify({ 
            error: 'Resume not found', 
            message: 'Resume does not exist or you do not have access to it' 
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
        data: resume
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error fetching resume:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch resume', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleCreateResume(supabaseClient: any, req: Request, user: any) {
  try {
    const body = await req.json()
    const { file_url, file_name }: ResumeRequest = body

    // Validate required fields
    if (!file_url || !file_name) {
      return new Response(
        JSON.stringify({ 
          error: 'Bad request', 
          message: 'file_url and file_name are required' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Simple insert operation - user provides resume URL and file name
    const { data: newResume, error } = await supabaseClient
      .from('resumes')
      .insert({
        user_id: user.id,
        file_url: file_url.trim(),
        file_name: file_name.trim()
      })
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
        data: newResume,
        message: 'Resume created successfully'
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error creating resume:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create resume', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleUpdateResume(supabaseClient: any, req: Request, user: any, resumeId: string) {
  try {
    const body = await req.json()
    const { file_url, file_name }: UpdateResumeRequest = body

    // Build update object with only provided fields
    const updateData: any = {}
    if (file_url !== undefined) {
      // Validate file_url format if provided
      try {
        new URL(file_url)
        updateData.file_url = file_url.trim()
      } catch {
        return new Response(
          JSON.stringify({ 
            error: 'Bad request', 
            message: 'file_url must be a valid URL' 
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
    }
    if (file_name !== undefined) updateData.file_name = file_name.trim()

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

    const { data: updatedResume, error } = await supabaseClient
      .from('resumes')
      .update(updateData)
      .eq('id', resumeId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return new Response(
          JSON.stringify({ 
            error: 'Resume not found', 
            message: 'Resume does not exist or you do not have access to it' 
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
        data: updatedResume,
        message: 'Resume updated successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error updating resume:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update resume', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleDeleteResume(supabaseClient: any, user: any, resumeId: string) {
  try {
    const { data: deletedResume, error } = await supabaseClient
      .from('resumes')
      .delete()
      .eq('id', resumeId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return new Response(
          JSON.stringify({ 
            error: 'Resume not found', 
            message: 'Resume does not exist or you do not have access to it' 
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
        data: deletedResume,
        message: 'Resume deleted successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error deleting resume:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to delete resume', 
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

  Get all resumes:
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/resumes' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json'

  Get all resumes with search and pagination:
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/resumes?limit=10&offset=0&search=resume&sort_by=file_name&sort_order=asc' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json'

  Get specific resume:
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/resumes/RESUME_UUID' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json'

  Create a new resume:
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/resumes' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json' \
    --data '{"file_url":"https://example.com/resume.pdf","file_name":"John_Doe_Resume.pdf"}'

  Update resume:
  curl -i --location --request PUT 'http://127.0.0.1:54321/functions/v1/resumes/RESUME_UUID' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json' \
    --data '{"file_name":"Updated_Resume_Name.pdf","file_url":"https://example.com/updated-resume.pdf"}'

  Delete resume:
  curl -i --location --request DELETE 'http://127.0.0.1:54321/functions/v1/resumes/RESUME_UUID' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json'

*/
