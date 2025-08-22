import os
import sys
import json
import glob
import random
import time
import threading
import shutil
import traceback
import subprocess
import uuid
import soundfile as sf
import cv2
import numpy as np
import mediapipe as mp
import base64
import re
import unicodedata
import logging
import atexit
import io
from flask import send_file, request, jsonify
from PIL import Image
from dotenv import load_dotenv
from datetime import datetime
from flask import (
    Flask, render_template, request, jsonify, redirect, url_for, flash, send_from_directory
)
from faster_whisper import WhisperModel
import tempfile
from werkzeug.utils import secure_filename
from RealtimeSTT import AudioToTextRecorder
from flask_socketio import SocketIO, emit
from io import BytesIO
from PIL import Image, UnidentifiedImageError

# ─────────────────────────────────────────────────────
#  Load environment variables from .env
# ─────────────────────────────────────────────────────

# Load environment variables from root .env file
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
# Ensure INTERVIEW folder is in Python path
INTERVIEW_PATH = os.path.join(os.path.dirname(__file__), "INTERVIEW")
if INTERVIEW_PATH not in sys.path:
    sys.path.append(INTERVIEW_PATH)

# ─────────────────────────────────────────────────────
#  Global paths from .env (via os.getenv)
# ─────────────────────────────────────────────────────
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
COMMON_DIR = os.path.abspath(os.path.join(BASE_DIR, os.getenv("COMMON_DIR")))
INTERVIEW_DIR = os.path.abspath(os.path.join(BASE_DIR, os.getenv("INTERVIEW_DIR")))
TTS_DIR = os.path.abspath(os.path.join(BASE_DIR, os.getenv("TTS_DIR")))
DOMAIN = os.getenv("DOMAIN")

#  Import NLP Model
UVR_TTS_SCRIPT_PATH = os.path.abspath(os.path.join(BASE_DIR, os.getenv("UVR_TTS_SCRIPT")))
BLANK_AUDIO_PATH = os.path.abspath(os.path.join(BASE_DIR, os.getenv("BLANK_AUDIO_PATH")))
TTS_MODEL_SCRIPT = os.path.abspath(os.path.join(BASE_DIR, os.getenv("TTS_MODEL_SCRIPT")))

# ─────────────────────────────────────────────────────
# Imports that depend on environment paths
# ─────────────────────────────────────────────────────

from common.NLP_model import NLPModel, Status
from common.GPU_Check import get_device
# from TTS.Scripts.TTS_LOAD_MODEL import load_model, run_tts
from flask_cors import CORS
from common.auth import verify_supabase_token, optional_auth  # Import the decorator

device = get_device()
interview_instances = {}
from INTERVIEW.Interview_manager import InterviewManager

# ─────────────────────────────────────────────────────
# Global model loading
# ─────────────────────────────────────────────────────

tts_model_loaded = False

# Load the Faster Whisper model for speech-to-text
whisper_model = None
def initialize_whisper_model():
    """Initialize the Whisper model for speech-to-text transcription"""
    global whisper_model
    if whisper_model is None:
        print("[INFO] Loading Whisper model for speech-to-text...")
        try:
            # Check if device is MPS and fall back to CPU for Whisper
            whisper_device = "cpu" if device == "mps" else device
            whisper_model = WhisperModel("base", device=whisper_device)
            print(f"[DONE] Whisper model loaded on {whisper_device} (original device was {device})")
        except Exception as e:
            print(f"[ERROR] Failed to load Whisper model: {e}")
            whisper_model = None

# Initialize Whisper model at startup
initialize_whisper_model()

# ─────────────────────────────────────────────────────
# Audio Processing Functions
# ─────────────────────────────────────────────────────

def convert_to_wav(input_path):
    """Convert audio file to WAV format for processing"""
    wav_path = input_path + "_converted.wav"
    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", input_path, "-ar", "16000", "-ac", "1", wav_path
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return wav_path
    except subprocess.CalledProcessError:
        print("[ERROR] FFmpeg conversion failed.")
        return None

