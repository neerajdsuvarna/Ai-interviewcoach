import os
import sys
import json
import time
import traceback
import subprocess
import soundfile as sf
import cv2
import numpy as np
import mediapipe as mp
import base64
import io
from flask import request, jsonify
from PIL import Image
from dotenv import load_dotenv
from datetime import datetime
from flask import Flask
from faster_whisper import WhisperModel
import tempfile
from werkzeug.utils import secure_filename
from flask_socketio import SocketIO, emit
from io import BytesIO
from PIL import Image, UnidentifiedImageError
from supabase import create_client, Client
from pydub import AudioSegment
import requests
import hashlib

# ─────────────────────────────────────────────────────
#  Load environment variables from .env
# ─────────────────────────────────────────────────────

# Load environment variables from backend .env file
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
# Ensure INTERVIEW folder is in Python path
INTERVIEW_PATH = os.path.join(os.path.dirname(__file__), "INTERVIEW")
if INTERVIEW_PATH not in sys.path:
    sys.path.append(INTERVIEW_PATH)

# ─────────────────────────────────────────────────────
#  Global paths from .env (via os.getenv)
# ─────────────────────────────────────────────────────
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DOMAIN = os.getenv("DOMAIN")

# ─────────────────────────────────────────────────────
# Imports that depend on environment paths
# ─────────────────────────────────────────────────────

from common.GPU_Check import get_device
# from TTS.Scripts.TTS_LOAD_MODEL import load_model, run_tts
from flask_cors import CORS
from common.auth import verify_supabase_token  # Import the decorator

device = get_device()
interview_instances = {}
from INTERVIEW.Interview_manager import InterviewManager

# ─────────────────────────────────────────────────────
# Head Tracking Implementation
# ─────────────────────────────────────────────────────

class EyeContactDetector_Callib():
    def __init__(self):
        self.FACE_3D_IDX = [1, 33, 263, 61, 291, 199] 
        self.left_eye_idx = [33, 133, 159, 145]
        self.left_iris_idx = 468
        self.right_eye_idx = [362, 263, 386, 374]
        self.right_iris_idx = 473

        self.calibrated = False
        self.eye_threshold = 0.25
        self.head_threshold = 30
        # Absolute limits for iris position (0 = extreme left/top, 1 = extreme right/bottom)
        self.horizontal_eye_limits = (0.2, 0.8)
        self.vertical_eye_limits = (0.2, 0.8)

        self.baseline = {
            "left_eye": None,
            "right_eye": None,
            "yaw": None,
            "pitch": None,
        }

        # ✅ ADD: Frame rate limiting to prevent overwhelming the system
        self.last_process_time = 0
        self.min_frame_interval = 0.1  # 100ms = 10 FPS max

        self.mp_face_mesh = mp.solutions.face_mesh
        # ✅ FIX: Use static image mode to avoid timestamp issues
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=True,  # Process individual frames without timestamp requirements
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )

    def reset_calibration(self):
        """Reset calibration state for new session"""
        self.calibrated = False
        self.baseline = {
            "left_eye": None,
            "right_eye": None,
            "yaw": None,
            "pitch": None,
        }
        print("[DEBUG] Calibration state reset for new session")

    def get_eye_ratios(self, landmarks, eye_idx, iris_idx, w, h):
        try:
            left = landmarks[eye_idx[0]]
            right = landmarks[eye_idx[1]]
            top = landmarks[eye_idx[2]]
            bottom = landmarks[eye_idx[3]]
            iris = landmarks[iris_idx]

            x_left, x_right = left.x * w, right.x * w
            y_top, y_bottom = top.y * h, bottom.y * h
            iris_x, iris_y = iris.x * w, iris.y * h

            horizontal_ratio = (iris_x - x_left) / (x_right - x_left + 1e-6)
            vertical_ratio = (iris_y - y_top) / (y_bottom - y_top + 1e-6)

            return horizontal_ratio, vertical_ratio
        except Exception as e:
            print(f"Error in get_eye_ratios: {e}")
            return 0.5, 0.5  # Return center position as fallback

    def get_head_pose(self, landmarks, w, h):
        try:
            face_2d, face_3d = [], []
            for idx in self.FACE_3D_IDX:
                lm = landmarks[idx]
                x, y = int(lm.x * w), int(lm.y * h)
                face_2d.append([x, y])
                face_3d.append([x, y, lm.z * 3000])
            face_2d = np.array(face_2d, dtype=np.float64)
            face_3d = np.array(face_3d, dtype=np.float64)

            cam_matrix = np.array([[w, 0, w / 2],
                                   [0, w, h / 2],
                                   [0, 0, 1]])
            dist_coeffs = np.zeros((4, 1))

            _, rot_vec, _ = cv2.solvePnP(face_3d, face_2d, cam_matrix, dist_coeffs)
            rmat, _ = cv2.Rodrigues(rot_vec)
            angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
            yaw, pitch = angles[1], angles[0]

            return yaw, pitch
        except Exception as e:
            print(f"Error in get_head_pose: {e}")
            return 0.0, 0.0  # Return neutral position as fallback

    def calibrate(self, landmarks, w, h):
        try:
            left_eye = self.get_eye_ratios(landmarks, self.left_eye_idx, self.left_iris_idx, w, h)
            right_eye = self.get_eye_ratios(landmarks, self.right_eye_idx, self.right_iris_idx, w, h)
            yaw, pitch = self.get_head_pose(landmarks, w, h)

            self.baseline["left_eye"] = left_eye
            self.baseline["right_eye"] = right_eye
            self.baseline["yaw"] = yaw
            self.baseline["pitch"] = pitch

            self.calibrated = True
            print("Calibration completed:", self.baseline)
        except Exception as e:
            print(f"Error in calibrate: {e}")
            # Don't set calibrated to True if there's an error
            self.calibrated = False

    def is_looking_at_camera_pre_calibration(self, landmarks, w, h):
        """Check if person is looking at camera before calibration using basic heuristics"""
        left_eye = self.get_eye_ratios(landmarks, self.left_eye_idx, self.left_iris_idx, w, h)
        right_eye = self.get_eye_ratios(landmarks, self.right_eye_idx, self.right_iris_idx, w, h)
        
        # Check if iris is within reasonable bounds
        left_h, left_v = left_eye
        right_h, right_v = right_eye
        
        # Check horizontal position (should be roughly centered)
        left_centered = bool(self.horizontal_eye_limits[0] <= left_h <= self.horizontal_eye_limits[1])
        right_centered = bool(self.horizontal_eye_limits[0] <= right_h <= self.horizontal_eye_limits[1])
        
        # Check vertical position (should be roughly centered)
        left_vertical_centered = bool(self.vertical_eye_limits[0] <= left_v <= self.vertical_eye_limits[1])
        right_vertical_centered = bool(self.vertical_eye_limits[0] <= right_v <= self.vertical_eye_limits[1])
        
        # Both eyes should be reasonably centered
        return bool(left_centered and right_centered and left_vertical_centered and right_vertical_centered)

    def is_looking_at_camera(self, landmarks, w, h):
        if not self.calibrated:
            return self.is_looking_at_camera_pre_calibration(landmarks, w, h)

        left_eye = self.get_eye_ratios(landmarks, self.left_eye_idx, self.left_iris_idx, w, h)
        right_eye = self.get_eye_ratios(landmarks, self.right_eye_idx, self.right_iris_idx, w, h)
        yaw, pitch = self.get_head_pose(landmarks, w, h)

        # Calculate differences from baseline
        left_diff = np.sqrt((left_eye[0] - self.baseline["left_eye"][0])**2 + 
                           (left_eye[1] - self.baseline["left_eye"][1])**2)
        right_diff = np.sqrt((right_eye[0] - self.baseline["right_eye"][0])**2 + 
                            (right_eye[1] - self.baseline["right_eye"][1])**2)
        
        yaw_diff = abs(yaw - self.baseline["yaw"])
        pitch_diff = abs(pitch - self.baseline["pitch"])

        # Check if within thresholds
        eye_ok = bool(left_diff < self.eye_threshold and right_diff < self.eye_threshold)
        head_ok = bool(yaw_diff < self.head_threshold and pitch_diff < self.head_threshold)

        return eye_ok and head_ok

    def process(self, frame, is_calibrating=False):
        # ✅ ADD: Frame rate limiting to prevent overwhelming the system
        import time
        current_time = time.time()
        if current_time - self.last_process_time < self.min_frame_interval:
            # Skip this frame to maintain frame rate limit
            return {
                "looking": False,
                "message": "Frame rate limited"
            }
        self.last_process_time = current_time
        
        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # ✅ FIX: Process frame in static mode (no timestamp issues)
        results = self.face_mesh.process(rgb)

        if not results.multi_face_landmarks:
            # Debug: Log when no face is detected
            if hasattr(self, '_no_face_counter'):
                self._no_face_counter += 1
            else:
                self._no_face_counter = 0
            
            if self._no_face_counter % 10 == 0:  # Log every 10th no-face detection
                print(f"[DEBUG] No face detected (counter: {self._no_face_counter})")
            
            if is_calibrating:
                return {
                    "looking": False,
                    "ready_for_calibration": False,
                    "message": "No face detected"
                }
            else:
                return {
                    "looking": False,
                    "message": "No face detected"
                }

        landmarks = results.multi_face_landmarks[0].landmark
        
        # Debug: Log when face is detected
        if hasattr(self, '_face_detected_counter'):
            self._face_detected_counter += 1
        else:
            self._face_detected_counter = 0
        
        if self._face_detected_counter % 50 == 0:  # Log every 50th face detection
            print(f"[DEBUG] Face detected (counter: {self._face_detected_counter})")
        
        if is_calibrating:
            # Only calibrate if not already calibrated
            if self.calibrated:
                print("[DEBUG] Already calibrated, skipping calibration")
                return {
                    "looking": bool(self.is_looking_at_camera(landmarks, w, h))
                }
            
            if self.is_looking_at_camera_pre_calibration(landmarks, w, h):
                self.calibrate(landmarks, w, h)
                return {
                    "calibrated": True,
                    "looking": True,
                    "ready_for_calibration": False,
                    "message": "Calibration successful"
                }
            else:
                return {
                    "calibrated": False,
                    "looking": False,
                    "ready_for_calibration": True,
                    "message": "Please look directly at the camera"
                }
        else:
            # During normal monitoring (including calibration check phase)
            looking = self.is_looking_at_camera(landmarks, w, h)
            
            # If not calibrated yet, also check if ready for calibration
            if not self.calibrated:
                ready_for_calibration = self.is_looking_at_camera_pre_calibration(landmarks, w, h)
                return {
                    "looking": bool(looking),
                    "ready_for_calibration": bool(ready_for_calibration)
                }
            else:
                # After calibration, only check if currently looking
                return {
                    "looking": bool(looking)
                }

