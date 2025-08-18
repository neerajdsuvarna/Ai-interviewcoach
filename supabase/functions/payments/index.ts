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
      payments: {
        Row: {
          id: string
          user_id: string
          interview_id: string
          amount: number
          provider: string
          payment_status: string
          transaction_id: string
          paid_at: string
        }
        Insert: {
          id?: string
          user_id: string
          interview_id: string
          amount: number
          provider?: string
          payment_status?: string
          transaction_id: string
          paid_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          interview_id?: string
          amount?: number
          provider?: string
          payment_status?: string
          transaction_id?: string
          paid_at?: string
        }
      }
    }
  }
}

interface PaymentRequest {
  interview_id: string
  amount: number
  provider?: string
  payment_status?: string
  transaction_id: string
  paid_at?: string
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
        return await handleCreatePayment(supabaseClient, req, user)
      
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

async function handleCreatePayment(supabaseClient: any, req: Request, user: any) {
  try {
    const body = await req.json()
    const { interview_id, amount, provider, payment_status, transaction_id, paid_at }: PaymentRequest = body

    // Validate required fields
    if (!interview_id || !amount || !transaction_id) {
      return new Response(
        JSON.stringify({ 
          error: 'Bad request', 
          message: 'interview_id, amount, and transaction_id are required' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate amount is a positive number
    if (typeof amount !== 'number' || amount <= 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Bad request', 
          message: 'amount must be a positive number' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate interview_id is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(interview_id)) {
      return new Response(
        JSON.stringify({ 
          error: 'Bad request', 
          message: 'interview_id must be a valid UUID' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate transaction_id is not empty
    if (!transaction_id.trim()) {
      return new Response(
        JSON.stringify({ 
          error: 'Bad request', 
          message: 'transaction_id cannot be empty' 
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
      .select('id')
      .eq('id', interview_id)
      .eq('user_id', user.id)
      .single()

    if (interviewError || !interview) {
      return new Response(
        JSON.stringify({ 
          error: 'Not found', 
          message: 'Interview not found or you do not have access to it' 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Prepare payment data with defaults
    const paymentData = {
      user_id: user.id,
      interview_id: interview_id.trim(),
      amount: amount,
      provider: provider || 'dodo',
      payment_status: payment_status || 'success',
      transaction_id: transaction_id.trim(),
      paid_at: paid_at || new Date().toISOString()
    }

    // Create new payment
    const { data: newPayment, error } = await supabaseClient
      .from('payments')
      .insert(paymentData)
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
        data: newPayment,
        message: 'Payment created successfully'
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error creating payment:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create payment', 
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

  Create a new payment:
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/payments' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json' \
    --data '{"interview_id":"INTERVIEW_UUID","amount":99.99,"provider":"stripe","payment_status":"success","transaction_id":"txn_123456789"}'

  Create a payment with minimal data (uses defaults):
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/payments' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --header 'Content-Type: application/json' \
    --data '{"interview_id":"INTERVIEW_UUID","amount":49.99,"transaction_id":"txn_minimal_test"}'

*/
