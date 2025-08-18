# Create User Edge Function

This Supabase Edge Function provides user management functionality with authentication-based access control. It allows authenticated users to create, retrieve, and update their user profiles in the application database.

## Overview

The function handles user operations based on the authenticated user's information from the auth token. It provides a secure way to manage user profiles without exposing sensitive operations to unauthorized access.

## Features

- **Create User**: Creates a new user profile based on authenticated user information
- **Get User**: Retrieves the current user's profile
- **Update User**: Updates the current user's profile information
- **Auth Token Validation**: All operations require valid authentication
- **Duplicate Prevention**: Prevents creating duplicate users for the same email

## Authentication

All requests must include a valid JWT token in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

The function automatically extracts user information from the authenticated session.

## API Endpoints

### POST /create-user
Creates a new user profile for the authenticated user.

**Request Body:**
```json
{
  "full_name": "John Doe",     // Optional: User's full name
  "plan": "premium"            // Optional: User's plan (defaults to "basic")
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "plan": "premium",
    "created_at": "2024-01-15T10:00:00Z"
  },
  "message": "User created successfully"
}
```

**Response (200 OK) - If user already exists:**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "plan": "basic",
    "created_at": "2024-01-15T10:00:00Z"
  },
  "message": "User already exists"
}
```

### GET /create-user
Retrieves the current authenticated user's profile.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "plan": "premium",
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

**Response (404 Not Found):**
```json
{
  "error": "User not found",
  "message": "User profile does not exist"
}
```

### PUT /create-user
Updates the current authenticated user's profile.

**Request Body:**
```json
{
  "full_name": "John Smith",   // Optional: New full name
  "plan": "enterprise"         // Optional: New plan
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "user@example.com",
    "full_name": "John Smith",
    "plan": "enterprise",
    "created_at": "2024-01-15T10:00:00Z"
  },
  "message": "User updated successfully"
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing auth token"
}
```

### 400 Bad Request
```json
{
  "error": "Bad request",
  "message": "User email not found in auth token"
}
```

### 405 Method Not Allowed
```json
{
  "error": "Method not allowed"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "Detailed error message"
}
```

## Usage Examples

### Create a User (cURL)
```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-user' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "full_name": "John Doe",
    "plan": "premium"
  }'
```

### Get User Profile (cURL)
```bash
curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/create-user' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --header 'Content-Type: application/json'
```

### Update User Profile (cURL)
```bash
curl -i --location --request PUT 'http://127.0.0.1:54321/functions/v1/create-user' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "full_name": "John Smith",
    "plan": "enterprise"
  }'
```

### JavaScript/TypeScript Client Example
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Create user
async function createUser(userData: { full_name?: string; plan?: string }) {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) throw new Error('Not authenticated')
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userData)
  })
  
  return response.json()
}

// Get user
async function getUser() {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) throw new Error('Not authenticated')
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  })
  
  return response.json()
}

// Update user
async function updateUser(userData: { full_name?: string; plan?: string }) {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) throw new Error('Not authenticated')
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userData)
  })
  
  return response.json()
}
```

## Database Schema

The function interacts with the `users` table:

```sql
CREATE TABLE public.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    full_name text NOT NULL,
    plan text NOT NULL DEFAULT 'basic',
    created_at timestamp with time zone DEFAULT now()
);
```

## Security Features

1. **Authentication Required**: All endpoints require valid JWT tokens
2. **User Isolation**: Users can only access their own data
3. **Email-based Identification**: Uses authenticated user's email as the primary identifier
4. **Input Validation**: Validates required fields and request structure
5. **CORS Support**: Proper CORS headers for cross-origin requests

## Plans

The following plans are supported:
- `basic` (default)
- `premium`
- `enterprise`

## Local Development

1. Start Supabase local development:
   ```bash
   supabase start
   ```

2. Deploy the function:
   ```bash
   supabase functions deploy create-user
   ```

3. Test the function using the provided cURL examples

## Notes

- The function uses the authenticated user's ID from the auth token as the primary key for the users table
- If a user already exists, the CREATE operation returns the existing user data
- Full name defaults to metadata from the auth provider if not provided
- The function maintains consistency between Supabase Auth and the application's user table