# Global detector instance
try:
    detector = EyeContactDetector_Callib()
    print("[DEBUG] Head tracking detector initialized successfully")
except Exception as e:
    print(f"[ERROR] Failed to initialize head tracking detector: {e}")
    import traceback
    traceback.print_exc()
    detector = None

def decode_image(img_data):
    try:
        # Check if img_data looks like a base64 data URL
        if "," not in img_data:
            raise ValueError("Image data does not contain a comma separator")

        header, encoded = img_data.split(",", 1)
        if not encoded:
            raise ValueError("No encoded data found after header")

        img_bytes = base64.b64decode(encoded)
        img = Image.open(BytesIO(img_bytes))
        cv_img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        return cv_img

    except (ValueError, base64.binascii.Error, UnidentifiedImageError) as e:
        print(f"decode_image error: {e}")
        return None



# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_service_key:
    raise ValueError("Missing Supabase environment variables")

supabase: Client = create_client(supabase_url, supabase_service_key)

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
            whisper_model = WhisperModel("large-v3", device=whisper_device)
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

# ─────────────────────────────────────────────────────
# Global flags and file tracking
# ─────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────
#  Flask app config using env values
# ─────────────────────────────────────────────────────

app = Flask(__name__)
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
        
        # Get new parameters for question generation
        question_counts = data.get('question_counts', {
            'beginner': 2,
            'medium': 2,
            'hard': 2
        })
        split_mode = data.get('split', False)
        resume_pct = data.get('resume_pct', 50)
        jd_pct = data.get('jd_pct', 50)
        blend_mode = data.get('blend', False)
        blend_pct_resume = data.get('blend_pct_resume', 50)
        blend_pct_jd = data.get('blend_pct_jd', 50)
        
        if not all([resume_url, job_description, job_title]):
            return jsonify({
                "success": False,
                "message": "Missing required fields: resume_url, job_description, job_title"
            }), 400
        
        print(f"[DEBUG] Generating questions for job: {job_title}")
        print(f"[DEBUG] Question counts: {question_counts}")
        print(f"[DEBUG] Split mode: {split_mode} (Resume {resume_pct}% | JD {jd_pct}%)")
        print(f"[DEBUG] Blend mode: {blend_mode} (Resume {blend_pct_resume}% | JD {blend_pct_jd}%)")
        
        # Download resume file from Supabase Storage
        import requests
        
        # Extract file path from URL
        # URL format: http://127.0.0.1:54321/storage/v1/object/public/resumes/user_files/...
        file_path = resume_url.split('/storage/v1/object/public/')[-1]
        
        # Extract the original file extension from the URL path
        # The filename in the URL should preserve the original extension
        original_filename = file_path.split('/')[-1]  # Get the filename part
        file_ext = original_filename.split('.')[-1].lower() if '.' in original_filename else 'pdf'
        
        print(f"[DEBUG] Original filename from URL: {original_filename}")
        print(f"[DEBUG] Extracted extension: {file_ext}")
        
        # Download file to temporary location with correct extension
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_ext}') as temp_file:
            response = requests.get(resume_url)
            response.raise_for_status()
            temp_file.write(response.content)
            temp_resume_path = temp_file.name
        
        print(f"[DEBUG] Downloaded resume to: {temp_resume_path}")
        print(f"[DEBUG] Using extension: {file_ext}")
        
        try:
            # Import and run the new resume pipeline
            from INTERVIEW.Resumeparser import run_pipeline_from_api
            
            # Run the pipeline with frontend data and new parameters
            result = run_pipeline_from_api(
                resume_path=temp_resume_path,
                job_title=job_title,
                job_description=job_description,
                question_counts=question_counts,
                include_answers=True,  # Generate answers by default
                split=split_mode,
                resume_pct=resume_pct,
                jd_pct=jd_pct,
                blend=blend_mode,
                blend_pct_resume=blend_pct_resume,
                blend_pct_jd=blend_pct_jd
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
        
        # ✅ NEW: Store user audio file permanently
        if transcription:  # Only store if transcription was successful
            try:
                # Get user_id and interview_id from request
                user_id = request.user.get('id')
                interview_id = request.args.get('interview_id') or request.form.get('interview_id')
                
                if user_id and interview_id:
                    # Generate filename for user audio
                    timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
                    user_filename = f"user_speech_{timestamp}.wav"
                    user_file_path = f"{user_id}/{interview_id}/{user_filename}"
                    
                    # Reset file pointer and upload
                    file.seek(0)
                    result = supabase.storage.from_('audio-files').upload(
                        path=user_file_path,
                        file=file.read(),
                        file_options={"content-type": "audio/wav"}
                    )
                    
                    if result:
                        print(f"[INFO] User audio stored successfully: {user_file_path}")
                    else:
                        print(f"[WARNING] Failed to store user audio")
                        
            except Exception as e:
                print(f"[ERROR] Failed to store user audio: {e}")
                # Don't fail the transcription if storage fails
        
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

# Import for voice synthesis
from Piper.voiceCloner import synthesize_text_to_wav

# Modify the existing generate_response function
@app.route('/api/generate-response', methods=['POST'])
@verify_supabase_token
def generate_response():
    """Generate interview response from user input and create audio"""
    try:
        data = request.get_json()
        user_input = data.get('message', '').strip()
        
        if not user_input:
            return jsonify({
                "success": False,
                "message": "User input is required"
            }), 400
        
        # Get interview_id from request
        interview_id = data.get('interview_id')
        if not interview_id:
            return jsonify({
                "success": False,
                "message": "Interview ID is required"
            }), 400
        
        # Get auth token from request
        auth_token = request.headers.get('Authorization').split(' ')[1]
        
        # ✅ ADD DEBUG: Print environment and request details
        supabase_url = os.getenv('SUPABASE_URL')
        print(f"[DEBUG] Supabase URL: {supabase_url}")
        print(f"[DEBUG] Interview ID: {interview_id}")
        print(f"[DEBUG] Auth token length: {len(auth_token) if auth_token else 0}")
        
        # ✅ Use edge function to fetch interview data
        import requests
        
        # ✅ This should work perfectly since SUPABASE_URL is already local
        supabase_url = os.getenv('SUPABASE_URL')
        print(f"[DEBUG] Supabase URL: {supabase_url}")  # Should show http://127.0.0.1:54321

        edge_function_url = f"{supabase_url}/functions/v1/interview-data"
        print(f"[DEBUG] Edge function URL: {edge_function_url}")  # Should show http://127.0.0.1:54321/functions/v1/interview-data
        
        try:
            print(f"[DEBUG] Making request to edge function...")
            response = requests.get(
                edge_function_url,
                headers={
                    'Authorization': f'Bearer {auth_token}',
                    'Content-Type': 'application/json'
                },
                params={'interview_id': interview_id},
                timeout=10  # Add timeout
            )
            
            print(f"[DEBUG] Edge function response status: {response.status_code}")
            print(f"[DEBUG] Edge function response headers: {dict(response.headers)}")
            print(f"[DEBUG] Edge function response body: {response.text[:500]}...")  # First 500 chars
            
            if response.status_code != 200:
                print(f"[ERROR] Edge function failed: {response.status_code} - {response.text}")
                return jsonify({
                    "success": False,
                    "message": f"Failed to fetch interview data: {response.status_code}"
                }), 500
            
            result = response.json()
            print(f"[DEBUG] Edge function JSON result: {result}")
            
            if not result.get('success'):
                return jsonify({
                    "success": False,
                    "message": result.get('message', 'Failed to fetch interview data')
                }), 500
            
            interview_data = result['data']
            
            job_title = interview_data['job_description']['title']
            job_description = interview_data['job_description']['description']
            questions = interview_data['questions']
            
            # Extract core questions
            core_questions = [q['question_text'] for q in questions]
            
            print(f"[DEBUG] Fetched interview config: job_title='{job_title}', questions_count={len(core_questions)}")
            
        except requests.exceptions.RequestException as req_error:
            print(f"[ERROR] Request exception: {req_error}")
            return jsonify({
                "success": False,
                "message": f"Network error: {str(req_error)}"
            }), 500
        except Exception as edge_error:
            print(f"[ERROR] Edge function call failed: {edge_error}")
            import traceback
            traceback.print_exc()
            return jsonify({
                "success": False,
                "message": "Failed to fetch interview details"
            }), 500
        
        # Create dynamic config
        dynamic_config = {
            "job_title": job_title,
            "job_description": job_description,
            "core_questions": core_questions,
            "time_limit_minutes": 30,
            "custom_questions": [],
        }
        
        # Create temporary config file
        import tempfile
        import json
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_config:
            json.dump(dynamic_config, temp_config, indent=2)
            config_path = temp_config.name
        
        # Create or get InterviewManager instance
        user_id = request.user.get('id')
        instance_key = f"{interview_id}:{user_id}"
        if instance_key not in interview_instances:
            print(f"[INFO] Creating new InterviewManager instance for: {instance_key}")
            interview_instances[instance_key] = InterviewManager(config_path=config_path)
        
        manager = interview_instances[instance_key]
        response = manager.receive_input(user_input)
        
        print(f"[DEBUG] Interview response: {response}")
        
        # ✅ NEW: Generate audio for the interview response
        audio_url = None
        audio_file_path = None
        
        if response.get("message") and not response.get("interview_done", False):
            try:
                print(f"[DEBUG] Generating audio for interview response...")
                
                # Generate unique filename for this response
                def generate_filename(text: str, user_id: str, interview_id: str):
                    text_hash = hashlib.md5(text.encode()).hexdigest()[:8]
                    timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
                    return f"interview_response_{interview_id}_{text_hash}_{timestamp}.wav"
                
                response_text = response.get("message", "")
                filename = generate_filename(response_text, user_id, interview_id)
                file_path = f"{user_id}/{interview_id}/interviewer_{filename}"
                
                print(f"[DEBUG] Generated filename: {filename}")
                
                # Generate audio file
                import tempfile
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
                temp_file.close()
                
                try:
                    # Generate audio using Piper
                    audio_file_path = synthesize_text_to_wav(response_text, temp_file.name)
                    print(f"[DEBUG] Audio generated: {audio_file_path}")
                    
                    # Upload to Supabase Storage
                    print(f"[DEBUG] Uploading interview response audio...")
                    
                    # Read the audio file
                    with open(audio_file_path, 'rb') as f:
                        audio_data = f.read()
                    
                    file_size = len(audio_data)
                    print(f"[DEBUG] Audio file size: {file_size} bytes")
                    
                    # Upload to Supabase Storage
                    result = supabase.storage.from_('audio-files').upload(
                        path=file_path,
                        file=audio_data,
                        file_options={"content-type": "audio/wav"}
                    )
                    
                    if result:
                        # Get the public URL
                        audio_url = supabase.storage.from_('audio-files').get_public_url(file_path)
                        print(f"[DEBUG] Interview response audio uploaded successfully: {audio_url}")
                    else:
                        print(f"[WARNING] Failed to upload interview response audio")
                        
                finally:
                    # Clean up temporary file
                    if os.path.exists(temp_file.name):
                        os.unlink(temp_file.name)
                        print(f"[CLEANUP] Removed temporary audio file: {temp_file.name}")
                        
            except Exception as audio_error:
                print(f"[ERROR] Audio generation failed: {audio_error}")
                import traceback
                traceback.print_exc()
                # Continue without audio if generation fails
        
        # ✅ NEW: Handle interview completion - Save everything to database
        feedback_saved_successfully = False
        if response.get("interview_done", False):
            try:
                print(f"[INFO] Interview completed - saving transcript, evaluation, and merging audio...")
                
                # ✅ NEW: Merge all audio files first
                print(f"[INFO] Starting audio merge process...")
                merged_audio_path = merge_interview_audio(user_id, interview_id)
                
                if merged_audio_path:
                    print(f"[SUCCESS] Audio transcript created: {merged_audio_path}")
                    
                    # ✅ NEW: Clean up individual audio files
                    print(f"[INFO] Cleaning up individual audio files...")
                    cleanup_individual_audio_files(user_id, interview_id, keep_merged_audio=True)
                    
                    # Get the audio transcript URL for database storage
                    audio_transcript_url = supabase.storage.from_('audio-files').get_public_url(merged_audio_path)
                    print(f"[INFO] Audio transcript URL: {audio_transcript_url}")
                    
                else:
                    print(f"[WARNING] Audio merge failed - keeping individual files")
                    audio_transcript_url = None
                
                # Get the generated data from InterviewManager
                transcript_data = {
                    "interview_id": interview_id,
                    "full_transcript": json.dumps(manager.conversation_history, indent=2),
                    "evaluation_data": manager.final_evaluation_log
                }
                
                print(f"[DEBUG] Saving transcript data: {transcript_data}")
                
                # Save to transcripts table
                transcript_response = requests.post(
                    f"{supabase_url}/functions/v1/transcripts",
                    headers={
                        'Authorization': f'Bearer {auth_token}',
                        'Content-Type': 'application/json'
                    },
                    json=transcript_data
                )
                
                # ✅ FIXED: Check for both 200 and 201 (success codes)
                if transcript_response.status_code in [200, 201]:
                    print(f"[INFO] Transcript and evaluation saved to database successfully")
                    print(f"[DEBUG] Transcript response: {transcript_response.status_code} - {transcript_response.text}")
                    
                    # ✅ Use InterviewManager's generated data
                    summary = manager.final_summary
                    key_strengths = manager.key_strengths
                    improvement_areas = manager.improvement_areas
                    
                    # ✅ UPDATED: Save feedback to interview_feedback table with audio transcript URL
                    feedback_data = {
                        "interview_id": interview_id,
                        "summary": summary,
                        "key_strengths": key_strengths,
                        "improvement_areas": improvement_areas,
                        "audio_url": audio_transcript_url  # ✅ NEW: Include audio transcript URL
                    }
                    
                    print(f"[DEBUG] Saving feedback data: {feedback_data}")
                    
                    feedback_response = requests.post(
                        f"{supabase_url}/functions/v1/interview-feedback",
                        headers={
                            'Authorization': f'Bearer {auth_token}',
                            'Content-Type': 'application/json'
                        },
                        json=feedback_data
                    )
                    
                    # ✅ FIXED: Check for both 200 and 201 (success codes)
                    if feedback_response.status_code in [200, 201]:
                        print(f"[INFO] Interview feedback (summary, strengths, improvements) saved to database")
                        print(f"[DEBUG] Feedback response: {feedback_response.status_code} - {feedback_response.text}")
                        
                        # ✅ NEW: Update interview status to ENDED - ONLY when interview is done
                        try:
                            print(f"[INFO] Updating interview status to ENDED...")
                            
                            # Update interview status using interviews edge function
                            status_update_response = requests.put(
                                f"{supabase_url}/functions/v1/interviews/{interview_id}",
                                headers={
                                    'Authorization': f'Bearer {auth_token}',
                                    'Content-Type': 'application/json'
                                },
                                json={
                                    'status': 'ENDED'
                                }
                            )
                            
                            if status_update_response.status_code in [200, 201]:
                                print(f"[INFO] Interview status updated to ENDED successfully")
                                print(f"[DEBUG] Status update response: {status_update_response.status_code} - {status_update_response.text}")
                                # ✅ NEW: Mark feedback as successfully saved only when everything is complete
                                feedback_saved_successfully = True
                            else:
                                print(f"[WARNING] Failed to update interview status: {status_update_response.status_code} - {status_update_response.text}")
                                
                        except Exception as update_error:
                            print(f"[ERROR] Failed to update interview status: {update_error}")
                            import traceback
                            traceback.print_exc()
                            
                    else:
                        print(f"[WARNING] Failed to save feedback: {feedback_response.status_code} - {feedback_response.text}")
                else:
                    print(f"[ERROR] Failed to save transcript: {transcript_response.status_code} - {transcript_response.text}")
                    
            except Exception as save_error:
                print(f"[ERROR] Failed to save interview data: {save_error}")
                import traceback
                traceback.print_exc()
        
        return jsonify({
            "success": True,
            "message": "Response generated successfully",
            "data": {
                "response": response.get("message", "Sorry, something went wrong."),
                "stage": response.get("stage", "unknown"),
                "interview_done": response.get("interview_done", False),
                "feedback_saved_successfully": feedback_saved_successfully,  # ✅ NEW: Include feedback save status
                "audio_url": audio_url,  # ✅ NEW: Include audio URL
                "audio_file_path": file_path if audio_url else None,  # ✅ NEW: Include file path for deletion
                "should_delete_audio": False,  # ✅ NEW: Keep audio files for merging later
                "requires_code": response.get("requires_code", False),  # ✅ NEW: Include coding question flag
                "code_language": response.get("code_language", None)  # ✅ NEW: Include programming language
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

## **API Usage

@app.route('/api/generate-speech', methods=['POST', 'OPTIONS'])
@verify_supabase_token
def generate_speech():
    """Generate speech from text and return audio URL"""
    # Handle CORS preflight request
    if request.method == 'OPTIONS':
        return jsonify({"message": "OK"}), 200
    
    try:
        # Get data from request
        data = request.get_json()
        text = data.get('text', '').strip()
        
        if not text:
            return jsonify({
                "success": False,
                "message": "Text input is required"
            }), 400
        
        # Validate text length
        if len(text) > 1000:  # Limit to 1000 characters
            return jsonify({
                "success": False,
                "message": "Text too long. Maximum 1000 characters allowed."
            }), 400
        
        print(f"[DEBUG] Generating speech for text: {text[:50]}...")
        
        # Get user ID for file organization
        user_id = request.user.get('id')
        
        # Generate unique filename
        def generate_filename(text: str, user_id: str):
            text_hash = hashlib.md5(text.encode()).hexdigest()[:8]
            timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
            return f"tts_{user_id}_{text_hash}_{timestamp}.wav"
        
        filename = generate_filename(text, user_id)
        file_path = f"{user_id}/general/{filename}"  # For general TTS not tied to interviews
        
        print(f"[DEBUG] Generated filename: {filename}")
        
        # Step 1: Generate audio file
        import tempfile
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        temp_file.close()
        
        try:
            # Generate audio using Piper
            audio_file_path = synthesize_text_to_wav(text, temp_file.name)
            print(f"[DEBUG] Audio generated: {audio_file_path}")
            
            # Step 2: Upload to Supabase Storage
            print(f"[DEBUG] Uploading to Supabase Storage...")
            
            # Read the audio file
            with open(audio_file_path, 'rb') as f:
                audio_data = f.read()
            
            file_size = len(audio_data)
            print(f"[DEBUG] Audio file size: {file_size} bytes")
            
            # Upload to Supabase Storage
            result = supabase.storage.from_('audio-files').upload(
                path=file_path,
                file=audio_data,
                file_options={"content-type": "audio/wav"}
            )
            
            if result:
                # Get the public URL
                public_url = supabase.storage.from_('audio-files').get_public_url(file_path)
                print(f"[DEBUG] Audio uploaded successfully: {public_url}")
                
                return jsonify({
                    "success": True,
                    "message": "Speech generated successfully",
                    "data": {
                        "audio_url": public_url,
                        "text": text,
                        "filename": filename,
                        "file_path": file_path,
                        "file_size": file_size,
                        "duration_estimate": len(text.split()) * 0.5,  # Rough estimate: 0.5s per word
                        "created_at": datetime.now().isoformat()
                    }
                })
            else:
                return jsonify({
                    "success": False,
                    "message": "Failed to upload audio to storage"
                }), 500
                
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file.name):
                os.unlink(temp_file.name)
                print(f"[CLEANUP] Removed temporary file: {temp_file.name}")
            
    except Exception as e:
        print(f"[ERROR] General error in generate_speech: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": f"Internal server error: {str(e)}"
        }), 500

@app.route('/api/delete-audio', methods=['DELETE', 'OPTIONS'])
@verify_supabase_token
def delete_audio():
    """Delete audio file from storage bucket"""
    # Handle CORS preflight request
    if request.method == 'OPTIONS':
        return jsonify({"message": "OK"}), 200
    
    try:
        # Get data from request
        data = request.get_json()
        audio_url = data.get('audio_url', '').strip()
        
        if not audio_url:
            return jsonify({
                "success": False,
                "message": "Audio URL is required"
            }), 400
        
        print(f"[DEBUG] Deleting audio: {audio_url}")
        
        # Extract file path from URL
        # URL format: http://127.0.0.1:54321/storage/v1/object/public/audio-files/tts-audio/user-id/filename.wav
        try:
            # Remove the base URL to get the file path
            base_url = f"{os.getenv('SUPABASE_URL')}/storage/v1/object/public/audio-files/"
            if audio_url.startswith(base_url):
                file_path = audio_url[len(base_url):]
                # Remove any query parameters
                file_path = file_path.split('?')[0]
            else:
                return jsonify({
                    "success": False,
                    "message": "Invalid audio URL format"
                }), 400
            
            print(f"[DEBUG] Extracted file path: {file_path}")
            
            # Verify the file belongs to the current user
            user_id = request.user.get('id')
            expected_prefix = f"tts-audio/{user_id}/"
            
            if not file_path.startswith(expected_prefix):
                return jsonify({
                    "success": False,
                    "message": "Access denied: You can only delete your own audio files"
                }), 403
            
            # Delete the file from Supabase Storage
            result = supabase.storage.from_('audio-files').remove([file_path])
            
            if result:
                print(f"[DEBUG] Audio file deleted successfully: {file_path}")
                return jsonify({
                    "success": True,
                    "message": "Audio file deleted successfully",
                    "data": {
                        "deleted_file": file_path,
                        "deleted_at": datetime.now().isoformat()
                    }
                })
            else:
                return jsonify({
                    "success": False,
                    "message": "Failed to delete audio file"
                }), 500
                
        except Exception as parse_error:
            print(f"[ERROR] URL parsing failed: {parse_error}")
            return jsonify({
                "success": False,
                "message": "Invalid audio URL format"
            }), 400
            
    except Exception as e:
        print(f"[ERROR] General error in delete_audio: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": f"Internal server error: {str(e)}"
        }), 500

@app.route('/api/list-audio-files', methods=['GET', 'OPTIONS'])
@verify_supabase_token
def list_audio_files():
    """List all audio files for the current user"""
    # Handle CORS preflight request
    if request.method == 'OPTIONS':
        return jsonify({"message": "OK"}), 200
    
    try:
        user_id = request.user.get('id')
        folder_path = f"tts-audio/{user_id}"
        
        print(f"[DEBUG] Listing audio files for user: {user_id}")
        
        # List files in the user's audio folder
        result = supabase.storage.from_('audio-files').list(path=folder_path)
        
        if result:
            audio_files = []
            for file_info in result:
                file_path = f"{folder_path}/{file_info['name']}"
                public_url = supabase.storage.from_('audio-files').get_public_url(file_path)
                
                audio_files.append({
                    "filename": file_info['name'],
                    "file_path": file_path,
                    "audio_url": public_url,
                    "file_size": file_info.get('metadata', {}).get('size', 0),
                    "created_at": file_info.get('created_at'),
                    "updated_at": file_info.get('updated_at')
                })
            
            return jsonify({
                "success": True,
                "message": f"Found {len(audio_files)} audio files",
                "data": {
                    "audio_files": audio_files,
                    "total_count": len(audio_files)
                }
            })
        else:
            return jsonify({
                "success": True,
                "message": "No audio files found",
                "data": {
                    "audio_files": [],
                    "total_count": 0
                }
            })
            
    except Exception as e:
        print(f"[ERROR] General error in list_audio_files: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": f"Internal server error: {str(e)}"
        }), 500

