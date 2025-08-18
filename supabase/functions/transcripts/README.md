# Transcripts Edge Function

This edge function provides CRUD operations for managing interview transcripts in the Supabase database.

## Features

- **Authentication Required**: All operations (except health check) require valid JWT authentication
- **User Isolation**: Users can only access transcripts for their own interviews
- **Service Role Support**: Supports service role tokens for testing/admin operations
- **Full CRUD Operations**: Create, Read, Update, Delete transcript records
- **Filtering & Pagination**: Support for query parameters to filter and paginate results
- **Error Handling**: Comprehensive error responses with appropriate HTTP status codes

## Database Schema

The function operates on the `transcripts` table with the following structure:

```sql
CREATE TABLE public.transcripts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id uuid NOT NULL UNIQUE REFERENCES public.interviews(id) ON DELETE CASCADE,
    full_transcript text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
```

## API Endpoints

### Health Check
- **GET** `/transcripts/health`
- No authentication required
- Returns function status

### Get All Transcripts
- **GET** `/transcripts`
- Requires authentication
- Query parameters:
  - `limit` (default: 50): Number of results to return
  - `offset` (default: 0): Number of results to skip
  - `sort_by` (default: 'created_at'): Field to sort by
  - `sort_order` (default: 'desc'): Sort order ('asc' or 'desc')
  - `interview_id`: Filter by specific interview ID

### Get Specific Transcript
- **GET** `/transcripts/{transcript_id}`
- Requires authentication
- Returns single transcript record

### Create Transcript
- **POST** `/transcripts`
- Requires authentication
- Body: `{"interview_id": "uuid", "full_transcript": "text"}`
- Validates interview ownership
- Prevents duplicate transcripts per interview

### Update Transcript
- **PUT** `/transcripts/{transcript_id}`
- Requires authentication
- Body: `{"full_transcript": "updated text"}`
- Validates transcript ownership through interview

### Delete Transcript
- **DELETE** `/transcripts/{transcript_id}`
- Requires authentication
- Validates transcript ownership through interview

## Authentication

### Regular Users
- Must provide valid JWT token in Authorization header
- Can only access transcripts for interviews they own

### Service Role (Testing)
- Uses service role token for testing/admin operations
- Creates mock user and test data automatically
- Identified by `role: 'service_role'` in JWT payload

## Error Responses

- `401 Unauthorized`: Invalid or missing auth token
- `404 Not Found`: Transcript/interview not found or access denied
- `409 Conflict`: Transcript already exists for interview
- `400 Bad Request`: Invalid request data
- `405 Method Not Allowed`: Unsupported HTTP method
- `500 Internal Server Error`: Server-side errors

## Usage Examples

See the curl examples in the function code for detailed usage patterns.

## Testing

Use the provided test files:
- `test_transcripts.py`: Python test script
- `test_transcripts.sh`: Shell test script

Both scripts test all CRUD operations and error conditions.