def is_blank_audio(audio_path, rms_threshold=0.005):
    """Check if audio file is blank/silent"""
    try:
        audio, sample_rate = sf.read(audio_path)
        if audio.ndim > 1:
            audio = audio.mean(axis=1)  # convert to mono
        rms = np.sqrt(np.mean(audio**2))
        print(f"[DEBUG] RMS Energy: {rms}")
        return rms < rms_threshold
    except Exception as e:
        print(f"[ERROR] Failed to read audio: {e}")
        return False

def process_audio_file(file):
    """Process uploaded audio file and return transcription"""
    if whisper_model is None:
        print("[ERROR] Whisper model not loaded")
        return {"success": False, "error": "Speech recognition model not available"}
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_file:
        original_path = temp_file.name
        file.save(original_path)

    wav_path = None
    try:
        wav_path = convert_to_wav(original_path)
        if not wav_path or not os.path.exists(wav_path):
            print("[ERROR] FFmpeg conversion failed or file missing.")
            return {"success": False, "error": "Audio conversion failed"}

        if is_blank_audio(wav_path):
            print("[INFO] Blank audio detected — skipping transcription.")
            return {"success": True, "transcription": ""}

        segments, info = whisper_model.transcribe(
            wav_path,
            beam_size=5,
            language="en",
            task="transcribe"
        )

        transcription = " ".join([segment.text for segment in segments])
        print(f"[INFO] Transcription completed: {transcription[:50]}...")
        
        return {"success": True, "transcription": transcription}

    except Exception as e:
        print(f"[ERROR] Transcription failed: {e}")
        return {"success": False, "error": str(e)}
    finally:
        # Clean up temporary files
        for path in [original_path, wav_path]:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except Exception as e:
                    print(f"[WARNING] Failed to clean up {path}: {e}")
def initialize_xtts_model(model_dir):
    """Loads XTTS model from given directory if not already loaded."""
    global tts_model_loaded
    if not tts_model_loaded:
        print("[INFO] Loading XTTS model once at startup...")
        checkpoint = os.path.join(model_dir, "checkpoint.pth")
        config = os.path.join(model_dir, "config.json")
        vocab = os.path.join(model_dir, "vocab.json")
        tts_model_loaded = load_model(checkpoint, config, vocab)
        if tts_model_loaded:
            print("[DONE] XTTS model loaded")
        else:
            print("[ERROR] Failed to load XTTS model")

def resolve_model_path(model_name, username):
    safe_name = secure_filename(model_name)

    # User model path
    user_folder = os.path.join(app.config['UPLOAD_FOLDER'], username)
    user_model_path = os.path.join(user_folder, safe_name)
    if os.path.exists(user_model_path) and user_model_path.startswith(user_folder):
        print(f"[DEBUG] Found model in user folder: {user_model_path}")
        return user_model_path, "user"

    # Global model path
    global_model_path = os.path.join(app.config['UPLOAD_FOLDER'], "global_models", safe_name)
    if os.path.exists(global_model_path):
        print(f"[DEBUG] Found model in global folder: {global_model_path}")
        return global_model_path, "global"

    print(f"[DEBUG] Model '{model_name}' not found in user or global paths.")
    return None, None

def resolve_candidate_folder(model_name, candidate_name, username, resolve_model_path_fn):
    safe_model = secure_filename(model_name)
    safe_candidate = secure_filename(candidate_name)

    model_folder, source = resolve_model_path_fn(safe_model, username)
    if not model_folder:
        return None, None, None, None  # candidate_folder, config_path, source, model_folder

    if source == "global":
        # Check user-specific shared candidate
        user_candidate_folder = os.path.join(
            app.config['UPLOAD_FOLDER'],
            username,
            "global_model_data",
            safe_model,
            safe_candidate
        )
        if os.path.exists(user_candidate_folder):
            candidate_folder = user_candidate_folder
        else:
            candidate_folder = os.path.join(model_folder, safe_candidate)
    else:
        candidate_folder = os.path.join(model_folder, safe_candidate)

    config_path = os.path.join(candidate_folder, "interview_config.json")
    return candidate_folder, config_path, source, model_folder

# ─────────────────────────────────────────────────────
# Global flags and file tracking
# ─────────────────────────────────────────────────────