# ─────────────────────────────────────────────────────
# Head Tracking Socket.IO Endpoints
# ─────────────────────────────────────────────────────

# Socket.IO connection handlers
@socketio.on('connect')
def handle_connect():
    print('Client connected to head tracking socket')
    emit('response', {'message': 'Connected to head tracking service'})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected from head tracking socket')

# Socket.IO frame handler for head tracking
@socketio.on("frame")
def handle_frame(data):
    try:
        img_data = data.get("image")
        calibrate = data.get("calibrate", False)

        if not img_data:
            emit("response", {"error": "No image data provided"})
            return

        frame = decode_image(img_data)
        if frame is None:
            print("[ERROR] Failed to decode image data")
            emit("response", {"error": "Invalid image data"})
            return
        
        if detector is None:
            print("[ERROR] Head tracking detector not initialized")
            emit("response", {"error": "Head tracking detector not available"})
            return
        
        result = detector.process(frame, is_calibrating=calibrate)
        
        # Debug: Log calibration attempts
        if calibrate:
            print(f"[DEBUG] Calibration request received - result: {result}")
        else:
            # Only log occasionally to avoid spam
            if hasattr(handle_frame, '_log_counter'):
                handle_frame._log_counter += 1
            else:
                handle_frame._log_counter = 0
            
            if handle_frame._log_counter % 50 == 0:  # Log every 50th frame
                print(f"[DEBUG] Normal monitoring frame - result: {result}")
            
            # Check for unexpected calibration results during normal monitoring
            if result.get('calibrated', False):
                print(f"[ERROR] Unexpected calibration result during normal monitoring: {result}")
            
        emit("response", result)
    except Exception as e:
        print(f"[ERROR] Exception in handle_frame: {e}")
        print(f"[ERROR] Exception type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        emit("response", {"error": f"Internal server error: {str(e)}"})

# Socket.IO reset calibration handler
@socketio.on("reset_calibration")
def handle_reset_calibration():
    try:
        detector.reset_calibration()
        emit("response", {"calibration_reset": True})
    except Exception as e:
        print(f"Error in reset_calibration: {e}")
        emit("response", {"error": "Failed to reset calibration"})



def merge_interview_audio(user_id, interview_id):
    """
    Merge all interviewer and user audio files into one complete interview recording
    Returns the path to the merged audio file
    """
    temp_files = []  # ✅ NEW: Track all temp files for cleanup
    
    try:
        print(f"[INFO] Starting audio merge for interview {interview_id}")
        
        # List all files in the interview folder
        folder_path = f"{user_id}/{interview_id}"
        result = supabase.storage.from_('audio-files').list(path=folder_path)
        
        if not result:
            print(f"[WARNING] No audio files found in {folder_path}")
            return None
        
        # ✅ FIXED: Create a list of all audio files with their timestamps and order
        audio_files_with_order = []
        
        for file_info in result:
            filename = file_info['name']
            
            if filename.startswith('interviewer_') or filename.startswith('user_speech_'):
                # Extract timestamp from filename to determine order
                # Format: interviewer_response_2025-09-02T12-47-40.wav or user_speech_2025-09-02T12-47-40.wav
                try:
                    # Find the timestamp part in the filename
                    if 'T' in filename and '.wav' in filename:
                        # Extract timestamp from filename
                        timestamp_part = filename.split('T')[1].split('.wav')[0]
                        # Convert to datetime for proper sorting
                        from datetime import datetime
                        file_time = datetime.strptime(timestamp_part, '%H-%M-%S')
                        
                        audio_files_with_order.append({
                            'filename': filename,
                            'timestamp': file_time,
                            'type': 'interviewer' if filename.startswith('interviewer_') else 'user'
                        })
                        print(f"[DEBUG] Found audio file: {filename} at {file_time}")
                    else:
                        print(f"[WARNING] Could not parse timestamp from filename: {filename}")
                        continue
                        
                except Exception as e:
                    print(f"[WARNING] Failed to parse timestamp from {filename}: {e}")
                    continue
        
        if not audio_files_with_order:
            print(f"[WARNING] No valid audio files found for merging")
            return None
        
        # ✅ FIXED: Sort files by timestamp to maintain chronological order
        audio_files_with_order.sort(key=lambda x: x['timestamp'])
        
        print(f"[INFO] Audio files in chronological order:")
        for i, file_info in enumerate(audio_files_with_order):
            print(f"  {i+1}. {file_info['type']}: {file_info['filename']} at {file_info['timestamp']}")
        
        # Download and merge audio files in chronological order
        audio_segments = []
        
        for file_info in audio_files_with_order:
            try:
                filename = file_info['filename']
                file_path = f"{folder_path}/{filename}"
                print(f"[DEBUG] Processing {file_info['type']} file: {filename}")
                
                # Download audio file
                audio_data = supabase.storage.from_('audio-files').download(file_path)
                
                # Convert to AudioSegment
                temp_file = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
                temp_files.append(temp_file.name)  # ✅ NEW: Track for cleanup
                
                temp_file.write(audio_data)
                temp_file.close()
                
                # ✅ NEW: Add delay to ensure file is fully written
                time.sleep(0.1)
                
                audio_segment = AudioSegment.from_wav(temp_file.name)
                audio_segments.append(audio_segment)
                
                print(f"[DEBUG] Added {file_info['type']} audio segment: {len(audio_segment)}ms")
                
            except Exception as e:
                print(f"[ERROR] Failed to process {file_info['type']} file {filename}: {e}")
                continue
        
        if not audio_segments:
            print(f"[WARNING] No valid audio segments found for merging")
            return None
        
        # Merge all segments in chronological order
        print(f"[INFO] Merging {len(audio_segments)} audio segments in chronological order...")
        merged_audio = audio_segments[0]
        for segment in audio_segments[1:]:
            merged_audio = merged_audio + segment
        
        print(f"[INFO] Audio merge completed. Total duration: {len(merged_audio)}ms")
        
        # Save merged audio to temporary file
        merged_temp_file = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        temp_files.append(merged_temp_file.name)  # ✅ NEW: Track for cleanup
        
        merged_audio.export(merged_temp_file.name, format="wav")
        merged_temp_file.close()
        
        # ✅ NEW: Add delay to ensure file is fully written
        time.sleep(0.1)
        
        # Upload merged audio to storage
        merged_filename = f"audio_transcript_{interview_id}.wav"
        merged_file_path = f"{folder_path}/{merged_filename}"
        
        with open(merged_temp_file.name, 'rb') as f:
            merged_audio_data = f.read()
        
        # Upload to storage
        result = supabase.storage.from_('audio-files').upload(
            path=merged_file_path,
            file=merged_audio_data,
            file_options={"content-type": "audio/wav"}
        )
        
        if result:
            print(f"[SUCCESS] Audio transcript uploaded: {merged_file_path}")
            return merged_file_path
        else:
            print(f"[ERROR] Failed to upload audio transcript")
            return None
                
    except Exception as e:
        print(f"[ERROR] Audio merging failed: {e}")
        import traceback
        traceback.print_exc()
        return None
        
    finally:
        # ✅ NEW: Clean up all temp files
        print(f"[CLEANUP] Cleaning up {len(temp_files)} temporary files...")
        for temp_file_path in temp_files:
            try:
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                    print(f"[CLEANUP] Removed: {temp_file_path}")
            except Exception as cleanup_error:
                print(f"[WARNING] Failed to remove temp file {temp_file_path}: {cleanup_error}")

def cleanup_individual_audio_files(user_id, interview_id, keep_merged_audio=True):
    """
    Delete individual audio files after successful merging
    keep_merged_audio: if True, keeps the merged audio transcript file
    """
    try:
        print(f"[INFO] Cleaning up individual audio files for interview {interview_id}")
        
        folder_path = f"{user_id}/{interview_id}"
        result = supabase.storage.from_('audio-files').list(path=folder_path)
        
        if not result:
            print(f"[WARNING] No files found in {folder_path}")
            return
        
        files_to_delete = []
        for file_info in result:
            filename = file_info['name']
            
            # ✅ UPDATED: Keep audio transcript file
            if keep_merged_audio and filename.startswith('audio_transcript_'):
                print(f"[INFO] Keeping audio transcript file: {filename}")
                continue
            
            # Delete individual audio files
            if filename.startswith('interviewer_') or filename.startswith('user_speech_'):
                files_to_delete.append(f"{folder_path}/{filename}")
        
        if files_to_delete:
            print(f"[INFO] Deleting {len(files_to_delete)} individual audio files")
            
            # Delete files in batches (Supabase allows up to 1000 files per request)
            batch_size = 1000
            for i in range(0, len(files_to_delete), batch_size):
                batch = files_to_delete[i:i + batch_size]
                result = supabase.storage.from_('audio-files').remove(batch)
                
                if result:
                    print(f"[SUCCESS] Deleted batch {i//batch_size + 1}: {len(batch)} files")
                else:
                    print(f"[WARNING] Failed to delete batch {i//batch_size + 1}")
        else:
            print(f"[INFO] No individual audio files to delete")
            
    except Exception as e:
        print(f"[ERROR] Cleanup failed: {e}")
        import traceback
        traceback.print_exc()

# ─────────────────────────────────────────────────────
# Support Bot API Endpoint
# ─────────────────────────────────────────────────────

@app.route('/api/support-bot', methods=['POST', 'OPTIONS'])
@verify_supabase_token
def support_bot():
    """Support bot endpoint that provides intelligent customer support"""
    # Handle CORS preflight request
    if request.method == 'OPTIONS':
        return jsonify({"message": "OK"}), 200
    
    try:
        # Get data from request
        data = request.get_json()
        user_message = data.get('message', '').strip()
        
        if not user_message:
            return jsonify({
                "success": False,
                "message": "Message is required"
            }), 400
        
        print(f"[DEBUG] Support bot request: {user_message[:100]}...")
        
        # Create a new support bot manager instance for each request
        try:
            import sys
            import os
            support_bot_path = os.path.join(os.path.dirname(__file__), "Support-bot")
            if support_bot_path not in sys.path:
                sys.path.append(support_bot_path)
            
            from Support_manager_enhanced import SupportBotManager
            
            # Create fresh instance for each request (URL will be read from env)
            bot_manager = SupportBotManager(
                model="llama3",
                faq_path=os.path.join(support_bot_path, "support_bot.md")
                # supabase_url will be read from environment automatically
            )
            
            # Set the auth token for the bot (extracted from the request)
            auth_token = request.headers.get('Authorization')
            if auth_token:
                bot_manager.set_auth_token(auth_token)
            
            # Process the user message
            response = bot_manager.receive_input(user_message)
            
            print(f"[DEBUG] Support bot response: {response.get('message', '')[:100]}...")
            
            return jsonify({
                "success": True,
                "message": "Support response generated successfully",
                "data": {
                    "response": response.get("message", "Sorry, I couldn't process your request."),
                    "session_id": response.get("session_id"),
                    "conversation_length": response.get("conversation_length", 0),
                    "retrieved_sections": response.get("retrieved_sections", []),
                    "has_auth": response.get("has_auth", False)
                }
            })
            
        except Exception as e:
            print(f"[ERROR] Failed to create support bot manager: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({
                "success": False,
                "message": "Support bot is currently unavailable"
            }), 500
        
    except Exception as e:
        print(f"[ERROR] Support bot error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": f"Support bot error: {str(e)}"
        }), 500

