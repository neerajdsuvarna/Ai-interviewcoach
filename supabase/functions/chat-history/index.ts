import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', // ✅ ADD THIS LINE
}

interface Database {
  public: {
    Tables: {
      chatwindow_history: {
        Row: {
          id: string
          interview_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          interview_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          interview_id?: string
          content?: string
          created_at?: string
        }
      }
    }
  }
}

interface ChatHistoryRequest {
  interview_id: string
  content: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200, 
      headers: corsHeaders 
    })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseClient = createClient<Database>(supabaseUrl, supabaseServiceKey)

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const historyId = pathParts[pathParts.length - 1] !== 'chat-history' ? pathParts[pathParts.length - 1] : null

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        if (historyId) {
          return await handleGetChatHistory(supabaseClient, historyId)
        } else {
          return await handleGetChatHistoryByInterview(supabaseClient, url)
        }
      
      case 'POST':
        return await handleCreateOrUpdateChatHistory(supabaseClient, req)
      
      case 'PUT':
        if (!historyId) {
          return new Response(
            JSON.stringify({ error: 'History ID required for update' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return await handleUpdateChatHistory(supabaseClient, req, historyId)
      
      case 'DELETE':
        // Check if we have interview_id in query parameters
        const interviewId = url.searchParams.get('interview_id')
        if (interviewId) {
          return await handleDeleteChatHistoryByInterview(supabaseClient, interviewId)
        } else if (historyId) {
          return await handleDeleteChatHistory(supabaseClient, historyId)
        } else {
          return new Response(
            JSON.stringify({ error: 'History ID or interview_id required for deletion' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      
      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleGetChatHistoryByInterview(supabaseClient: any, url: URL) {
  try {
    const interview_id = url.searchParams.get('interview_id')
    
    if (!interview_id) {
      return new Response(
        JSON.stringify({ error: 'interview_id parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get chat history for the interview
    const { data: history, error } = await supabaseClient
      .from('chatwindow_history')
      .select('*')
      .eq('interview_id', interview_id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch chat history', 
          message: error.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        history: history || []
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error fetching chat history:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch chat history', 
        message: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleCreateOrUpdateChatHistory(supabaseClient: any, req: Request) {
  try {
    const body: ChatHistoryRequest = await req.json()
    
    // Validate required fields
    if (!body.interview_id || !body.content) {
      return new Response(
        JSON.stringify({ error: 'interview_id and content are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if chat history already exists for this interview
    const { data: existingHistory, error: fetchError } = await supabaseClient
      .from('chatwindow_history')
      .select('*')
      .eq('interview_id', body.interview_id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Database error:', fetchError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to check existing history', 
          message: fetchError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let result;
    if (existingHistory) {
      // Update existing history by appending new content
      const updatedContent = existingHistory.content + '\n' + body.content;
      
      const { data: updatedHistory, error: updateError } = await supabaseClient
        .from('chatwindow_history')
        .update({ content: updatedContent })
        .eq('id', existingHistory.id)
        .select()
        .single()

      if (updateError) {
        console.error('Database error:', updateError)
        return new Response(
          JSON.stringify({ 
            error: 'Failed to update chat history', 
            message: updateError.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      result = updatedHistory;
    } else {
      // Create new history record
      const { data: newHistory, error: insertError } = await supabaseClient
        .from('chatwindow_history')
        .insert([{
          interview_id: body.interview_id,
          content: body.content
        }])
        .select()
        .single()

      if (insertError) {
        console.error('Database error:', insertError)
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create chat history', 
            message: insertError.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      result = newHistory;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        history: result
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error creating/updating chat history:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create/update chat history', 
        message: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleGetChatHistory(supabaseClient: any, historyId: string) {
  try {
    const { data: history, error } = await supabaseClient
      .from('chatwindow_history')
      .select('*')
      .eq('id', historyId)
      .single()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch chat history', 
          message: error.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!history) {
      return new Response(
        JSON.stringify({ error: 'Chat history not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        history: history
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error fetching chat history:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch chat history', 
        message: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleUpdateChatHistory(supabaseClient: any, req: Request, historyId: string) {
  try {
    const body = await req.json()
    
    // Remove fields that shouldn't be updated
    const { id, created_at, ...updateData } = body

    const { data: history, error } = await supabaseClient
      .from('chatwindow_history')
      .update(updateData)
      .eq('id', historyId)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to update chat history', 
          message: error.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!history) {
      return new Response(
        JSON.stringify({ error: 'Chat history not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        history: history
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error updating chat history:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update chat history', 
        message: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleDeleteChatHistory(supabaseClient: any, historyId: string) {
  try {
    const { error } = await supabaseClient
      .from('chatwindow_history')
      .delete()
      .eq('id', historyId)

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to delete chat history', 
          message: error.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Chat history deleted successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error deleting chat history:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to delete chat history', 
        message: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleDeleteChatHistoryByInterview(supabaseClient: any, interviewId: string) {
  try {
    const { error } = await supabaseClient
      .from('chatwindow_history')
      .delete()
      .eq('interview_id', interviewId)

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to delete chat history', 
          message: error.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Chat history deleted successfully' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error deleting chat history:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to delete chat history', 
        message: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
