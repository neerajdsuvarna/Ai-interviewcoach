# Backend Directory

This directory contains all the backend components of the Interview Coach application.

## Structure

```
backend/
├── app.py                 # Main Flask application
├── common/                # Shared utilities and configurations
│   ├── auth.py           # Supabase authentication decorators
│   └── GPU_Check.py      # GPU detection and device management
├── INTERVIEW/            # Interview system backend
│   ├── Interview_manager.py    # Main interview management
│   ├── Interview_functions.py  # Interview logic functions
│   ├── Resumeparser.py        # Resume parsing functionality
│   ├── interview_config.json  # Interview configuration
│   ├── api_test.py            # API testing utilities (testing)
│   ├── test_api_resume.py     # Resume API testing (testing)
│   └── INTERVIEWBOT_CLI.py    # CLI interface (testing)
├── Piper/                # Text-to-Speech system
│   ├── voiceCloner.py    # Piper TTS voice synthesis
│   ├── en_US-kusal-medium.onnx # Piper voice model
│   ├── en_US-kusal-medium.onnx.json # Model configuration
│   ├── test_api_voiceCloner.py # TTS testing (testing)
│   ├── test_tts_upload.py      # TTS upload testing (testing)
│   ├── test_tts_upload_debug.py # TTS debug testing (testing)
│   └── check_bucket_and_test_url.py # Storage testing (testing)
└── README.md             # This file
```

## Key Components

### Main Application (`app.py`)
- Flask web server with REST API endpoints
- Real-time communication via WebSocket (SocketIO)
- File upload and processing
- Supabase authentication and user management
- Audio transcription and processing
- Interview response generation
- Head tracking and eye contact detection

### Common Utilities (`common/`)
- **auth.py**: Supabase JWT token verification decorators
- **GPU_Check.py**: GPU detection and device selection (CUDA/MPS/CPU)

### Interview System (`INTERVIEW/`)
- **Interview_manager.py**: Core interview logic and state management
- **Interview_functions.py**: Interview-specific functions and utilities
- **Resumeparser.py**: Resume parsing and job description analysis
- **interview_config.json**: Interview configuration settings
- **Testing files**: API tests, CLI interface, and resume processing tests

### Text-to-Speech System (`Piper/`)
- **voiceCloner.py**: Piper TTS voice synthesis integration
- **en_US-kusal-medium.onnx**: Pre-trained Piper voice model
- **Testing files**: TTS API tests and upload functionality tests

## Running the Backend

### Development Mode
From the project root:
```bash
# Windows
start_dev.bat

# Linux/Mac
./start_dev.sh
```

### Production Mode
From the backend directory:
```bash
python app.py
```

## Dependencies

All backend dependencies are managed through the installation scripts in the project root:
- `install_dependencies_windows.bat` (Windows)
- `install_dependencies_linux.sh` (Linux)
- `install_dependencies_macos.sh` (macOS)

## Configuration

The backend uses environment variables for configuration. The `.env` file is located in the project root directory with the necessary settings:
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `DOMAIN`: Application domain
- `UPLOAD_FOLDER`: File upload directory
- `PIPER_MODEL_PATH`: Path to Piper voice model

## API Endpoints

The backend provides REST API endpoints for:
- **Authentication**: `/api/test`, `/api/health`
- **Job Processing**: `/api/parse-job-description`
- **Question Generation**: `/api/generate-questions`
- **Audio Processing**: `/api/transcribe-audio`
- **Interview Management**: `/api/generate-response`
- **Text-to-Speech**: `/api/generate-speech`
- **File Management**: `/api/delete-audio`, `/api/list-audio-files`
- **WebSocket**: Real-time head tracking and communication

## Testing

The backend includes comprehensive testing files:
- **INTERVIEW/**: API tests, CLI interface, and resume processing tests
- **Piper/**: TTS functionality tests and upload tests

See individual test files for specific testing procedures. 