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

load_dotenv(dotenv_path=os.path.join("common", ".env"))
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
from TTS.Scripts.TTS_LOAD_MODEL import load_model, run_tts
from flask_cors import CORS
from common.auth import verify_supabase_token, optional_auth  # Import the decorator

device = get_device()
interview_instances = {}
from INTERVIEW.Interview_manager import InterviewManager

# ─────────────────────────────────────────────────────
# Global model loading
# ─────────────────────────────────────────────────────

tts_model_loaded = False
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

if __name__ == '__main__': 
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True)