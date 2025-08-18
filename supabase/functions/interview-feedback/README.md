# Interview Feedback Edge Function

This Supabase Edge Function provides CRUD operations for managing interview feedback records.

## Overview

The interview feedback function allows users to:
- Create feedback for interviews
- Read their own interview feedback
- Update existing feedback
- Delete feedback records

## Database Schema

The function operates on the `interview_feedback` table:

```sql
CREATE TABLE public.interview_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id uuid NOT NULL UNIQUE REFERENCES public.interviews(id) ON DELETE CASCADE,
    key_strengths text,
    improvement_areas text,
    summary text,
    audio_url text,
    created_at timestamp with time zone DEFAULT now()
);
```

## Security

- Row Level Security (RLS) is enabled
- Users can only access feedback for interviews they own
- All operations require authentication except the health check endpoint

## API Endpoints

### Health Check
- **GET** `/interview-feedback/health`
- No authentication required
- Returns function status

### Get All Feedback
- **GET** `/interview-feedback`
- Query parameters:
  - `limit` (default: 50) - Number of records to return
  - `offset` (default: 0) - Number of records to skip
  - `sort_by` (default: created_at) - Field to sort by
  - `sort_order` (default: desc) - Sort order (asc/desc)
  - `interview_id` - Filter by specific interview

### Get Specific Feedback
- **GET** `/interview-feedback/{feedback_id}`
- Returns a single feedback record

### Create Feedback
- **POST** `/interview-feedback`
- Required fields:
  - `interview_id` - UUID of the interview
- Optional fields:
  - `key_strengths` - Text describing candidate strengths
  - `improvement_areas` - Text describing areas for improvement
  - `summary` - Overall feedback summary
  - `audio_url` - URL to audio recording

### Update Feedback
- **PUT** `/interview-feedback/{feedback_id}`
- All fields optional:
  - `key_strengths`
  - `improvement_areas`
  - `summary`
  - `audio_url`

### Delete Feedback
- **DELETE** `/interview-feedback/{feedback_id}`
- Permanently removes the feedback record

## Response Format

### Success Response
```json
{
  "success": true,
  "data": {...},
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

## Example Usage

### Create Feedback
```bash
curl -X POST 'http://127.0.0.1:54321/functions/v1/interview-feedback' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "interview_id": "550e8400-e29b-41d4-a716-446655440099",
    "key_strengths": "Excellent communication skills and technical knowledge",
    "improvement_areas": "Could improve problem-solving approach",
    "summary": "Strong candidate with good potential",
    "audio_url": "https://example.com/interview-audio.mp3"
  }'
```

### Get All Feedback
```bash
curl -X GET 'http://127.0.0.1:54321/functions/v1/interview-feedback?limit=10' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### Update Feedback
```bash
curl -X PUT 'http://127.0.0.1:54321/functions/v1/interview-feedback/FEEDBACK_ID' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "summary": "Updated feedback summary with additional insights"
  }'
```

## Testing

The function includes comprehensive test files:
- `test_interview_feedback.py` - Python test script
- `test_interview_feedback.sh` - Shell test script

Both test files demonstrate all CRUD operations and edge cases.

## Error Handling

- **400** - Bad request (missing required fields, invalid data)
- **401** - Unauthorized (invalid or missing auth token)
- **404** - Resource not found
- **409** - Conflict (feedback already exists for interview)
- **500** - Internal server error

## Constraints

- Each interview can have only one feedback record (enforced by unique constraint)
- Feedback can only be created for interviews owned by the authenticated user
- All text fields are optional except `interview_id`
- URLs are validated for proper format when provided
