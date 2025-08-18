# Resume Edge Function

A comprehensive Supabase Edge Function that provides CRUD (Create, Read, Update, Delete) operations for managing user resumes in the database.

## Features

- ✅ **Create Resume** - Upload new resume files with metadata
- ✅ **Read Resumes** - Get all resumes or specific resume by ID
- ✅ **Update Resume** - Modify resume file URL or name
- ✅ **Delete Resume** - Remove resume from database
- ✅ **Search & Pagination** - Filter resumes with search and pagination support
- ✅ **Authentication** - JWT-based user authentication
- ✅ **Data Validation** - Input validation and error handling
- ✅ **CORS Support** - Cross-origin request support

## API Endpoints

### Base URL
```
http://127.0.0.1:54321/functions/v1/resumes
```

### Authentication
All requests require a valid JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## API Reference

### 1. Create Resume
Creates a new resume record in the database.

**Endpoint:** `POST /resumes`

**Request Body:**
```json
{
  "file_url": "https://storage.example.com/resumes/john_doe_resume.pdf",
  "file_name": "John_Doe_Resume.pdf"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "user-uuid",
    "file_url": "https://storage.example.com/resumes/john_doe_resume.pdf",
    "file_name": "John_Doe_Resume.pdf",
    "uploaded_at": "2024-01-15T10:30:00.000Z"
  },
  "message": "Resume created successfully"
}
```

**Validation:**
- `file_url` is required (can be any string URL)
- `file_name` is required

### 2. Get All Resumes
Retrieves all resumes for the authenticated user with optional pagination and search.

**Endpoint:** `GET /resumes`

**Query Parameters:**
- `limit` (optional, default: 50) - Number of resumes to return
- `offset` (optional, default: 0) - Number of resumes to skip
- `sort_by` (optional, default: "uploaded_at") - Field to sort by
- `sort_order` (optional, default: "desc") - Sort order ("asc" or "desc")
- `search` (optional) - Search term to filter by file name

**Example:**
```
GET /resumes?limit=10&offset=0&search=john&sort_by=file_name&sort_order=asc
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "user_id": "user-uuid",
      "file_url": "https://storage.example.com/resumes/john_doe_resume.pdf",
      "file_name": "John_Doe_Resume.pdf",
      "uploaded_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 1
  }
}
```

### 3. Get Resume by ID
Retrieves a specific resume by its ID.

**Endpoint:** `GET /resumes/{resume-id}`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "user-uuid",
    "file_url": "https://storage.example.com/resumes/john_doe_resume.pdf",
    "file_name": "John_Doe_Resume.pdf",
    "uploaded_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Response (404):**
```json
{
  "error": "Resume not found",
  "message": "Resume does not exist or you do not have access to it"
}
```

### 4. Update Resume
Updates an existing resume's metadata.

**Endpoint:** `PUT /resumes/{resume-id}`

**Request Body:**
```json
{
  "file_name": "Updated_Resume_Name.pdf",
  "file_url": "https://storage.example.com/resumes/updated_resume.pdf"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "user-uuid",
    "file_url": "https://storage.example.com/resumes/updated_resume.pdf",
    "file_name": "Updated_Resume_Name.pdf",
    "uploaded_at": "2024-01-15T10:30:00.000Z"
  },
  "message": "Resume updated successfully"
}
```

**Notes:**
- Only provide fields you want to update
- No special validation required - simple string inputs

### 5. Delete Resume
Removes a resume from the database.

**Endpoint:** `DELETE /resumes/{resume-id}`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "user-uuid",
    "file_url": "https://storage.example.com/resumes/john_doe_resume.pdf",
    "file_name": "John_Doe_Resume.pdf",
    "uploaded_at": "2024-01-15T10:30:00.000Z"
  },
  "message": "Resume deleted successfully"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Bad request",
  "message": "file_url and file_name are required"
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
  "error": "Resume not found",
  "message": "Resume does not exist or you do not have access to it"
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
  "message": "Database error: [detailed error message]"
}
```

## Testing

### Prerequisites
1. Start Supabase local development server:
   ```bash
   supabase start
   ```

2. Make sure you have a valid JWT token for authentication

### Python Tests
Run comprehensive tests using the Python test script:

```bash
# Run all tests
python test_resumes.py

# Run specific test
python test_resumes.py create
python test_resumes.py get
```

### Shell Tests
Run tests using the shell script (requires `curl` and optionally `jq`):

```bash
# Run all tests
./test_resumes.sh

# Run specific test
./test_resumes.sh create
./test_resumes.sh get-all
./test_resumes.sh get-by-id <resume-id>
./test_resumes.sh update <resume-id>
./test_resumes.sh delete <resume-id>
```

### Manual Testing with curl

**Create a resume:**
```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/resumes' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "file_url": "https://example.com/resume.pdf",
    "file_name": "John_Doe_Resume.pdf"
  }'
```

**Get all resumes:**
```bash
curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/resumes' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --header 'Content-Type: application/json'
```

**Get specific resume:**
```bash
curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/resumes/RESUME_UUID' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --header 'Content-Type: application/json'
```

**Update resume:**
```bash
curl -i --location --request PUT 'http://127.0.0.1:54321/functions/v1/resumes/RESUME_UUID' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "file_name": "Updated_Resume_Name.pdf"
  }'
```

**Delete resume:**
```bash
curl -i --location --request DELETE 'http://127.0.0.1:54321/functions/v1/resumes/RESUME_UUID' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --header 'Content-Type: application/json'
```

## Database Schema

The function operates on the `resumes` table with the following structure:

```sql
CREATE TABLE public.resumes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    file_url text NOT NULL,
    file_name text NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now()
);
```

## Security Features

1. **JWT Authentication** - All requests require valid authentication
2. **User Isolation** - Users can only access their own resumes
3. **Input Validation** - Required fields validation (simplified approach)
4. **CORS Protection** - Configured CORS headers for security
5. **SQL Injection Protection** - Uses parameterized queries via Supabase client

## Integration with Existing System

This edge function provides a **simplified approach** that integrates with the existing `db_operations.py` `add_resume` function:

```python
def add_resume(user_id: str, resume_url: str, file_name: str) -> tuple[Optional[List[Dict]], Optional[str]]:
    data = {
        "user_id": user_id,
        "file_url": resume_url,
        "file_name": file_name,
    }
    return insert_data("resumes", data)
```

**Simplified Process:**
- User provides a resume URL (string) and file name
- No complex file validation or upload handling
- Direct insert operation into the database
- Perfect for cases where users already have their resume URLs from external storage

The edge function provides a REST API interface for the same underlying database operations, making it suitable for frontend applications and external integrations.

## Deployment

Deploy the function to Supabase:

```bash
supabase functions deploy resumes
```

Make sure to set the appropriate environment variables and configure RLS (Row Level Security) policies for the resumes table to ensure proper access control.
