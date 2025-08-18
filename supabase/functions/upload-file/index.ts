// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UploadRequest {
  file: File
  folder?: string
  bucket?: string
  filename?: string
}

interface UploadResponse {
  success: boolean
  data?: {
    public_url: string
    file_path: string
    bucket: string
    file_size: number
    content_type: string
  }
  error?: string
  message?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST method for file uploads
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ 
          error: 'Method not allowed',
          message: 'Only POST method is supported for file uploads'
        }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Verify user authentication using anon key client first
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser()

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

    // Create service role client for storage operations (bypasses RLS)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    return await handleFileUpload(supabaseClient, req, user)

  } catch (error) {
    console.error('Upload function error:', error)
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

async function handleFileUpload(supabaseClient: any, req: Request, user: any): Promise<Response> {
  try {
    // Parse form data
    const formData = await req.formData()
    const file = formData.get('file') as File
    const folder = formData.get('folder') as string || 'uploads'
    const bucket = formData.get('bucket') as string || 'user-files'
    const customFilename = formData.get('filename') as string

    // Validate file
    if (!file) {
      return new Response(
        JSON.stringify({ 
          error: 'Bad request', 
          message: 'No file provided' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({ 
          error: 'File too large', 
          message: `File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB` 
        }),
        {
          status: 413,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create unique filename to avoid conflicts
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const originalName = customFilename || file.name
    const fileExtension = originalName.split('.').pop()
    const baseName = originalName.replace(/\.[^/.]+$/, "")
    const uniqueFilename = `${baseName}_${timestamp}.${fileExtension}`

    // Construct file path with folder structure
    // Format: folder/user_id/filename
    const filePath = `${folder}/${user.id}/${uniqueFilename}`

    // Convert file to array buffer
    const fileArrayBuffer = await file.arrayBuffer()

    // Try to ensure bucket exists, but continue if creation fails (RLS issues in local dev)
    try {
      const { data: bucketData, error: bucketError } = await supabaseClient.storage.createBucket(bucket, {
        public: true,
        allowedMimeTypes: undefined, // Allow all file types
        fileSizeLimit: maxSize
      })
      
      if (bucketError) {
        if (bucketError.message.includes('already exists')) {
          console.log(`ℹ️ Bucket already exists: ${bucket}`)
        } else if (bucketError.message.includes('row-level security policy')) {
          console.log(`⚠️ Cannot create bucket due to RLS policy. Assuming bucket '${bucket}' exists or will be created manually.`)
        } else {
          console.log(`⚠️ Bucket creation failed: ${bucketError.message}. Proceeding with upload attempt.`)
        }
      } else if (bucketData) {
        console.log(`✅ Created bucket: ${bucket}`)
      }
    } catch (bucketError) {
      console.log(`⚠️ Bucket creation exception: ${bucketError.message}. Proceeding with upload attempt.`)
    }

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from(bucket)
      .upload(filePath, fileArrayBuffer, {
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
        upsert: false // Don't overwrite existing files
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      
      // Handle specific upload errors
      if (uploadError.message.includes('already exists')) {
        return new Response(
          JSON.stringify({ 
            error: 'File already exists', 
            message: 'A file with this name already exists in the specified location' 
          }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Upload failed', 
          message: uploadError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get public URL for the uploaded file
    const { data: urlData } = supabaseClient.storage
      .from(bucket)
      .getPublicUrl(filePath)

    // Fix URL for local development (replace kong:8000 with 127.0.0.1:54321)
    const publicUrl = urlData.publicUrl.replace('kong:8000', '127.0.0.1:54321')

    const response: UploadResponse = {
      success: true,
      data: {
        public_url: publicUrl,
        file_path: filePath,
        bucket: bucket,
        file_size: file.size,
        content_type: file.type || 'application/octet-stream'
      },
      message: 'File uploaded successfully'
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('File upload handler error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Upload failed', 
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

  Upload a file:
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/upload-file' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --form 'file=@"/path/to/your/file.pdf"' \
    --form 'folder="resumes"' \
    --form 'bucket="user-files"' \
    --form 'filename="my-resume.pdf"'

  Upload with default settings:
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/upload-file' \
    --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
    --form 'file=@"/path/to/your/file.pdf"'

*/
