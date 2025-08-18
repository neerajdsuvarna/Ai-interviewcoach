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
      job_descriptions: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string
          file_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description: string
          file_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string
          file_url?: string | null
          created_at?: string
        }
      }
    }
  }
}

interface JobDescriptionRequest {
  title: string
  description: string
  file_url?: string | null
}

interface UpdateJobDescriptionRequest {
  title?: string
  description?: string
  file_url?: string | null
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

    // Parse URL to extract job description ID for individual operations
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const jobDescriptionId = pathParts[pathParts.length - 1] !== 'job-descriptions' ? pathParts[pathParts.length - 1] : null

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        if (jobDescriptionId) {
          return await handleGetJobDescription(supabaseClient, user, jobDescriptionId)
        } else {
          return await handleGetJobDescriptions(supabaseClient, user, url)
        }
      
      case 'POST':
        return await handleCreateJobDescription(supabaseClient, req, user)
      
      case 'PUT':
        if (!jobDescriptionId) {
          return new Response(
            JSON.stringify({ error: 'Job description ID required for update' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
        return await handleUpdateJobDescription(supabaseClient, req, user, jobDescriptionId)
      
      case 'DELETE':
        if (!jobDescriptionId) {
          return new Response(
            JSON.stringify({ error: 'Job description ID required for deletion' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
        return await handleDeleteJobDescription(supabaseClient, user, jobDescriptionId)
      
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

async function handleGetJobDescriptions(supabaseClient: any, user: any, url: URL) {
  try {
    const params = url.searchParams
    
    // Parse query parameters for pagination and filtering
    const limit = parseInt(params.get('limit') || '50')
    const offset = parseInt(params.get('offset') || '0')
    const sortBy = params.get('sort_by') || 'created_at'
    const sortOrder = params.get('sort_order') || 'desc'
    const search = params.get('search') // Optional search term
    
    // Build the query
    let query = supabaseClient
      .from('job_descriptions')
      .select('*')
      .eq('user_id', user.id)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    // Add search filter if provided
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data: jobDescriptions, error, count } = await query

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
        data: jobDescriptions || [],
        pagination: {
          limit,
          offset,
          total: count || (jobDescriptions?.length || 0)
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error fetching job descriptions:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch job descriptions', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleGetJobDescription(supabaseClient: any, user: any, jobDescriptionId: string) {
  try {
    const { data: jobDescription, error } = await supabaseClient
      .from('job_descriptions')
      .select('*')
      .eq('id', jobDescriptionId)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return new Response(
          JSON.stringify({ 
            error: 'Job description not found', 
            message: 'Job description does not exist or you do not have access to it' 
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
        data: jobDescription
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error fetching job description:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch job description', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleCreateJobDescription(supabaseClient: any, req: Request, user: any) {
  try {
    const body = await req.json()
    const { title, description, file_url }: JobDescriptionRequest = body

    // Validate required fields
    if (!title || !description) {
      return new Response(
        JSON.stringify({ 
          error: 'Bad request', 
          message: 'Title and description are required' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create new job description
    const { data: newJobDescription, error } = await supabaseClient
      .from('job_descriptions')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim(),
        file_url: file_url || null
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
        data: newJobDescription,
        message: 'Job description created successfully'
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error creating job description:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create job description', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleUpdateJobDescription(supabaseClient: any, req: Request, user: any, jobDescriptionId: string) {
  try {
    const body = await req.json()
    const { title, description, file_url }: UpdateJobDescriptionRequest = body

    // Build update object with only provided fields
    const updateData: any = {}
    if (title !== undefined) updateData.title = title.trim()
    if (description !== undefined) updateData.description = description.trim()
    if (file_url !== undefined) updateData.file_url = file_url

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

    const { data: updatedJobDescription, error } = await supabaseClient
      .from('job_descriptions')
      .update(updateData)
      .eq('id', jobDescriptionId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return new Response(
          JSON.stringify({ 
            error: 'Job description not found', 
            message: 'Job description does not exist or you do not have access to it' 
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
        data: updatedJobDescription,
        message: 'Job description updated successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error updating job description:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update job description', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleDeleteJobDescription(supabaseClient: any, user: any, jobDescriptionId: string) {
  try {
    const { data: deletedJobDescription, error } = await supabaseClient
      .from('job_descriptions')
      .delete()
      .eq('id', jobDescriptionId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return new Response(
          JSON.stringify({ 
            error: 'Job description not found', 
            message: 'Job description does not exist or you do not have access to it' 
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
        data: deletedJobDescription,
        message: 'Job description deleted successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error deleting job description:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to delete job description', 
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

  Get all job descriptions:
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/job-descriptions' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json'

  Get all job descriptions with search and pagination:
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/job-descriptions?limit=10&offset=0&search=developer&sort_by=title&sort_order=asc' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json'

  Get specific job description:
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/job-descriptions/JOB_DESCRIPTION_UUID' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json'

  Create a new job description:
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/job-descriptions' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json' \
    --data '{"title":"Senior Software Engineer","description":"Looking for an experienced software engineer...","file_url":"https://example.com/jd.pdf"}'

  Update job description:
  curl -i --location --request PUT 'http://127.0.0.1:54321/functions/v1/job-descriptions/JOB_DESCRIPTION_UUID' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json' \
    --data '{"title":"Updated Title","description":"Updated description"}'

  Delete job description:
  curl -i --location --request DELETE 'http://127.0.0.1:54321/functions/v1/job-descriptions/JOB_DESCRIPTION_UUID' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json'

*/