# ─────────────────────────────────────────────────────
# Model Preloading for Support Bot
# ─────────────────────────────────────────────────────

def preload_support_bot_model():
    """Preload the support bot model at startup to avoid first-request delays"""
    try:
        print("[INFO] Preloading support bot model...")
        
        # Import the support bot manager
        import sys
        import os
        support_bot_path = os.path.join(os.path.dirname(__file__), "Support-bot")
        if support_bot_path not in sys.path:
            sys.path.append(support_bot_path)
        
        from Support_manager_enhanced import SupportBotManager
        
        # Initialize the support bot manager (this will load the model)
        global support_bot_manager
        support_bot_manager = SupportBotManager(
            model="llama3",
            faq_path=os.path.join(support_bot_path, "support_bot.md"),
            supabase_url=os.getenv("SUPABASE_URL", "http://localhost:54321")
        )
        
        # Test the model with a simple query to ensure it's fully loaded
        # test_response = support_bot_manager.receive_input("Hello")
        # print(f"[SUCCESS] Support bot model preloaded successfully")
        # print(f"[DEBUG] Test response: {test_response.get('message', '')[:50]}...")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] Failed to preload support bot model: {e}")
        import traceback
        traceback.print_exc()
        return False

# ========= Code Execution API Endpoints ==================