recorder = None
is_recording = False
model_ready = False
recording_start_time = 0  #  Track when recording starts
transcription_time = 0  #  Track transcription processing time
SENTENCE_FILE = "sentences.json"  #  File to store user sentences
is_processing = False  # [DONE] Fixed naming conflict

# ─────────────────────────────────────────────────────
#  Flask app config using env values
# ─────────────────────────────────────────────────────

app = Flask(__name__, template_folder="Flask_UI/templates", static_folder="Flask_UI/static")
app.config['UPLOAD_FOLDER'] = os.getenv("UPLOAD_FOLDER", "uploads")
app.config['MAX_CONTENT_LENGTH'] = 200 * 1024 * 1024

# ... existing code up to line 160 ...

# Configure CORS for development
CORS(app, 
     supports_credentials=True, 
     origins=[
         "http://localhost:5173",  # Frontend dev server
         "http://localhost:3000",  # Alternative frontend port
         "http://127.0.0.1:5173",  # Alternative localhost
         "http://127.0.0.1:3000",  # Alternative localhost
     ],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"])

socketio = SocketIO(app, cors_allowed_origins="*")

def get_static_url(rel_path):
    return f"{DOMAIN}/api/uploads/{rel_path}"

# ─────────────────────────────────────────────────────
# Test API Route with Supabase Authentication
# ─────────────────────────────────────────────────────

@app.route('/api/test', methods=['GET'])
@verify_supabase_token
def test_api():
    """Test API endpoint that requires Supabase authentication"""
    try:
        user = request.user
        return jsonify({
            "message": "Authentication successful!",
            "user": {
                "id": user.get('id'),
                "email": user.get('email'),
                "username": user.get('user_metadata', {}).get('username', ''),
                "created_at": user.get('created_at')
            },
            "timestamp": datetime.utcnow().isoformat()
        })
    except Exception as e:
        print(f"Error in test API: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    })

# ─────────────────────────────────────────────────────
# Job Description Parsing API
# ─────────────────────────────────────────────────────

@app.route('/api/parse-job-description', methods=['POST', 'OPTIONS'])
@verify_supabase_token
def parse_job_description():
    """Parse uploaded job description file and extract job title and description"""
    # Handle CORS preflight request
    if request.method == 'OPTIONS':
        return jsonify({"message": "OK"}), 200
    
    print(f"[DEBUG] Received {request.method} request to /api/parse-job-description")
    print(f"[DEBUG] Request headers: {dict(request.headers)}")
    print(f"[DEBUG] Request files: {list(request.files.keys()) if request.files else 'No files'}")
    
    try:
        # Get file from request
        if 'file' not in request.files:
            print("[ERROR] No 'file' key in request.files")
            return jsonify({
                "success": False,
                "message": "No file uploaded"
            }), 400
        
        file = request.files['file']
        if file.filename == '':
            print("[ERROR] Empty filename")
            return jsonify({
                "success": False,
                "message": "No file selected"
            }), 400
        
        print(f"[DEBUG] Received file: {file.filename}")
        
        # Save uploaded file temporarily
        import tempfile
        import os
        
        # Get file extension
        file_ext = file.filename.split('.')[-1].lower()
        allowed_extensions = ['pdf', 'txt', 'doc', 'docx']
        
        if file_ext not in allowed_extensions:
            return jsonify({
                "success": False,
                "message": f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
            }), 400
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_ext}') as temp_file:
            file.save(temp_file.name)
            temp_file_path = temp_file.name
        
        print(f"[DEBUG] Saved file to: {temp_file_path}")
        print(f"[DEBUG] File exists: {os.path.exists(temp_file_path)}")
        print(f"[DEBUG] File size: {os.path.getsize(temp_file_path)} bytes")
        
        try:
            # Import and use the job description parser
            print("[DEBUG] Importing parse_job_description_file...")
            from INTERVIEW.Resumeparser import parse_job_description_file
            
            print(f"[DEBUG] Starting job description parsing with model=llama3...")
            
            # Parse the job description file
            result = parse_job_description_file(temp_file_path, model="llama3")
            
            print(f"[DEBUG] Parsing completed successfully")
            print(f"[DEBUG] Result keys: {list(result.keys()) if isinstance(result, dict) else 'Not a dict'}")
            
            return jsonify({
                "success": True,
                "message": "Job description parsed successfully",
                "data": {
                    "job_title": result.get('job_title', ''),
                    "job_description": result.get('job_description', '')
                }
            })
            
        except Exception as parse_error:
            print(f"[ERROR] Parsing failed: {parse_error}")
            import traceback
            traceback.print_exc()
            return jsonify({
                "success": False,
                "message": f"Failed to parse job description: {str(parse_error)}"
            }), 500
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                print(f"[DEBUG] Cleaned up temporary file: {temp_file_path}")
                
    except Exception as e:
        print(f"[ERROR] General error in parse_job_description: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": f"Failed to process job description: {str(e)}"
        }), 500

