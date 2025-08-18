# Backend Directory

This directory contains all the backend components of the Interview Coach application.

## Structure

```
backend/
├── app.py                 # Main Flask application
├── common/                # Shared utilities and configurations
│   ├── config.py         # Configuration settings
│   ├── GPU_Check.py      # GPU detection and device management
│   └── NLP_model.py      # NLP model integration with Ollama
├── Flask_UI/             # Flask UI components and models
│   ├── models.py         # Database models
│   ├── static/           # Static files
│   └── cache/            # Cached data
├── INTERVIEW/            # Interview system backend
│   ├── Interview_manager.py    # Main interview management
│   ├── Interview_functions.py  # Interview logic functions
│   ├── Resumeparser.py        # Resume parsing functionality
│   ├── INTERVIEWBOT_CLI.py    # CLI interface
│   ├── api_test.py            # API testing utilities
│   └── interview_config.json  # Interview configuration
├── TTS/                  # Text-to-Speech system
│   ├── Scripts/          # TTS scripts and utilities
│   └── ...               # TTS model files and configurations
├── UVR/                  # Audio separation system
│   ├── audio_enhancer.py # Audio enhancement utilities
│   └── uvr/              # UVR library and models
├── model_download.py     # Model downloader utility
└── start.sh             # Backend startup script
```

## Key Components

### Main Application (`app.py`)
- Flask web server with REST API endpoints
- Real-time communication via WebSocket
- File upload and processing
- Authentication and user management
- Integration with all backend systems

### Common Utilities (`common/`)
- **config.py**: Centralized configuration management
- **GPU_Check.py**: GPU detection and device selection
- **NLP_model.py**: Ollama integration for natural language processing

### Interview System (`INTERVIEW/`)
- **Interview_manager.py**: Core interview logic and state management
- **Interview_functions.py**: Interview-specific functions and utilities
- **Resumeparser.py**: Resume parsing and analysis
- **INTERVIEWBOT_CLI.py**: Command-line interface for testing

### TTS System (`TTS/`)
- Text-to-speech model loading and inference
- Audio generation and processing
- Model management and configuration

### UVR System (`UVR/`)
- Audio separation and enhancement
- Voice removal and processing
- Audio quality improvement

### Flask UI (`Flask_UI/`)
- Database models and user management
- Static file serving
- Cache management

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
- `install_dependencies.bat` (Windows)
- `install_dependencies.sh` (Linux/Mac)

## Configuration

The backend uses environment variables for configuration. Create a `.env` file in the `common/` directory with the necessary settings.

## API Endpoints

The backend provides REST API endpoints for:
- User authentication and management
- File uploads and processing
- Interview management
- Real-time communication
- Audio and video processing
- Model management

See the main `app.py` file for detailed endpoint documentation. 