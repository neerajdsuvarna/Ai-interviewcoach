// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, PUT, GET, OPTIONS', // Add PUT and GET
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
      
      case 'PUT':
        return await handleUpdatePayment(supabaseClient, req, user)
      
      case 'GET':
        return await handleGetPayment(supabaseClient, req, user)
      
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

async function handleUpdatePayment(supabaseClient: any, req: Request, user: any) {
  try {
    const body = await req.json()
    const { transaction_id, user_id } = body

    // Validate required fields
    if (!transaction_id) {
      return new Response(
        JSON.stringify({ 
          error: 'Bad request', 
          message: 'transaction_id is required' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // ✅ SOLUTION: Create service role client to bypass RLS
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ✅ SOLUTION: Use service role to find payment (bypasses RLS)
    const { data: existingPayment, error: fetchError } = await supabaseServiceClient
      .from('payments')
      .select('*')
      .eq('transaction_id', transaction_id)
      .single()

    if (fetchError || !existingPayment) {
      return new Response(
        JSON.stringify({ 
          error: 'Not found', 
          message: 'Payment not found with this transaction_id' 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // ✅ SOLUTION: Use service role to update payment (bypasses RLS)
    const { data: updatedPayment, error: updateError } = await supabaseServiceClient
      .from('payments')
      .update({ 
        user_id: user.id 
      })
      .eq('transaction_id', transaction_id)
      .select()
      .single()

    if (updateError) {
      console.error('Database error:', updateError)
      return new Response(
        JSON.stringify({ 
          error: 'Database error', 
          message: updateError.message 
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
        data: updatedPayment,
        message: 'Payment updated successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error updating payment:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update payment', 
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleGetPayment(supabaseClient: any, req: Request, user: any) {
  try {
    const url = new URL(req.url)
    const transaction_id = url.searchParams.get('transaction_id')
    const get_all = url.searchParams.get('get_all')

    // If get_all parameter is present, return all payments for the user
    if (get_all === 'true') {
      console.log('Getting all payments for user:', user.id)
      
      const { data: payments, error } = await supabaseClient
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .order('paid_at', { ascending: false })

      if (error) {
        console.error('Error fetching payments:', error)
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
          data: payments || [],
          message: 'Payments retrieved successfully',
          count: payments?.length || 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Original logic for getting single payment by transaction_id
    if (!transaction_id) {
      return new Response(
        JSON.stringify({ 
          error: 'Bad request', 
          message: 'transaction_id parameter is required when not getting all payments' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get the payment by transaction_id
    const { data: payment, error } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('transaction_id', transaction_id)
      .single()

    if (error || !payment) {
      return new Response(
        JSON.stringify({ 
          error: 'Not found', 
          message: 'Payment not found with this transaction_id' 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: payment,
        message: 'Payment retrieved successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error getting payment:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to get payment', 
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
