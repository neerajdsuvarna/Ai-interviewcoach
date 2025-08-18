// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature, svix-id, svix-timestamp, svix-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// constant-time string compare
function tsec(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// extract base64 signature for v1 (handles "v1=<b64>", "v1,<b64>", or raw "<b64>")
function extractV1(sigRaw: string): string {
  if (!sigRaw) return "";
  const mEq = /(?:^|,\s*)v1=([A-Za-z0-9+/=]+)(?:,|$)/.exec(sigRaw);
  if (mEq?.[1]) return mEq[1];
  const mComma = /(?:^|,\s*)v1,([A-Za-z0-9+/=]+)(?:,|$)/.exec(sigRaw);
  if (mComma?.[1]) return mComma[1];
  if (sigRaw.includes(",")) return sigRaw.split(",")[1]?.trim() ?? "";
  return sigRaw.trim();
}

serve(async (req) => {
  console.log(`[WEBHOOK] ${req.method} request received at ${new Date().toISOString()}`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("[WEBHOOK] Handling CORS preflight");
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse URL to check for health endpoint
    const url = new URL(req.url)
    
    // Add health check endpoint (no auth required)
    if (url.pathname.endsWith('/health')) {
      console.log("[WEBHOOK] Health check requested");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Dodo webhook function is working!',
          timestamp: new Date().toISOString()
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Only allow POST requests for webhooks
    if (req.method !== 'POST') {
      console.log(`[WEBHOOK] Method not allowed: ${req.method}`);
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log("[WEBHOOK] Processing POST request");

    // 1) Check environment configuration
    const secretRaw = Deno.env.get("DODO_WEBHOOK_SECRET");
    if (!secretRaw) {
      console.error("[WEBHOOK] Missing DODO_WEBHOOK_SECRET");
      return new Response(
        JSON.stringify({ error: "Server misconfiguration" }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log("[WEBHOOK] Webhook secret found");

    // 2) Extract webhook headers (support both webhook-* and svix-*)
    const id = req.headers.get("webhook-id") || req.headers.get("svix-id") || "";
    const ts = req.headers.get("webhook-timestamp") || req.headers.get("svix-timestamp") || "";
    const sigRaw = req.headers.get("webhook-signature") || req.headers.get("svix-signature") || "";
    const rawPayload = await req.text();

    console.log("[WEBHOOK] Headers received:", {
      id: !!id, ts: !!ts, signature: !!sigRaw, payloadLength: rawPayload.length,
    });

    if (!id || !ts || !sigRaw) {
      console.log("[WEBHOOK] Missing required headers");
      return new Response(
        JSON.stringify({ error: "Missing required headers" }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3) Verify webhook signature
    const cleaned = secretRaw.replace(/^whsec_/, "");
    const keyBytes = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signed = `${id}.${ts}.${rawPayload}`;
    const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(signed));
    const computedB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
    const receivedB64 = extractV1(sigRaw);

    console.log("[WEBHOOK] Signature verification:", {
      computed: computedB64.substring(0, 10) + '...',
      received: receivedB64.substring(0, 10) + '...',
    });

    if (!receivedB64 || !tsec(computedB64, receivedB64)) {
      console.error("[WEBHOOK] Invalid signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log("[WEBHOOK] Signature verified successfully");

    // 4) Parse and log webhook event
    let event: any = {};
    try {
      event = JSON.parse(rawPayload);
      console.log("[WEBHOOK] Event parsed successfully:", {
        id: event.id,
        type: event.type,
        data: event.data
      });
    } catch (error) {
      console.warn("[WEBHOOK] Failed to parse JSON payload:", error);
      // Even if parsing fails, we verified signature; return 200
    }

    console.log("[WEBHOOK] Successfully processed webhook event:", {
      event_id: event.id,
      event_type: event.type,
      timestamp: new Date().toISOString()
    });

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Webhook processed successfully",
        event_type: event.type,
        event_id: event.id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error("[WEBHOOK ERROR]:", error);
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
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  Health check:
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/dodo-webhook/health' \
    --header 'Content-Type: application/json'

  Test webhook (with proper signature):
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/dodo-webhook' \
    --header 'Content-Type: application/json' \
    --header 'webhook-id: test_webhook_id' \
    --header 'webhook-timestamp: 1234567890' \
    --header 'webhook-signature: v1=YOUR_COMPUTED_SIGNATURE' \
    --data '{"id":"evt_test","type":"payment.succeeded","data":{"id":"txn_123","object":"payment","amount":9999,"currency":"usd","status":"succeeded","created":1234567890}}'

  Note: You need to set the DODO_WEBHOOK_SECRET environment variable for signature verification to work.

*/
