# Questions CRUD Edge Function

This Supabase Edge Function provides comprehensive CRUD (Create, Read, Update, Delete) operations for the `questions` table in the Virtual Human Simulation system.

## Overview

The questions edge function allows you to manage interview questions with full CRUD capabilities including:
- Creating multiple questions in batch
- Reading questions with advanced filtering
- Updating individual questions
- Deleting questions
- Proper authentication and authorization
- Comprehensive error handling

## API Endpoints

### Base URL
```
http://127.0.0.1:54321/functions/v1/questions  # Local development
https://your-project.supabase.co/functions/v1/questions  # Production
```

## Authentication

All requests require a valid JWT token in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

## Database Schema

The questions table has the following structure:

```sql
CREATE TABLE public.questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id uuid REFERENCES public.interviews(id) ON DELETE CASCADE,
    resume_id uuid REFERENCES public.resumes(id) ON DELETE SET NULL,
    jd_id uuid REFERENCES public.job_descriptions(id) ON DELETE SET NULL,
    question_text text NOT NULL,
    expected_answer text,
    difficulty_category text CHECK (difficulty_category IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
    difficulty_experience text CHECK (difficulty_experience IN ('beginner', 'intermediate', 'expert')) DEFAULT 'beginner',
    question_set integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
```

## API Operations

### 1. Create Questions (POST)

**Endpoint:** `POST /functions/v1/questions`

**Request Body:**
```json
{
  "resume_id": "uuid-string",
  "jd_id": "uuid-string", 
  "interview_id": "uuid-string", // Optional
  "questions": [
    {
      "question_text": "Tell me about yourself",
      "expected_answer": "I am a software developer...", // Optional
      "difficulty_category": "easy", // Optional: 'easy', 'medium', 'hard'
      "difficulty_experience": "beginner" // Optional: 'beginner', 'intermediate', 'expert'
    }
  ],
  "question_set": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "interview_id": "uuid",
      "resume_id": "uuid",
      "jd_id": "uuid",
      "question_text": "Tell me about yourself",
      "expected_answer": "I am a software developer...",
      "difficulty_category": "easy",
      "difficulty_experience": "beginner",
      "question_set": 1,
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "message": "Created 1 questions successfully",
  "count": 1
}
```

### 2. Get All Questions (GET)

**Endpoint:** `GET /functions/v1/questions`

**Query Parameters:**
- `resume_id` (string): Filter by resume ID
- `jd_id` (string): Filter by job description ID  
- `interview_id` (string): Filter by interview ID
- `question_set` (number): Filter by question set number
- `difficulty_category` (string): Filter by difficulty category ('easy', 'medium', 'hard')
- `difficulty_experience` (string): Filter by experience level ('beginner', 'intermediate', 'expert')
- `limit` (number): Limit number of results

**Example:**
```
GET /functions/v1/questions?resume_id=uuid&question_set=1&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "interview_id": "uuid",
      "resume_id": "uuid",
      "jd_id": "uuid",
      "question_text": "Tell me about yourself",
      "expected_answer": "I am a software developer...",
      "difficulty_category": "easy",
      "difficulty_experience": "beginner",
      "question_set": 1,
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "count": 1,
  "filters_applied": {
    "resume_id": "uuid",
    "question_set": "1",
    "limit": "10"
  }
}
```

### 3. Get Specific Question (GET)

