import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/upload-file`;

// Test configuration
const TEST_USER_EMAIL = 'test@example.com';
const TEST_USER_PASSWORD = 'testpassword123';

// Helper function to create a test file
function createTestFile(filename: string, content: string, mimeType: string = 'text/plain'): File {
  const blob = new Blob([content], { type: mimeType });
  return new File([blob], filename, { type: mimeType });
}

// Helper function to create a test image file
function createTestImageFile(filename: string = 'test-image.png'): File {
  // Create a simple PNG file (1x1 pixel transparent)
  const pngData = new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
    0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  
  const blob = new Blob([pngData], { type: 'image/png' });
  return new File([blob], filename, { type: 'image/png' });
}

// Helper function to get auth token for testing
async function getAuthToken(): Promise<string> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Try to sign in with existing test user
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });

  if (signInError) {
    // If sign in fails, try to sign up
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });
    
    if (signUpError) {
      throw new Error(`Failed to authenticate test user: ${signUpError.message}`);
    }
    
    return signUpData.session?.access_token ?? '';
  }
  
  return signInData.session?.access_token ?? '';
}

Deno.test("Upload File Function Tests", async (t) => {
  let authToken: string;
  
  // Setup: Get authentication token
  await t.step("Setup: Get auth token", async () => {
    authToken = await getAuthToken();
    assertExists(authToken, "Auth token should exist");
  });

  // Test 1: CORS preflight request
  await t.step("Should handle CORS preflight request", async () => {
    const response = await fetch(FUNCTION_URL, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type',
      },
    });

    assertEquals(response.status, 200);
    assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  });

  // Test 2: Method not allowed
  await t.step("Should reject non-POST requests", async () => {
    const response = await fetch(FUNCTION_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    assertEquals(response.status, 405);
    const data = await response.json();
    assertEquals(data.error, 'Method not allowed');
  });

  // Test 3: Unauthorized request
  await t.step("Should reject requests without auth token", async () => {
    const formData = new FormData();
    formData.append('file', createTestFile('test.txt', 'test content'));

    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      body: formData,
    });

    assertEquals(response.status, 401);
    const data = await response.json();
    assertEquals(data.error, 'Unauthorized');
  });

  // Test 4: Missing file
  await t.step("Should reject requests without file", async () => {
    const formData = new FormData();
    // Not adding any file

    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
      body: formData,
    });

    assertEquals(response.status, 400);
    const data = await response.json();
    assertEquals(data.error, 'Bad request');
    assertEquals(data.message, 'No file provided');
  });

  // Test 5: Successful file upload with default settings
  await t.step("Should upload file with default settings", async () => {
    const testFile = createTestFile('test-document.txt', 'This is a test document content');
    const formData = new FormData();
    formData.append('file', testFile);

    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
      body: formData,
    });

    assertEquals(response.status, 201);
    const data = await response.json();
    
    assertEquals(data.success, true);
    assertExists(data.data);
    assertExists(data.data.public_url);
    assertExists(data.data.file_path);
    assertEquals(data.data.bucket, 'user-files');
    assertEquals(data.data.file_size, testFile.size);
    assertEquals(data.data.content_type, 'text/plain');
    assertEquals(data.message, 'File uploaded successfully');

    // Verify the file path structure
    assertEquals(data.data.file_path.startsWith('uploads/'), true);
  });

  // Test 6: Upload with custom folder and bucket
  await t.step("Should upload file with custom folder and bucket", async () => {
    const testFile = createTestImageFile('profile-picture.png');
    const formData = new FormData();
    formData.append('file', testFile);
    formData.append('folder', 'images');
    formData.append('bucket', 'user-assets');

    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
      body: formData,
    });

    assertEquals(response.status, 201);
    const data = await response.json();
    
    assertEquals(data.success, true);
    assertEquals(data.data.bucket, 'user-assets');
    assertEquals(data.data.content_type, 'image/png');
    
    // Verify the file path starts with the custom folder
    assertEquals(data.data.file_path.startsWith('images/'), true);
  });

  // Test 7: Upload with custom filename
  await t.step("Should upload file with custom filename", async () => {
    const testFile = createTestFile('original.txt', 'content');
    const customFilename = 'custom-name.txt';
    const formData = new FormData();
    formData.append('file', testFile);
    formData.append('filename', customFilename);

    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
      body: formData,
    });

    assertEquals(response.status, 201);
    const data = await response.json();
    
    assertEquals(data.success, true);
    // The filename should contain the custom name but with timestamp
    assertEquals(data.data.file_path.includes('custom-name'), true);
  });

  // Test 8: Large file upload (should be rejected)
  await t.step("Should reject files larger than 50MB", async () => {
    // Create a file that's larger than 50MB (simulate with metadata)
    const largeContent = 'x'.repeat(1024 * 1024); // 1MB of data
    const testFile = createTestFile('large-file.txt', largeContent);
    
    // Mock a large file size by creating a custom File object
    const largeFile = new File([largeContent], 'large-file.txt', { type: 'text/plain' });
    Object.defineProperty(largeFile, 'size', { value: 60 * 1024 * 1024 }); // 60MB

    const formData = new FormData();
    formData.append('file', largeFile);

    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
      body: formData,
    });

    assertEquals(response.status, 413);
    const data = await response.json();
    assertEquals(data.error, 'File too large');
  });

  // Test 9: Verify public URL accessibility
  await t.step("Should return accessible public URL", async () => {
    const testFile = createTestFile('public-test.txt', 'public content');
    const formData = new FormData();
    formData.append('file', testFile);

    const uploadResponse = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
      body: formData,
    });

    assertEquals(uploadResponse.status, 201);
    const uploadData = await uploadResponse.json();
    
    // Try to access the public URL
    const publicResponse = await fetch(uploadData.data.public_url);
    assertEquals(publicResponse.status, 200);
    
    const content = await publicResponse.text();
    assertEquals(content, 'public content');
  });

  // Test 10: Different file types
  await t.step("Should handle different file types", async () => {
    const testCases = [
      { file: createTestFile('test.json', '{"test": true}', 'application/json'), expectedType: 'application/json' },
      { file: createTestImageFile('test.png'), expectedType: 'image/png' },
      { file: createTestFile('test.css', 'body { color: red; }', 'text/css'), expectedType: 'text/css' },
    ];

    for (const testCase of testCases) {
      const formData = new FormData();
      formData.append('file', testCase.file);

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      });

      assertEquals(response.status, 201);
      const data = await response.json();
      assertEquals(data.data.content_type, testCase.expectedType);
    }
  });
});

// Performance test (optional, can be skipped in CI)
Deno.test("Performance Test: Multiple concurrent uploads", async () => {
  const authToken = await getAuthToken();
  
  const uploadPromises = [];
  for (let i = 0; i < 5; i++) {
    const testFile = createTestFile(`concurrent-${i}.txt`, `Content for file ${i}`);
    const formData = new FormData();
    formData.append('file', testFile);
    formData.append('folder', 'performance-test');

    const promise = fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
      body: formData,
    });

    uploadPromises.push(promise);
  }

  const results = await Promise.all(uploadPromises);
  
  // All uploads should succeed
  for (let i = 0; i < results.length; i++) {
    assertEquals(results[i].status, 201);
    const data = await results[i].json();
    assertEquals(data.success, true);
  }
});
