// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Database interface updated to work with auth.users instead of public.users
interface Database {
  auth: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          created_at: string
          updated_at: string
          last_sign_in_at: string
          user_metadata: Record<string, any>
          app_metadata: Record<string, any>
        }
      }
    }
  }
}

interface UpdateUserMetadataRequest {
  full_name?: string
  // Note: plan functionality removed - can be stored in user_metadata if needed
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

    // Handle different HTTP methods
    switch (req.method) {
      case 'POST':
        return await handleGetAuthUser(user)  // Changed to just return auth user data
      
      case 'GET':
        return await handleGetAuthUser(user)
      
      case 'PUT':
        return await handleUpdateUserMetadata(supabaseClient, req, user)
      
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

async function handleGetAuthUser(authUser: any) {
  try {
    // Format auth user data to match expected structure
    const userData = {
      id: authUser.id,
      email: authUser.email,
      full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'User',
      created_at: authUser.created_at,
      updated_at: authUser.updated_at,
      last_sign_in_at: authUser.last_sign_in_at,
      user_metadata: authUser.user_metadata || {},
      app_metadata: authUser.app_metadata || {}
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: userData,
        message: 'User data retrieved from authentication system'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error getting auth user:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to get user data', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

// Function removed - replaced by handleGetAuthUser

async function handleUpdateUserMetadata(supabaseClient: any, req: Request, authUser: any) {
  try {
    const body = await req.json()
    const { full_name }: UpdateUserMetadataRequest = body

    // Build metadata update object
    const metadataUpdate: any = {}
    if (full_name !== undefined) metadataUpdate.full_name = full_name

    if (Object.keys(metadataUpdate).length === 0) {
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

    // Update user metadata using Supabase auth admin API
    const { data: updatedUser, error } = await supabaseClient.auth.admin.updateUserById(
      authUser.id,
      {
        user_metadata: {
          ...authUser.user_metadata,
          ...metadataUpdate
        }
      }
    )

    if (error) {
      console.error('Auth update error:', error)
      return new Response(
        JSON.stringify({ 
          error: 'Update failed', 
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
        data: {
          id: updatedUser.id,
          email: updatedUser.email,
          full_name: updatedUser.user_metadata?.full_name || updatedUser.user_metadata?.name || 'User',
          created_at: updatedUser.created_at,
          updated_at: updatedUser.updated_at,
          user_metadata: updatedUser.user_metadata || {}
        },
        message: 'User metadata updated successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error updating user metadata:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update user metadata', 
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

  Get auth user data (POST or GET both work the same):
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-user' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json'

  Get current auth user:
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/create-user' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json'

  Update user metadata:
  curl -i --location --request PUT 'http://127.0.0.1:54321/functions/v1/create-user' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json' \
    --data '{"full_name":"John Smith"}'

  Note: This function now works with auth.users instead of public.users table.
  Plan functionality has been removed - can be stored in user_metadata if needed.

*/