**Endpoint:** `GET /functions/v1/questions/{question_id}`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "interview_id": "uuid",
    "resume_id": "uuid",
    "jd_id": "uuid",
    "question_text": "Tell me about yourself",
    "expected_answer": "I am a software developer...",
    "difficulty_category": "easy",
    "difficulty_experience": "beginner",
    "question_set": 1,
    "created_at": "2025-01-15T10:30:00Z"
  }
}
```

### 4. Update Question (PUT)

**Endpoint:** `PUT /functions/v1/questions/{question_id}`

**Request Body:**
```json
{
  "question_text": "Updated question text", // Optional
  "expected_answer": "Updated expected answer", // Optional
  "difficulty_category": "hard", // Optional
  "difficulty_experience": "expert", // Optional
  "question_set": 2, // Optional
  "interview_id": "uuid" // Optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "interview_id": "uuid",
    "resume_id": "uuid",
    "jd_id": "uuid",
    "question_text": "Updated question text",
    "expected_answer": "Updated expected answer",
    "difficulty_category": "hard",
    "difficulty_experience": "expert",
    "question_set": 2,
    "created_at": "2025-01-15T10:30:00Z"
  },
  "message": "Question updated successfully"
}
```

### 5. Delete Question (DELETE)

**Endpoint:** `DELETE /functions/v1/questions/{question_id}`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "interview_id": "uuid",
    "resume_id": "uuid",
    "jd_id": "uuid",
    "question_text": "Deleted question text",
    "expected_answer": "Deleted expected answer",
    "difficulty_category": "medium",
    "difficulty_experience": "intermediate",
    "question_set": 1,
    "created_at": "2025-01-15T10:30:00Z"
  },
  "message": "Question deleted successfully"
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

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created successfully  
- `400` - Bad request (validation errors)
- `401` - Unauthorized (invalid/missing auth token)
- `404` - Not found (question doesn't exist)
- `405` - Method not allowed
- `500` - Internal server error

## Testing

### Prerequisites
- Supabase local development environment running
- `jq` installed for JSON parsing (for shell script)
- Python 3.7+ and `requests` library (for Python script)

### Python Test Script

Run the comprehensive Python test:
```bash
cd supabase_Scripts
python test_questions.py
```

The Python test script will:
- Test CORS functionality
- Authenticate with test user
- Create test data (resume and job description)
- Test all CRUD operations
- Clean up test data
- Provide detailed test results

### Shell Test Script

Run the bash test script:
```bash
cd supabase_Scripts
./test_questions.sh
```

The shell script provides similar functionality using curl commands.

## Example Usage

### Creating Multiple Questions

```bash
curl -X POST 'http://127.0.0.1:54321/functions/v1/questions' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "resume_id": "550e8400-e29b-41d4-a716-446655440000",
    "jd_id": "550e8400-e29b-41d4-a716-446655440001",
    "questions": [
      {
        "question_text": "What is your experience with Python?",
        "expected_answer": "I have 3+ years of Python experience",
        "difficulty_category": "medium",
        "difficulty_experience": "intermediate"
      },
      {
        "question_text": "Explain Object-Oriented Programming",
        "expected_answer": "OOP is a programming paradigm...",
        "difficulty_category": "hard",
        "difficulty_experience": "expert"
      }
    ],
    "question_set": 1
  }'
```

### Filtering Questions

```bash
curl -X GET 'http://127.0.0.1:54321/functions/v1/questions?resume_id=550e8400-e29b-41d4-a716-446655440000&difficulty_category=medium&limit=5' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### Updating a Question

```bash
curl -X PUT 'http://127.0.0.1:54321/functions/v1/questions/550e8400-e29b-41d4-a716-446655440002' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "question_text": "Updated: What is your experience with Python frameworks?",
    "difficulty_category": "hard"
  }'
```

## Integration with db_operations.py

This edge function is designed to work alongside the existing `add_questions` function in `db_operations.py`. Key differences:

- **Edge Function**: RESTful API with full CRUD operations, authentication via JWT
- **db_operations.py**: Python function for batch question creation, uses service role key

The edge function provides more granular control and is suitable for frontend integration, while `db_operations.py` is better for backend batch operations.

## Security and Permissions

- All operations require valid authentication
- Row Level Security (RLS) policies enforce data isolation
- Users can only access questions related to their own resumes and job descriptions
- Service role operations bypass RLS when needed for admin functions

## Deployment

1. Ensure the function is deployed to your Supabase project:
   ```bash
   supabase functions deploy questions
   ```

2. Set up proper environment variables in your Supabase project dashboard

3. Test the function using the provided test scripts

4. Integrate with your frontend application using the documented API endpoints

## Related Functions

- [`create-user`](../create-user/README.md) - User management
- [`resumes`](../resumes/README.md) - Resume management  
- [`job-descriptions`](../job-descriptions/README.md) - Job description management

## Support

For issues or questions, please refer to the project documentation or contact the development team.