@app.route('/api/execute', methods=['POST', 'OPTIONS'])
@verify_supabase_token
def execute_code():
    """Execute code in various programming languages"""
    if request.method == 'OPTIONS':
        return jsonify({"message": "OK"}), 200
    
    try:
        data = request.get_json()
        code = data.get('code', '').strip()
        language = data.get('language', 'javascript').lower()
        test_mode = data.get('test', False)
        
        if not code:
            return jsonify({
                "success": False,
                "message": "No code provided"
            }), 400
        
        # Execute code based on language
        if language == 'javascript':
            return execute_javascript(code, test_mode)
        elif language == 'python':
            return execute_python(code, test_mode)
        elif language == 'java':
            return execute_java(code, test_mode)
        elif language == 'cpp':
            return execute_cpp(code, test_mode)
        elif language == 'csharp':
            return execute_csharp(code, test_mode)
        elif language == 'go':
            return execute_go(code, test_mode)
        elif language == 'rust':
            return execute_rust(code, test_mode)
        elif language == 'typescript':
            return execute_typescript(code, test_mode)
        else:
            return jsonify({
                "success": False,
                "message": f"Unsupported language: {language}"
            }), 400
            
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Execution error: {str(e)}"
        }), 500

def execute_javascript(code, test_mode=False):
    """Execute JavaScript code"""
    try:
        import subprocess
        import tempfile
        import os
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
            f.write(code)
            temp_file = f.name
        
        try:
            # Execute JavaScript with Node.js
            result = subprocess.run(
                ['node', temp_file],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            output = result.stdout
            error = result.stderr if result.returncode != 0 else None
            
            return jsonify({
                "success": True,
                "data": {
                    "output": output,
                    "error": error,
                    "testResults": None  # TODO: Add test framework support
                }
            })
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file):
                os.unlink(temp_file)
                
    except subprocess.TimeoutExpired:
        return jsonify({
            "success": False,
            "message": "Code execution timed out"
        }), 408
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"JavaScript execution error: {str(e)}"
        }), 500

