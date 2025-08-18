# Upload File Edge Function

A Supabase Edge Function for uploading files to storage with folder management and user authentication.

## Features

- **File Upload**: Upload files to Supabase Storage with automatic bucket creation
- **Folder Management**: Upload files to specific folders (creates folder structure automatically)
- **User Authentication**: Requires valid JWT token for access
- **File Validation**: Validates file size (max 50MB) and prevents empty files
- **Unique Naming**: Automatically generates unique filenames to prevent conflicts
- **Public URLs**: Returns public URLs for immediate file access

## Usage

### Endpoint
```
POST /functions/v1/upload-file
```

### Headers
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: multipart/form-data
```

### Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `file` | File | Yes | - | The file to upload |
| `folder` | String | No | `uploads` | Folder name to upload to |
| `bucket` | String | No | `user-files` | Storage bucket name |
| `filename` | String | No | Original filename | Custom filename for the uploaded file |

### Example Requests

#### Upload with default settings
```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/upload-file' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --form 'file=@"/path/to/your/file.pdf"'
```

#### Upload to specific folder with custom filename
```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/upload-file' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --form 'file=@"/path/to/your/file.pdf"' \
  --form 'folder="resumes"' \
  --form 'bucket="user-files"' \
  --form 'filename="my-resume.pdf"'
```

#### JavaScript/TypeScript Example
```javascript
const uploadFile = async (file, folder = 'uploads', bucket = 'user-files', filename = null) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  formData.append('bucket', bucket);
  if (filename) {
    formData.append('filename', filename);
  }

  const response = await fetch('/functions/v1/upload-file', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
    },
    body: formData
  });

  return await response.json();
};

// Usage
const fileInput = document.getElementById('fileInput');
const file = fileInput.files[0];
const result = await uploadFile(file, 'documents', 'user-files', 'important-doc.pdf');
console.log(result.data.public_url);
```

### Response Format

#### Success Response (201)
```json
{
  "success": true,
  "data": {
    "public_url": "https://your-project.supabase.co/storage/v1/object/public/user-files/documents/user-id/filename_2024-01-15T10-30-00-000Z.pdf",
    "file_path": "documents/user-id/filename_2024-01-15T10-30-00-000Z.pdf",
    "bucket": "user-files",
    "file_size": 1048576,
    "content_type": "application/pdf"
  },
  "message": "File uploaded successfully"
}
```

#### Error Response (400/401/409/413/500)
```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

## File Organization

Files are organized in the following structure:
```
bucket-name/
  folder-name/
    user-id/
      filename_timestamp.extension
```

For example:
```
user-files/
  resumes/
    user-123456/
      john-doe-resume_2024-01-15T10-30-00-000Z.pdf
      cover-letter_2024-01-15T10-35-00-000Z.docx
  documents/
    user-123456/
      certificate_2024-01-15T11-00-00-000Z.jpg
```

## Error Handling

| Status Code | Error Type | Description |
|-------------|------------|-------------|
| 400 | Bad Request | No file provided or invalid parameters |
| 401 | Unauthorized | Invalid or missing auth token |
| 405 | Method Not Allowed | Only POST method is supported |
| 409 | Conflict | File already exists at the specified location |
| 413 | Payload Too Large | File size exceeds 50MB limit |
| 500 | Internal Server Error | Server-side error during upload |

## Security Features

- **User Authentication**: All requests require valid JWT tokens
- **User Isolation**: Files are automatically organized by user ID
- **File Size Limits**: Maximum file size of 50MB
- **Public Access**: Uploaded files are publicly accessible via returned URLs
- **Unique Naming**: Automatic timestamping prevents filename conflicts

## Development

### Local Testing
1. Start Supabase locally: `supabase start`
2. Test the function using the provided curl examples
3. Check the test file for more comprehensive testing scenarios

### Environment Variables Required
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key for authentication
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for storage operations

## Related Functions
- [create-user](../create-user/README.md): User management
- [get-interviews](../get-interviews/README.md): Interview management
- [job-descriptions](../job-descriptions/README.md): Job description management
