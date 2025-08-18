// @ts-ignore: Deno types
declare global {
  const Deno: any;
}

// @ts-ignore: Deno remote imports
import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts"
// @ts-ignore: Deno remote imports
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"

// Test configuration
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321"
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/create-user`

// Test user credentials - these should be valid test users in your Supabase instance
const TEST_EMAIL = "testy@example.com"
const TEST_PASSWORD = "testpassword123"

let supabase: SupabaseClient
let authToken: string

async function setupTestUser() {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  
  // Sign up or sign in test user
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  })

  if (signUpError && signUpError.message !== "User already registered") {
    throw new Error(`Failed to create test user: ${signUpError.message}`)
  }

  // Sign in to get session
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  })

  if (signInError) {
    throw new Error(`Failed to sign in test user: ${signInError.message}`)
  }

  authToken = signInData.session?.access_token ?? ""
  if (!authToken) {
    throw new Error("Failed to get auth token")
  }

  console.log("Test user setup complete")
}

async function cleanupTestUser() {
  if (supabase) {
    // Clean up test user from users table
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('email', TEST_EMAIL)
    
    if (deleteError) {
      console.warn(`Warning: Could not clean up test user: ${deleteError.message}`)
    }

    // Sign out
    await supabase.auth.signOut()
  }
}

async function makeRequest(method: string, body?: any): Promise<Response> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  }

  const options: RequestInit = {
    method,
    headers,
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  return await fetch(FUNCTION_URL, options)
}

Deno.test("Create User Edge Function Tests", async (t) => {
  await setupTestUser()

  await t.step("should handle CORS preflight request", async () => {
    const response = await fetch(FUNCTION_URL, {
      method: 'OPTIONS',
    })

    assertEquals(response.status, 200)
    assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
    assertExists(response.headers.get('Access-Control-Allow-Headers'))
  })

  await t.step("should reject requests without auth token", async () => {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ full_name: "Test User" }),
    })

    assertEquals(response.status, 401)
    
    const data = await response.json()
    assertEquals(data.error, "Unauthorized")
  })

  await t.step("should reject requests with invalid auth token", async () => {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer invalid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ full_name: "Test User" }),
    })

    assertEquals(response.status, 401)
    
    const data = await response.json()
    assertEquals(data.error, "Unauthorized")
  })

  await t.step("should create a new user successfully", async () => {
    const userData = {
      full_name: "Test User",
      plan: "premium"
    }

    const response = await makeRequest('POST', userData)
    
    assertEquals(response.status, 201)
    
    const data = await response.json()
    assertEquals(data.success, true)
    assertEquals(data.message, "User created successfully")
    assertExists(data.data)
    assertEquals(data.data.email, TEST_EMAIL)
    assertEquals(data.data.full_name, "Test User")
    assertEquals(data.data.plan, "premium")
    assertExists(data.data.id)
    assertExists(data.data.created_at)
  })

  await t.step("should return existing user if user already exists", async () => {
    const userData = {
      full_name: "Test User Updated",
      plan: "basic"
    }

    const response = await makeRequest('POST', userData)
    
    assertEquals(response.status, 200)
    
    const data = await response.json()
    assertEquals(data.success, true)
    assertEquals(data.message, "User already exists")
    assertExists(data.data)
    assertEquals(data.data.email, TEST_EMAIL)
    // Should return existing user data, not the new data from request
    assertEquals(data.data.full_name, "Test User")
    assertEquals(data.data.plan, "premium")
  })

  await t.step("should get user profile successfully", async () => {
    const response = await makeRequest('GET')
    
    assertEquals(response.status, 200)
    
    const data = await response.json()
    assertEquals(data.success, true)
    assertExists(data.data)
    assertEquals(data.data.email, TEST_EMAIL)
    assertEquals(data.data.full_name, "Test User")
    assertEquals(data.data.plan, "premium")
    assertExists(data.data.id)
    assertExists(data.data.created_at)
  })

  await t.step("should update user profile successfully", async () => {
    const updateData = {
      full_name: "Updated Test User",
      plan: "enterprise"
    }

    const response = await makeRequest('PUT', updateData)
    
    assertEquals(response.status, 200)
    
    const data = await response.json()
    assertEquals(data.success, true)
    assertEquals(data.message, "User updated successfully")
    assertExists(data.data)
    assertEquals(data.data.email, TEST_EMAIL)
    assertEquals(data.data.full_name, "Updated Test User")
    assertEquals(data.data.plan, "enterprise")
  })

  await t.step("should update only provided fields", async () => {
    const updateData = {
      full_name: "Partially Updated User"
      // plan not provided, should remain unchanged
    }

    const response = await makeRequest('PUT', updateData)
    
    assertEquals(response.status, 200)
    
    const data = await response.json()
    assertEquals(data.success, true)
    assertEquals(data.data.full_name, "Partially Updated User")
    assertEquals(data.data.plan, "enterprise") // Should remain unchanged
  })

  await t.step("should reject update with no valid fields", async () => {
    const updateData = {}

    const response = await makeRequest('PUT', updateData)
    
    assertEquals(response.status, 400)
    
    const data = await response.json()
    assertEquals(data.error, "Bad request")
    assertEquals(data.message, "No valid fields provided for update")
  })

  await t.step("should reject unsupported HTTP methods", async () => {
    const response = await fetch(FUNCTION_URL, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    })

    assertEquals(response.status, 405)
    
    const data = await response.json()
    assertEquals(data.error, "Method not allowed")
  })

  await t.step("should create user with default plan when plan not provided", async () => {
    // First clean up existing user
    await supabase.from('users').delete().eq('email', TEST_EMAIL)

    const userData = {
      full_name: "Test User Default Plan"
      // plan not provided, should default to "basic"
    }

    const response = await makeRequest('POST', userData)
    
    assertEquals(response.status, 201)
    
    const data = await response.json()
    assertEquals(data.success, true)
    assertEquals(data.data.plan, "basic") // Should default to basic
    assertEquals(data.data.full_name, "Test User Default Plan")
  })

  await t.step("should handle malformed JSON in request body", async () => {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: '{"invalid": json}', // Invalid JSON
    })

    // Should handle gracefully and not crash
    assertEquals(response.status >= 400, true)
  })

  // Cleanup
  await cleanupTestUser()
})

// Utility function to run a single test for debugging
export async function runSingleTest(testName: string) {
  await setupTestUser()
  
  try {
    switch (testName) {
      case "create":
        const createResponse = await makeRequest('POST', {
          full_name: "Single Test User",
          plan: "premium"
        })
        console.log("Create response:", await createResponse.json())
        break
        
      case "get":
        const getResponse = await makeRequest('GET')
        console.log("Get response:", await getResponse.json())
        break
        
      case "update":
        const updateResponse = await makeRequest('PUT', {
          full_name: "Updated Single Test User"
        })
        console.log("Update response:", await updateResponse.json())
        break
        
      default:
        console.log("Unknown test name. Available: create, get, update")
    }
  } catch (error) {
    console.error("Test error:", error)
  } finally {
    await cleanupTestUser()
  }
}

// Example usage:
// deno run --allow-net --allow-env test.ts
// or import and call: runSingleTest("create")