def execute_python(code, test_mode=False):
    """Execute Python code"""
    try:
        import subprocess
        import tempfile
        import os
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            temp_file = f.name
        
        try:
            # Execute Python
            result = subprocess.run(
                ['python', temp_file],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            output = result.stdout
            error = result.stderr if result.returncode != 0 else None
            
            return jsonify({
                "success": True,
                "data": {
                    "output": output,
                    "error": error,
                    "testResults": None  # TODO: Add test framework support
                }
            })
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file):
                os.unlink(temp_file)
                
    except subprocess.TimeoutExpired:
        return jsonify({
            "success": False,
            "message": "Code execution timed out"
        }), 408
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Python execution error: {str(e)}"
        }), 500

def execute_java(code, test_mode=False):
    """Execute Java code"""
    try:
        import subprocess
        import tempfile
        import os
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.java', delete=False) as f:
            f.write(code)
            temp_file = f.name
        
        try:
            # Compile Java
            compile_result = subprocess.run(
                ['javac', temp_file],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if compile_result.returncode != 0:
                return jsonify({
                    "success": True,
                    "data": {
                        "output": "",
                        "error": compile_result.stderr,
                        "testResults": None
                    }
                })
            
            # Execute compiled class
            class_name = os.path.splitext(os.path.basename(temp_file))[0]
            class_dir = os.path.dirname(temp_file)
            
            result = subprocess.run(
                ['java', '-cp', class_dir, class_name],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            output = result.stdout
            error = result.stderr if result.returncode != 0 else None
            
            return jsonify({
                "success": True,
                "data": {
                    "output": output,
                    "error": error,
                    "testResults": None
                }
            })
            
        finally:
            # Clean up temporary files
            if os.path.exists(temp_file):
                os.unlink(temp_file)
            class_file = temp_file.replace('.java', '.class')
            if os.path.exists(class_file):
                os.unlink(class_file)
                
    except subprocess.TimeoutExpired:
        return jsonify({
            "success": False,
            "message": "Code execution timed out"
        }), 408
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Java execution error: {str(e)}"
        }), 500

