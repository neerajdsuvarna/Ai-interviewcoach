# Job Descriptions Edge Function

This Supabase Edge Function provides complete CRUD (Create, Read, Update, Delete) operations for the `job_descriptions` table.

## Features

- **Authentication Required**: All operations require a valid JWT token
- **User Isolation**: Users can only access their own job descriptions
- **Full CRUD Operations**: Create, Read (single & list), Update, Delete
- **Pagination & Search**: List operations support pagination and search functionality
- **Error Handling**: Comprehensive error handling with appropriate HTTP status codes

## API Endpoints

### 1. Get All Job Descriptions
**GET** `/functions/v1/job-descriptions`

#### Query Parameters
- `limit` (optional): Number of results to return (default: 50)
- `offset` (optional): Number of results to skip (default: 0)
- `sort_by` (optional): Field to sort by (default: created_at)
- `sort_order` (optional): Sort order - 'asc' or 'desc' (default: desc)
- `search` (optional): Search term to filter by title or description

#### Example
```bash
curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/job-descriptions?limit=10&search=developer' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --header 'Content-Type: application/json'
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "title": "Senior Software Engineer",
      "description": "Looking for an experienced software engineer...",
      "file_url": "https://example.com/jd.pdf",
      "created_at": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 1
  }
}
```

### 2. Get Single Job Description
**GET** `/functions/v1/job-descriptions/{id}`

#### Example
```bash
curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/job-descriptions/JOB_DESCRIPTION_UUID' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --header 'Content-Type: application/json'
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "title": "Senior Software Engineer",
    "description": "Looking for an experienced software engineer...",
    "file_url": "https://example.com/jd.pdf",
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

### 3. Create Job Description
**POST** `/functions/v1/job-descriptions`

#### Request Body
```json
{
  "title": "Senior Software Engineer",
  "description": "Looking for an experienced software engineer with 5+ years of experience...",
  "file_url": "https://example.com/jd.pdf" // optional
}
```

#### Example
```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/job-descriptions' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{"title":"Senior Software Engineer","description":"Looking for an experienced software engineer...","file_url":"https://example.com/jd.pdf"}'
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "title": "Senior Software Engineer",
    "description": "Looking for an experienced software engineer...",
    "file_url": "https://example.com/jd.pdf",
    "created_at": "2024-01-15T10:00:00Z"
  },
  "message": "Job description created successfully"
}
```

### 4. Update Job Description
**PUT** `/functions/v1/job-descriptions/{id}`

#### Request Body (all fields optional)
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "file_url": "https://example.com/updated-jd.pdf"
}
```

#### Example
```bash
curl -i --location --request PUT 'http://127.0.0.1:54321/functions/v1/job-descriptions/JOB_DESCRIPTION_UUID' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{"title":"Updated Title","description":"Updated description"}'
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "title": "Updated Title",
    "description": "Updated description",
    "file_url": "https://example.com/jd.pdf",
    "created_at": "2024-01-15T10:00:00Z"
  },
  "message": "Job description updated successfully"
}
```

### 5. Delete Job Description
**DELETE** `/functions/v1/job-descriptions/{id}`

#### Example
```bash
curl -i --location --request DELETE 'http://127.0.0.1:54321/functions/v1/job-descriptions/JOB_DESCRIPTION_UUID' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --header 'Content-Type: application/json'
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "title": "Senior Software Engineer",
    "description": "Looking for an experienced software engineer...",
    "file_url": "https://example.com/jd.pdf",
    "created_at": "2024-01-15T10:00:00Z"
  },
  "message": "Job description deleted successfully"
}
```

## Error Responses

All error responses follow this format:
```json
{
  "error": "Error Type",
  "message": "Detailed error message"
}
```

### Common HTTP Status Codes
- `200` - Success (GET, PUT, DELETE)
- `201` - Created (POST)
- `400` - Bad Request (missing required fields, invalid data)
- `401` - Unauthorized (invalid or missing auth token)
- `404` - Not Found (job description doesn't exist or no access)
- `405` - Method Not Allowed
- `500` - Internal Server Error

## Authentication

All requests require a valid JWT token in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

The function automatically extracts the user ID from the JWT token to ensure users can only access their own job descriptions.

## Development

To test locally:
1. Start Supabase: `supabase start`
2. Use the curl examples above with `http://127.0.0.1:54321/functions/v1/job-descriptions`
3. Replace `YOUR_JWT_TOKEN` with a valid JWT token from your Supabase auth

## Database Schema

The function operates on the `job_descriptions` table with the following structure:
```sql
CREATE TABLE public.job_descriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text NOT NULL,
    file_url text,
    created_at timestamp with time zone DEFAULT now()
);
```
