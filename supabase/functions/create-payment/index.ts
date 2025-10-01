import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  console.log(`[CREATE-PAYMENT] Environment check:`, {
    hasDodoApiKey: !!Deno.env.get('DODO_API_KEY'),
    hasWebhookSecret: !!Deno.env.get('DODO_WEBHOOK_SECRET'),
    hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
    hasServiceKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  });

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user session
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { resume_id, jd_id, question_set, retake_from, interview_id } = await req.json()

    if (!resume_id || !jd_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: resume_id, jd_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify resume and JD ownership
    const { data: resume, error: resumeError } = await supabase
      .from('resumes')
      .select('id')
      .eq('id', resume_id)
      .eq('user_id', user.id)
      .single()

    if (resumeError || !resume) {
      return new Response(
        JSON.stringify({ error: 'Resume not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: jd, error: jdError } = await supabase
      .from('job_descriptions')
      .select('id')
      .eq('id', jd_id)
      .eq('user_id', user.id)
      .single()

    if (jdError || !jd) {
      return new Response(
        JSON.stringify({ error: 'Job description not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create checkout session with metadata using Dodo API
    const dodoApiKey = Deno.env.get('DODO_API_KEY')
    if (!dodoApiKey) {
      return new Response(
        JSON.stringify({ error: 'Payment service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ✅ FIXED: Get the origin from the request headers or use a hardcoded value
    const origin = req.headers.get('origin') || 'http://localhost:5173' // Fallback for local development
    
    // ✅ SIMPLIFIED: Just send the essential data, let user fill details on Dodo's page
    const checkoutData = {
      product_cart: [{
        product_id: 'pdt_ZysPWYwaLlqpLOyatwjHv', // Your product ID
        quantity: 1
      }],
      metadata: {
        resume_id: resume_id,
        jd_id: jd_id,
        question_set: question_set?.toString() || '',
        retake_from: retake_from || '',
        user_id: user.id,
        interview_id: interview_id || '' // ✅ Include interview_id
      },
      // ✅ UPDATED: Include all details needed for questions page redirect
      return_url: `${origin}/payment-success?interview_id=${interview_id}&resume_id=${resume_id}&jd_id=${jd_id}&question_set=${question_set}`,
      confirm: false // ✅ Let user fill all details on Dodo's checkout page
    }

    console.log('[CREATE-PAYMENT] Creating checkout session with metadata:', checkoutData.metadata)
    console.log('[CREATE-PAYMENT] Return URL:', checkoutData.return_url)

    // ✅ UPDATED: Use the correct checkout sessions endpoint
    const dodoResponse = await fetch('https://test.dodopayments.com/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${dodoApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(checkoutData)
    })

    if (!dodoResponse.ok) {
      const errorText = await dodoResponse.text()
      console.error('[CREATE-PAYMENT] Dodo API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to create checkout session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const dodoResult = await dodoResponse.json()
    console.log('[CREATE-PAYMENT] Checkout session created successfully:', dodoResult)

    return new Response(
      JSON.stringify({
        success: true,
        payment_url: dodoResult.checkout_url, // ✅ Use checkout_url from response
        session_id: dodoResult.session_id, // ✅ Use session_id from response
        metadata: checkoutData.metadata
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[CREATE-PAYMENT] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
