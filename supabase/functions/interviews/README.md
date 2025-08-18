# Interviews Edge Function

This Supabase Edge Function provides CRUD operations for the interviews table.

## Features

- **Create Interview**: Add new interview records
- **Read Interviews**: Get all interviews for a user or specific interview by ID
- **Update Interview**: Modify existing interview details
- **Delete Interview**: Remove interview records
- **Filtering & Pagination**: Support for filtering by resume_id, jd_id, and pagination
- **Health Check**: Built-in health check endpoint
- **Authentication**: JWT-based authentication with user isolation

## API Endpoints

### Health Check
```bash
GET /functions/v1/interviews/health
```
No authentication required. Returns function status.

### Get All Interviews
```bash
GET /functions/v1/interviews
```
**Query Parameters:**
- `limit` (optional): Number of records to return (default: 50)
- `offset` (optional): Number of records to skip (default: 0)
- `sort_by` (optional): Field to sort by (default: "scheduled_at")
- `sort_order` (optional): "asc" or "desc" (default: "desc")
- `resume_id` (optional): Filter by resume ID
- `jd_id` (optional): Filter by job description ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "resume_id": "uuid",
      "jd_id": "uuid",
      "scheduled_at": "2024-01-15T10:00:00Z",
      "created_at": "2024-01-14T08:00:00Z",
      "updated_at": "2024-01-14T08:00:00Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1
  }
}
```

### Get Interview by ID
```bash
GET /functions/v1/interviews/{interview_id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "resume_id": "uuid",
    "jd_id": "uuid",
    "scheduled_at": "2024-01-15T10:00:00Z",
    "created_at": "2024-01-14T08:00:00Z",
    "updated_at": "2024-01-14T08:00:00Z"
  }
}
```

### Create Interview
```bash
POST /functions/v1/interviews
```

**Request Body:**
```json
{
  "resume_id": "uuid",
  "jd_id": "uuid",
  "scheduled_at": "2024-01-15T10:00:00Z"  // optional, defaults to current time
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "resume_id": "uuid",
    "jd_id": "uuid",
    "scheduled_at": "2024-01-15T10:00:00Z",
    "created_at": "2024-01-14T08:00:00Z",
    "updated_at": "2024-01-14T08:00:00Z"
  },
  "message": "Interview created successfully"
}
```

### Update Interview
```bash
PUT /functions/v1/interviews/{interview_id}
```

**Request Body (all fields optional):**
```json
{
  "resume_id": "uuid",
  "jd_id": "uuid",
  "scheduled_at": "2024-01-16T14:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "resume_id": "uuid",
    "jd_id": "uuid",
    "scheduled_at": "2024-01-16T14:00:00Z",
    "created_at": "2024-01-14T08:00:00Z",
    "updated_at": "2024-01-14T09:00:00Z"
  },
  "message": "Interview updated successfully"
}
```

### Delete Interview
```bash
DELETE /functions/v1/interviews/{interview_id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "resume_id": "uuid",
    "jd_id": "uuid",
    "scheduled_at": "2024-01-15T10:00:00Z",
    "created_at": "2024-01-14T08:00:00Z",
    "updated_at": "2024-01-14T08:00:00Z"
  },
  "message": "Interview deleted successfully"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Bad request",
  "message": "resume_id and jd_id are required"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing auth token"
}
```

### 404 Not Found
```json
{
  "error": "Interview not found",
  "message": "Interview does not exist or you do not have access to it"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "Database error: ..."
}
```

## Authentication

All endpoints (except health check) require a valid JWT token in the Authorization header:

```bash
Authorization: Bearer your_jwt_token_here
```

The function automatically extracts the user ID from the JWT token and ensures users can only access their own interviews.

## Testing

Two test scripts are provided:

### Python Test Script
```bash
cd supabase_Scripts
python test_interviews.py
```

**Available commands:**
- `python test_interviews.py` - Run all tests
- `python test_interviews.py create` - Test creating an interview
- `python test_interviews.py get` - Test getting all interviews
- `python test_interviews.py health` - Test health check
- `python test_interviews.py help` - Show help

### Shell Test Script
```bash
cd supabase_Scripts
./test_interviews.sh
```

**Available commands:**
- `./test_interviews.sh` - Run all tests
- `./test_interviews.sh health` - Test health check
- `./test_interviews.sh create` - Test creating an interview
- `./test_interviews.sh get-all` - Test getting all interviews
- `./test_interviews.sh get-by-id <id>` - Test getting specific interview
- `./test_interviews.sh update <id>` - Test updating an interview
- `./test_interviews.sh delete <id>` - Test deleting an interview
- `./test_interviews.sh help` - Show help

## Local Development

1. Start Supabase locally:
   ```bash
   supabase start
   ```

2. Deploy the function:
   ```bash
   supabase functions deploy interviews
   ```

3. Test the function:
   ```bash
   # Using curl
   curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/interviews/health'
   
   # Using the test scripts
   cd supabase_Scripts
   python test_interviews.py
   # or
   ./test_interviews.sh
   ```

## Database Schema

The function expects an `interviews` table with the following structure:

```sql
CREATE TABLE interviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    resume_id UUID NOT NULL REFERENCES resumes(id),
    jd_id UUID NOT NULL REFERENCES job_descriptions(id),
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Environment Variables

The function uses the following environment variables:

- `SUPABASE_URL`: The Supabase project URL
- `SUPABASE_ANON_KEY`: The Supabase anonymous key

These are automatically provided by the Supabase runtime.

## Error Handling

The function includes comprehensive error handling for:

- Invalid request data
- Missing authentication
- Non-existent resources
- Database errors
- Invalid UUIDs
- Malformed date strings

All errors are returned in a consistent JSON format with appropriate HTTP status codes.
