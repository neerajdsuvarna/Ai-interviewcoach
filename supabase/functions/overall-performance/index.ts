// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Database {
  public: {
    Tables: {
      overall_evaluation: {
        Row: {
          id: string
          user_id: string
          analysis_data: any
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          analysis_data: any
          created_at?: string
        }
      }
      interview_feedback: {
        Row: {
          id: string
          interview_id: string
          metrics: any | null
          created_at: string
        }
      }
      interviews: {
        Row: {
          id: string
          user_id: string
          resume_id: string
          jd_id: string
          created_at: string
        }
      }
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create authenticated Supabase client
    const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Get the authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[INFO] Fetching interview feedback metrics for user: ${user.id}`)

    // STEP 1: Fetch all interview feedback with metrics for this user (hierarchically ordered)
    // Order by interview creation time (oldest first) for chronological analysis
    const { data: feedbacks, error: fetchError } = await supabaseClient
      .from('interview_feedback')
      .select(`
        id,
        interview_id,
        metrics,
        created_at,
        interviews!inner(
          user_id,
          created_at,
          resume_id,
          jd_id
        )
      `)
      .eq('interviews.user_id', user.id)
      .not('metrics', 'is', null)  // Only get feedbacks with metrics
      .order('created_at', { ascending: true })  // ✅ FIXED: Order by feedback created_at (close to interview time)

    if (fetchError) {
      console.error(`[ERROR] Failed to fetch feedbacks: ${fetchError.message}`)
      return new Response(
        JSON.stringify({
          error: 'Database error',
          message: `Failed to fetch interview feedback: ${fetchError.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!feedbacks || feedbacks.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No data found',
          message: 'No interview feedback with metrics found for this user',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`[INFO] Found ${feedbacks.length} interview feedbacks with metrics`)

    // ✅ FIXED: Sort by interview created_at in JavaScript for accurate chronological order
    feedbacks.sort((a, b) => {
      const aDate = new Date(a.interviews.created_at).getTime()
      const bDate = new Date(b.interviews.created_at).getTime()
      return aDate - bDate  // Ascending order (oldest first)
    })

    // Clean up the feedbacks data structure for the backend API
    // Remove the nested interviews object and flatten it
    const cleanedFeedbacks = feedbacks.map((feedback: any, index: number) => {
      const { interviews, ...rest } = feedback
      return {
        ...rest,
        interview_number: index + 1,
        interview_start_time: interviews.created_at,
        resume_id: interviews.resume_id,
        jd_id: interviews.jd_id,
      }
    })

    // STEP 2: Call backend API with the metrics data
    // Get backend API URL from environment or use default
    // For local development, use host.docker.internal to access host machine
    // For production, use your actual backend URL
    const backendUrl = Deno.env.get('BACKEND_URL') || 'http://host.docker.internal:5000'
    const backendApiUrl = `${backendUrl}/api/analyze-performance-trends`

    console.log(`[INFO] Calling backend API: ${backendApiUrl}`)
    console.log(`[INFO] Sending ${cleanedFeedbacks.length} feedbacks for analysis`)

    const backendResponse = await fetch(backendApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        feedbacks: cleanedFeedbacks,
        model: 'llama3',
      }),
    })

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text()
      console.error(`[ERROR] Backend API error: ${backendResponse.status} - ${errorText}`)
      return new Response(
        JSON.stringify({
          error: 'Backend API error',
          message: `Failed to analyze performance: ${backendResponse.status}`,
          details: errorText,
        }),
        {
          status: backendResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const backendResult = await backendResponse.json()

    if (!backendResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Analysis failed',
          message: backendResult.message || 'Failed to analyze performance',
          data: backendResult.data,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // STEP 3: Save analysis result to overall_evaluation table
    // Always ensure ONE record per user - delete old ones and create/update
    const supabaseServiceClient = createClient<Database>(supabaseUrl, supabaseServiceKey)

    // Extract only the fields needed for analysis_data
    const analysisDataToStore = {
      summary: backendResult.data.llm_explanations?.summary || '',
      improvement_areas: backendResult.data.llm_explanations?.improvement_areas || [],
      recommendations: backendResult.data.llm_explanations?.recommendations || [],
      confidence_level: backendResult.data.llm_explanations?.confidence_level || 'medium',
      // Also include full analysis for reference
      full_analysis: backendResult.data
    }

    // Check if user already has an evaluation record
    const { data: existingEvaluations } = await supabaseServiceClient
      .from('overall_evaluation')
      .select('id')
      .eq('user_id', user.id)

    let evaluationData
    let saveError

    if (existingEvaluations && existingEvaluations.length > 0) {
      // User has existing record(s) - update the most recent one and delete others
      console.log(`[INFO] Found ${existingEvaluations.length} existing evaluation record(s) for user ${user.id}`)
      
      // Get the most recent record ID
      const mostRecentId = existingEvaluations[0].id
      
      // Delete all other records (if any)
      if (existingEvaluations.length > 1) {
        const otherIds = existingEvaluations
          .filter(e => e.id !== mostRecentId)
          .map(e => e.id)
        
        const { error: deleteError } = await supabaseServiceClient
          .from('overall_evaluation')
          .delete()
          .in('id', otherIds)
          .eq('user_id', user.id)
        
        if (deleteError) {
          console.warn(`[WARNING] Failed to delete old evaluation records: ${deleteError.message}`)
        } else {
          console.log(`[INFO] Deleted ${otherIds.length} old evaluation record(s)`)
        }
      }
      
      // Update the most recent record
      console.log(`[INFO] Updating existing evaluation record (ID: ${mostRecentId}) for user ${user.id}`)
      const { data: updatedData, error: updateError } = await supabaseServiceClient
        .from('overall_evaluation')
        .update({
          analysis_data: analysisDataToStore,
          created_at: new Date().toISOString() // Update timestamp
        })
        .eq('id', mostRecentId)
        .eq('user_id', user.id)
        .select()
        .single()
      
      evaluationData = updatedData
      saveError = updateError
    } else {
      // No existing record - create new one
      console.log(`[INFO] Creating new evaluation record for user ${user.id}`)
      const { data: insertedData, error: insertErr } = await supabaseServiceClient
        .from('overall_evaluation')
        .insert({
          user_id: user.id,
          analysis_data: analysisDataToStore,
        })
        .select()
        .single()
      
      evaluationData = insertedData
      saveError = insertErr
    }

    if (saveError) {
      console.error(`[ERROR] Failed to save evaluation: ${saveError.message}`)
      return new Response(
        JSON.stringify({
          error: 'Database error',
          message: `Failed to save evaluation: ${saveError.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`[INFO] Successfully saved/updated evaluation for user ${user.id}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Overall performance analysis completed and saved',
        data: {
          evaluation_id: evaluationData.id,
          created_at: evaluationData.created_at,
          total_interviews_analyzed: cleanedFeedbacks.length,
          analysis: analysisDataToStore,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error(`[ERROR] Unexpected error: ${error.message}`)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
