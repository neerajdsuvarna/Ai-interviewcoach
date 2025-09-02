# Dashboard Edge Function

This Supabase Edge Function provides dashboard data for the Interview Coach application, including resume-job description pairings and their associated question sets.

## Overview

The dashboard function fetches and aggregates data from multiple tables to provide a comprehensive view of a user's interview preparation progress:

- User's resumes
- User's job descriptions  
- Question sets for each resume-job description pairing
- Summary information for each pairing

## API Endpoints

### Base URL
```
http://127.0.0.1:54321/functions/v1/dashboard  # Local development
https://your-project.supabase.co/functions/v1/dashboard  # Production
```

## Authentication

All requests require a valid JWT token in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

## API Operations

### Get Dashboard Data (GET)

**Endpoint:** `GET /functions/v1/dashboard`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "resume-uuid-job-uuid",
      "resume_id": "resume-uuid",
      "jd_id": "job-uuid", 
      "resumeName": "John_Doe_Resume",
      "jobTitle": "Software Engineer",
      "jobDescription": "We are looking for a full-stack developer...",
      "questionSets": [
        {
          "id": "resume-uuid-job-uuid-set-1",
          "questionSetNumber": 1,
          "hasQuestions": true,
          "hasSummary": false
        },
        {
          "id": "resume-uuid-job-uuid-set-2", 
          "questionSetNumber": 2,
          "hasQuestions": true,
          "hasSummary": true
        }
      ]
    }
  ],
  "message": "Found 3 resume-job description pairings"
}
```

## Data Structure

### DashboardPairing
- `id`: Unique identifier for the resume-job description pairing
- `resume_id`: UUID of the resume
- `jd_id`: UUID of the job description
- `resumeName`: Display name of the resume (filename without extension)
- `jobTitle`: Title of the job position
- `jobDescription`: Full job description text
- `questionSets`: Array of question sets for this pairing

### QuestionSet
- `id`: Unique identifier for the question set
- `questionSetNumber`: Numeric identifier for the question set
- `hasQuestions`: Boolean indicating if questions exist for this set
- `hasSummary`: Boolean indicating if interview summary exists (TODO: implement)

## Database Queries

The function performs the following database operations:

1. **Fetch User's Resumes**: Gets all resumes for the authenticated user
2. **Fetch User's Job Descriptions**: Gets all job descriptions for the authenticated user  
3. **Create Pairings**: Combines each resume with each job description
4. **Fetch Question Sets**: For each pairing, gets questions grouped by question_set
5. **Filter Results**: Only returns pairings that have at least one question set

## Security Features

1. **JWT Authentication** - All requests require valid authentication
2. **User Isolation** - Users can only access their own data
3. **RLS Compliance** - Respects Row Level Security policies
4. **Input Validation** - Validates authentication tokens
5. **Error Handling** - Comprehensive error handling and logging

## Development

To test locally:
1. Start Supabase: `supabase start`
2. Deploy the function: `supabase functions deploy dashboard`
3. Test with curl:
```bash
curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/dashboard' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN'
```

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Missing authorization header"
}
```

### 500 Internal Server Error
```json
{
  "error": "Database error", 
  "message": "Failed to fetch resumes"
}
```

## Future Enhancements

- Add interview summary detection from `interview_feedback` table
- Add performance metrics and analytics
- Add filtering and sorting options
- Add pagination for large datasets
- Add caching for improved performance
