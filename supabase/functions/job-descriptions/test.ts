import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Test configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? 'your-anon-key-here'
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/job-descriptions`

// Mock JWT token for testing (replace with actual token)
const TEST_JWT_TOKEN = 'your-test-jwt-token-here'

const headers = {
  'Authorization': `Bearer ${TEST_JWT_TOKEN}`,
  'Content-Type': 'application/json',
}

// Test data
const testJobDescription = {
  title: 'Test Software Engineer Position',
  description: 'This is a test job description for a software engineer position. We are looking for someone with experience in TypeScript, React, and Node.js.',
  file_url: 'https://example.com/test-jd.pdf'
}

const updatedJobDescription = {
  title: 'Updated Test Software Engineer Position',
  description: 'This is an updated test job description.',
  file_url: 'https://example.com/updated-test-jd.pdf'
}

let createdJobDescriptionId: string

Deno.test("Job Descriptions API - Full CRUD Test Suite", async (t) => {
  
  await t.step("1. Create Job Description", async () => {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(testJobDescription)
    })

    const data = await response.json()
    console.log('Create response:', data)

    assertEquals(response.status, 201)
    assertEquals(data.success, true)
    assertExists(data.data.id)
    assertEquals(data.data.title, testJobDescription.title)
    assertEquals(data.data.description, testJobDescription.description)
    assertEquals(data.data.file_url, testJobDescription.file_url)
    
    // Store the ID for subsequent tests
    createdJobDescriptionId = data.data.id
  })

  await t.step("2. Get All Job Descriptions", async () => {
    const response = await fetch(FUNCTION_URL, {
      method: 'GET',
      headers
    })

    const data = await response.json()
    console.log('Get all response:', data)

    assertEquals(response.status, 200)
    assertEquals(data.success, true)
    assertExists(data.data)
    assertExists(data.pagination)
    
    // Should contain our created job description
    const createdJD = data.data.find((jd: any) => jd.id === createdJobDescriptionId)
    assertExists(createdJD)
  })

  await t.step("3. Get All Job Descriptions with Search", async () => {
    const searchUrl = `${FUNCTION_URL}?search=Test Software&limit=5&offset=0&sort_order=desc`
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers
    })

    const data = await response.json()
    console.log('Search response:', data)

    assertEquals(response.status, 200)
    assertEquals(data.success, true)
    assertExists(data.data)
    
    // Should find our test job description
    const foundJD = data.data.find((jd: any) => jd.id === createdJobDescriptionId)
    assertExists(foundJD)
  })

  await t.step("4. Get Single Job Description", async () => {
    const response = await fetch(`${FUNCTION_URL}/${createdJobDescriptionId}`, {
      method: 'GET',
      headers
    })

    const data = await response.json()
    console.log('Get single response:', data)

    assertEquals(response.status, 200)
    assertEquals(data.success, true)
    assertEquals(data.data.id, createdJobDescriptionId)
    assertEquals(data.data.title, testJobDescription.title)
  })

  await t.step("5. Update Job Description", async () => {
    const response = await fetch(`${FUNCTION_URL}/${createdJobDescriptionId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updatedJobDescription)
    })

    const data = await response.json()
    console.log('Update response:', data)

    assertEquals(response.status, 200)
    assertEquals(data.success, true)
    assertEquals(data.data.id, createdJobDescriptionId)
    assertEquals(data.data.title, updatedJobDescription.title)
    assertEquals(data.data.description, updatedJobDescription.description)
    assertEquals(data.data.file_url, updatedJobDescription.file_url)
  })

  await t.step("6. Partial Update Job Description", async () => {
    const partialUpdate = { title: 'Partially Updated Title' }
    
    const response = await fetch(`${FUNCTION_URL}/${createdJobDescriptionId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(partialUpdate)
    })

    const data = await response.json()
    console.log('Partial update response:', data)

    assertEquals(response.status, 200)
    assertEquals(data.success, true)
    assertEquals(data.data.title, partialUpdate.title)
    // Description should remain the same from previous update
    assertEquals(data.data.description, updatedJobDescription.description)
  })

  await t.step("7. Delete Job Description", async () => {
    const response = await fetch(`${FUNCTION_URL}/${createdJobDescriptionId}`, {
      method: 'DELETE',
      headers
    })

    const data = await response.json()
    console.log('Delete response:', data)

    assertEquals(response.status, 200)
    assertEquals(data.success, true)
    assertEquals(data.data.id, createdJobDescriptionId)
  })

  await t.step("8. Verify Job Description is Deleted", async () => {
    const response = await fetch(`${FUNCTION_URL}/${createdJobDescriptionId}`, {
      method: 'GET',
      headers
    })

    const data = await response.json()
    console.log('Verify deletion response:', data)

    assertEquals(response.status, 404)
    assertEquals(data.error, 'Job description not found')
  })
})

Deno.test("Job Descriptions API - Error Handling Tests", async (t) => {
  
  await t.step("1. Test Unauthorized Access", async () => {
    const response = await fetch(FUNCTION_URL, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' } // No Authorization header
    })

    const data = await response.json()
    console.log('Unauthorized response:', data)

    assertEquals(response.status, 401)
    assertEquals(data.error, 'Unauthorized')
  })

  await t.step("2. Test Create with Missing Required Fields", async () => {
    const invalidData = { title: 'Only Title' } // Missing description
    
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(invalidData)
    })

    const data = await response.json()
    console.log('Missing fields response:', data)

    assertEquals(response.status, 400)
    assertEquals(data.error, 'Bad request')
  })

  await t.step("3. Test Update Non-existent Job Description", async () => {
    const fakeId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    
    const response = await fetch(`${FUNCTION_URL}/${fakeId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ title: 'Updated Title' })
    })

    const data = await response.json()
    console.log('Update non-existent response:', data)

    assertEquals(response.status, 404)
    assertEquals(data.error, 'Job description not found')
  })

  await t.step("4. Test Delete Non-existent Job Description", async () => {
    const fakeId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    
    const response = await fetch(`${FUNCTION_URL}/${fakeId}`, {
      method: 'DELETE',
      headers
    })

    const data = await response.json()
    console.log('Delete non-existent response:', data)

    assertEquals(response.status, 404)
    assertEquals(data.error, 'Job description not found')
  })

  await t.step("5. Test Unsupported HTTP Method", async () => {
    const response = await fetch(FUNCTION_URL, {
      method: 'PATCH', // Unsupported method
      headers
    })

    const data = await response.json()
    console.log('Unsupported method response:', data)

    assertEquals(response.status, 405)
    assertEquals(data.error, 'Method not allowed')
  })

  await t.step("6. Test Update with No Fields", async () => {
    // First create a job description for this test
    const createResponse = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(testJobDescription)
    })
    const createdData = await createResponse.json()
    const testId = createdData.data.id

    // Try to update with empty object
    const response = await fetch(`${FUNCTION_URL}/${testId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({})
    })

    const data = await response.json()
    console.log('Empty update response:', data)

    assertEquals(response.status, 400)
    assertEquals(data.error, 'Bad request')

    // Clean up - delete the test job description
    await fetch(`${FUNCTION_URL}/${testId}`, {
      method: 'DELETE',
      headers
    })
  })
})

/* 
To run these tests:

1. Start your Supabase instance:
   supabase start

2. Make sure you have a valid JWT token and update the TEST_JWT_TOKEN variable

3. Run the tests:
   deno test --allow-net --allow-env supabase/functions/job-descriptions/test.ts

4. Or run with verbose output:
   deno test --allow-net --allow-env --verbose supabase/functions/job-descriptions/test.ts

Note: 
- Replace TEST_JWT_TOKEN with a valid JWT token from your Supabase auth
- Make sure your Supabase instance is running locally on port 54321
- These tests will create and delete actual records in your database
*/
