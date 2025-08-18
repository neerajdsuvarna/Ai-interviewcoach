import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role (bypass RLS)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Handle POST - Create Resume
    if (req.method === 'POST') {
      const body = await req.json()
      const { file_url, file_name } = body

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

      // Insert resume directly using service role (bypasses RLS)
      const { data, error } = await supabaseClient
        .from('resumes')
        .insert({
          user_id: '93870675-4e88-45a1-bd71-390b1b77cc2f', // Test user ID
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
          data: data,
          message: 'Resume created successfully'
        }),
        {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Handle GET - Get Resumes
    if (req.method === 'GET') {
      const { data, error } = await supabaseClient
        .from('resumes')
        .select('*')
        .eq('user_id', '93870675-4e88-45a1-bd71-390b1b77cc2f')
        .order('uploaded_at', { ascending: false })

      if (error) {
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
          data: data || []
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
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