def execute_cpp(code, test_mode=False):
    """Execute C++ code"""
    try:
        import subprocess
        import tempfile
        import os
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.cpp', delete=False) as f:
            f.write(code)
            temp_file = f.name
        
        try:
            # Compile C++
            compile_result = subprocess.run(
                ['g++', '-o', temp_file.replace('.cpp', ''), temp_file],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if compile_result.returncode != 0:
                return jsonify({
                    "success": True,
                    "data": {
                        "output": "",
                        "error": compile_result.stderr,
                        "testResults": None
                    }
                })
            
            # Execute compiled binary
            result = subprocess.run(
                [temp_file.replace('.cpp', '')],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            output = result.stdout
            error = result.stderr if result.returncode != 0 else None
            
            return jsonify({
                "success": True,
                "data": {
                    "output": output,
                    "error": error,
                    "testResults": None
                }
            })
            
        finally:
            # Clean up temporary files
            if os.path.exists(temp_file):
                os.unlink(temp_file)
            binary_file = temp_file.replace('.cpp', '')
            if os.path.exists(binary_file):
                os.unlink(binary_file)
                
    except subprocess.TimeoutExpired:
        return jsonify({
            "success": False,
            "message": "Code execution timed out"
        }), 408
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"C++ execution error: {str(e)}"
        }), 500

