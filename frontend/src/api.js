import { supabase } from './supabaseClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Helper function to get auth headers
async function getAuthHeaders(contentType = 'application/json') {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = {};
    
    // Add authorization header if session exists
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    
    // Only set Content-Type if it's not for file upload
    if (contentType !== 'multipart/form-data') {
      headers['Content-Type'] = contentType;
    }
    
    return headers;
  } catch (error) {
    console.warn('Failed to get auth headers:', error);
    return {};
  }
}

// Helper function to build the correct URL
function buildUrl(endpoint) {
  // If endpoint is already a full URL, return it
  if (endpoint.startsWith('http')) {
    return endpoint;
  }
  
  // Remove leading slash from endpoint if it exists
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  
  // Get the base URL without trailing slash
  let baseUrl = API_BASE_URL;
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  
  // Build the final URL
  return `${baseUrl}/${cleanEndpoint}`;
}

// Main API function that can be used anywhere
export async function apiCall(endpoint, options = {}) {
  try {
    // Determine if this is a file upload
    const isFileUpload = options.body instanceof FormData;
    
    // Get headers
    const headers = await getAuthHeaders(isFileUpload ? 'multipart/form-data' : 'application/json');
    
    // Build the full URL using the helper function
    const fullUrl = buildUrl(endpoint);
    
    // Prepare request config
    const config = {
      method: options.method || 'GET',
      headers: {
        ...headers,
        ...options.headers // Allow custom headers to override defaults
      },
      ...options
    };

    // Handle body - don't stringify FormData
    if (options.body && !isFileUpload) {
      config.body = JSON.stringify(options.body);
    }

    console.log('[API DEBUG] Making request to:', fullUrl);
    console.log('[API DEBUG] Method:', config.method);
    console.log('[API DEBUG] Headers:', config.headers);

    const response = await fetch(fullUrl, config);
    
    console.log('[API DEBUG] Response status:', response.status);
    
    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        // If response is not JSON, try to get text
        try {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        } catch (e2) {
          // Use default error message
        }
      }
      throw new Error(errorMessage);
    }
    
    // Try to parse JSON response
    try {
      return await response.json();
    } catch (e) {
      // If response is not JSON, return text
      return { data: await response.text() };
    }
    
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// Special function for file uploads
export async function uploadFile(endpoint, formData, additionalOptions = {}) {
  return apiCall(endpoint, {
    method: 'POST',
    body: formData,
    ...additionalOptions
  });
}

// Convenience function for GET requests
export async function apiGet(endpoint, options = {}) {
  return apiCall(endpoint, {
    method: 'GET',
    ...options
  });
}

// Convenience function for POST requests
export async function apiPost(endpoint, data, options = {}) {
  return apiCall(endpoint, {
    method: 'POST',
    body: data,
    ...options
  });
}

// Convenience function for PUT requests
export async function apiPut(endpoint, data, options = {}) {
  return apiCall(endpoint, {
    method: 'PUT',
    body: data,
    ...options
  });
}

// Convenience function for DELETE requests
export async function apiDelete(endpoint, options = {}) {
  return apiCall(endpoint, {
    method: 'DELETE',
    ...options
  });
}