# ─────────────────────────────────────────────────────
# Resume Processing and Question Generation API
# ─────────────────────────────────────────────────────

@app.route('/api/generate-questions', methods=['POST', 'OPTIONS'])
@verify_supabase_token
def generate_questions():
    """Generate questions from uploaded resume and job description"""
    # Handle CORS preflight request
    if request.method == 'OPTIONS':
        return jsonify({"message": "OK"}), 200
    
    try:
        # Get data from request
        data = request.get_json()
        resume_url = data.get('resume_url')
        job_description = data.get('job_description')
        job_title = data.get('job_title')
        job_desc_file_url = data.get('job_desc_file_url')
        
        if not all([resume_url, job_description, job_title]):
            return jsonify({
                "success": False,
                "message": "Missing required fields: resume_url, job_description, job_title"
            }), 400
        
        print(f"[DEBUG] Generating questions for job: {job_title}")
        
        # Download resume file from Supabase Storage
        import requests
        
        # Extract file path from URL
        # URL format: http://127.0.0.1:54321/storage/v1/object/public/resumes/user_files/...
        file_path = resume_url.split('/storage/v1/object/public/')[-1]
        
        # Download file to temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            response = requests.get(resume_url)
            response.raise_for_status()
            temp_file.write(response.content)
            temp_resume_path = temp_file.name
        
        try:
            # Import and run the new resume pipeline
            from INTERVIEW.Resumeparser import run_pipeline_from_api
            
            # Set question counts (can be made configurable from frontend)
            question_counts = {
                'beginner': 1,
                'medium': 1,
                'hard': 1
            }
            
            # Run the pipeline with frontend data
            result = run_pipeline_from_api(
                resume_path=temp_resume_path,
                job_title=job_title,
                job_description=job_description,
                question_counts=question_counts,
                include_answers=True  # Generate answers by default
            )
            
            if not result.get('success'):
                return jsonify({
                    "success": False,
                    "message": f"Failed to process resume: {result.get('error', 'Unknown error')}"
                }), 500
            
            return jsonify({
                "success": True,
                "message": "Questions generated successfully",
                "data": {
                    "questions": result['questions'],
                    "questions_count": result['questions_count'],
                    "candidate_name": result['candidate']
                }
            })
            
        finally:
            # Clean up temporary files
            if os.path.exists(temp_resume_path):
                os.unlink(temp_resume_path)
            
    except Exception as e:
        print(f"Error in generate_questions: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": f"Internal server error: {str(e)}"
        }), 500

# ─────────────────────────────────────────────────────
# Audio Recording and Transcription API
# ─────────────────────────────────────────────────────

@app.route('/api/transcribe-audio', methods=['POST', 'OPTIONS'])
@verify_supabase_token
def transcribe_audio():
    """Transcribe uploaded audio file from interview recording"""
    # Handle CORS preflight request
    if request.method == 'OPTIONS':
        return jsonify({"message": "OK"}), 200
    
    print(f"[DEBUG] Received {request.method} request to /api/transcribe-audio")
    
    try:
        # Get file from request
        if 'audio' not in request.files:
            print("[ERROR] No 'audio' key in request.files")
            return jsonify({
                "success": False,
                "message": "No audio file uploaded"
            }), 400
        
        file = request.files['audio']
        if file.filename == '':
            print("[ERROR] Empty filename")
            return jsonify({
                "success": False,
                "message": "No audio file selected"
            }), 400
        
        print(f"[DEBUG] Received audio file: {file.filename}")
        
        # Process the audio file
        result = process_audio_file(file)
        
        if not result.get('success'):
            return jsonify({
                "success": False,
                "message": f"Transcription failed: {result.get('error', 'Unknown error')}"
            }), 500
        
        transcription = result.get('transcription', '')
        
        return jsonify({
            "success": True,
            "message": "Audio transcribed successfully",
            "data": {
                "transcription": transcription,
                "word_count": len(transcription.split()) if transcription else 0
            }
        })
        
    except Exception as e:
        print(f"[ERROR] General error in transcribe_audio: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": f"Failed to process audio: {str(e)}"
        }), 500