def execute_csharp(code, test_mode=False):
    """Execute C# code"""
    try:
        import subprocess
        import tempfile
        import os
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.cs', delete=False) as f:
            f.write(code)
            temp_file = f.name
        
        try:
            # Compile and execute C#
            result = subprocess.run(
                ['dotnet', 'script', temp_file],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            output = result.stdout
            error = result.stderr if result.returncode != 0 else None
            
            return jsonify({
                "success": True,
                "data": {
                    "output": output,
                    "error": error,
                    "testResults": None
                }
            })
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file):
                os.unlink(temp_file)
                
    except subprocess.TimeoutExpired:
        return jsonify({
            "success": False,
            "message": "Code execution timed out"
        }), 408
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"C# execution error: {str(e)}"
        }), 500

def execute_go(code, test_mode=False):
    """Execute Go code"""
    try:
        import subprocess
        import tempfile
        import os
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.go', delete=False) as f:
            f.write(code)
            temp_file = f.name
        
        try:
            # Execute Go
            result = subprocess.run(
                ['go', 'run', temp_file],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            output = result.stdout
            error = result.stderr if result.returncode != 0 else None
            
            return jsonify({
                "success": True,
                "data": {
                    "output": output,
                    "error": error,
                    "testResults": None
                }
            })
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file):
                os.unlink(temp_file)
                
    except subprocess.TimeoutExpired:
        return jsonify({
            "success": False,
            "message": "Code execution timed out"
        }), 408
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Go execution error: {str(e)}"
        }), 500

def execute_rust(code, test_mode=False):
    """Execute Rust code"""
    try:
        import subprocess
        import tempfile
        import os
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.rs', delete=False) as f:
            f.write(code)
            temp_file = f.name
        
        try:
            # Execute Rust
            result = subprocess.run(
                ['rustc', temp_file, '-o', temp_file.replace('.rs', '')],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode != 0:
                return jsonify({
                    "success": True,
                    "data": {
                        "output": "",
                        "error": result.stderr,
                        "testResults": None
                    }
                })
            
            # Execute compiled binary
            exec_result = subprocess.run(
                [temp_file.replace('.rs', '')],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            output = exec_result.stdout
            error = exec_result.stderr if exec_result.returncode != 0 else None
            
            return jsonify({
                "success": True,
                "data": {
                    "output": output,
                    "error": error,
                    "testResults": None
                }
            })
            
        finally:
            # Clean up temporary files
            if os.path.exists(temp_file):
                os.unlink(temp_file)
            binary_file = temp_file.replace('.rs', '')
            if os.path.exists(binary_file):
                os.unlink(binary_file)
                
    except subprocess.TimeoutExpired:
        return jsonify({
            "success": False,
            "message": "Code execution timed out"
        }), 408
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Rust execution error: {str(e)}"
        }), 500

def execute_typescript(code, test_mode=False):
    """Execute TypeScript code"""
    try:
        import subprocess
        import tempfile
        import os
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.ts', delete=False) as f:
            f.write(code)
            temp_file = f.name
        
        try:
            # Execute TypeScript with ts-node
            result = subprocess.run(
                ['npx', 'ts-node', temp_file],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            output = result.stdout
            error = result.stderr if result.returncode != 0 else None
            
            return jsonify({
                "success": True,
                "data": {
                    "output": output,
                    "error": error,
                    "testResults": None
                }
            })
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file):
                os.unlink(temp_file)
                
    except subprocess.TimeoutExpired:
        return jsonify({
            "success": False,
            "message": "Code execution timed out"
        }), 408
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"TypeScript execution error: {str(e)}"
        }), 500

# Preload the support bot model at startup
print("[INFO] Starting model preloading...")
preload_success = preload_support_bot_model()
if preload_success:
    print("[SUCCESS] All models preloaded successfully")
else:
    print("[WARNING] Some models failed to preload, will initialize on first request")

if __name__ == '__main__': 
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True)