@app.route('/api/generate-response', methods=['POST'])
@verify_supabase_token
def generate_response():
    """Generate interview response from user input"""
    try:
        # Get data from request
        data = request.get_json()
        user_input = data.get('message', '').strip()
        model_name = data.get('model_name', '').strip()
        candidate_name = data.get('candidate_name', '').strip()
        
        if not user_input:
            return jsonify({
                "success": False,
                "message": "Missing required field: message"
            }), 400
        
        print(f"[DEBUG] Generating response for model: {model_name}, candidate: {candidate_name}")
        print(f"[DEBUG] User input: {user_input}")
        
        # Get username from auth
        username = request.user.get('email', 'default_user')
        
        # Create a default config path for testing
        if model_name == 'default' or candidate_name == 'default':
            # Use a simple default configuration
            config_path = os.path.join(os.path.dirname(__file__), "INTERVIEW", "interview_config.json")
            
            # Ensure the config file exists
            if not os.path.exists(config_path):
                # Create a default config
                default_config = {
                    "job_title": "Software Developer",
                    "job_description": "We're seeking a talented software developer to join our team. The ideal candidate should have experience in modern programming languages and frameworks.",
                    "interview_style": "conversational",
                    "custom_questions": [
                        "Can you tell me about your experience with React?",
                        "How do you handle debugging complex issues?",
                        "What's your approach to learning new technologies?"
                    ],
                    "core_questions": [
                        "Tell me about your background and experience.",
                        "What interests you about this position?",
                        "Can you describe a challenging project you worked on?"
                    ],
                    "icebreakers": [
                        "What's your favorite programming language and why?",
                        "How do you stay updated with technology trends?",
                        "What's the most interesting project you've worked on?"
                    ],
                    "time_limit_minutes": 30
                }
                
                os.makedirs(os.path.dirname(config_path), exist_ok=True)
                with open(config_path, 'w') as f:
                    json.dump(default_config, f, indent=2)
                print(f"[DEBUG] Created default config at: {config_path}")
        else:
            # Use the existing logic for specific models/candidates
            safe_model = secure_filename(model_name)
            safe_candidate = secure_filename(candidate_name)
            
            # Resolve candidate folder and config
            candidate_folder, config_path, source, model_folder = resolve_candidate_folder(
                safe_model, safe_candidate, username, resolve_model_path
            )
            
            if not model_folder or not os.path.exists(config_path):
                return jsonify({
                    "success": False,
                    "message": "Interview config not found"
                }), 404
        
        # Create or get InterviewManager instance
        instance_key = f"{model_name}:{candidate_name}:{username}"
        if instance_key not in interview_instances:
            print(f"[INFO] Creating new InterviewManager instance for: {instance_key}")
            interview_instances[instance_key] = InterviewManager(config_path=config_path)
        
        manager = interview_instances[instance_key]
        
        # Generate response using the manager
        response = manager.receive_input(user_input)
        
        print(f"[DEBUG] Interview response: {response}")
        
        return jsonify({
            "success": True,
            "message": "Response generated successfully",
            "data": {
                "response": response.get("message", "Sorry, something went wrong."),
                "stage": response.get("stage", "unknown"),
                "interview_done": response.get("interview_done", False)
            }
        })
        
    except Exception as e:
        print(f"[ERROR] Exception in generate_response: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": f"Internal server error: {str(e)}"
        }), 500

if __name__ == '__main__': 
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True)