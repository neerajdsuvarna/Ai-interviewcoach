from voiceCloner import synthesize_text_to_wav
import os
import requests
from supabase import create_client, Client
from dotenv import load_dotenv
import tempfile
from datetime import datetime
import hashlib

# Load environment variables from root .env file
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
load_dotenv(dotenv_path=env_path)

def debug_environment():
    """Debug environment variables"""
    print("=== ENVIRONMENT DEBUG ===")
    
    # Check if .env file exists
    print(f"[DEBUG] .env file path: {env_path}")
    print(f"[DEBUG] .env file exists: {os.path.exists(env_path)}")
    
    # Check environment variables
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    print(f"[DEBUG] SUPABASE_URL: {supabase_url}")
    print(f"[DEBUG] SUPABASE_SERVICE_ROLE_KEY length: {len(supabase_service_key) if supabase_service_key else 0}")
    
    if supabase_service_key:
        print(f"[DEBUG] Service key starts with: {supabase_service_key[:20]}...")
        print(f"[DEBUG] Service key ends with: ...{supabase_service_key[-20:]}")
    else:
        print("[ERROR] SUPABASE_SERVICE_ROLE_KEY is not set!")
    
    return supabase_url, supabase_service_key

def test_supabase_connection(supabase_url, supabase_service_key):
    """Test basic Supabase connection"""
    print("\n=== SUPABASE CONNECTION TEST ===")
    
    try:
        supabase: Client = create_client(supabase_url, supabase_service_key)
        
        # Test basic connection by listing buckets
        print("[DEBUG] Testing Supabase connection...")
        result = supabase.storage.list_buckets()
        
        if result:
            print(f"[SUCCESS] Connected to Supabase! Found {len(result)} buckets")
            for bucket in result:
                print(f"[DEBUG] Bucket: {bucket.name} (public: {bucket.public})")
            return supabase
        else:
            print("[ERROR] No buckets found or connection failed")
            return None
            
    except Exception as e:
        print(f"[ERROR] Supabase connection failed: {e}")
        return None

def generate_filename(text: str, user_id: str = "test_user"):
    """Generate unique filename for TTS audio"""
    text_hash = hashlib.md5(text.encode()).hexdigest()[:8]
    timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    return f"tts_{user_id}_{text_hash}_{timestamp}.wav"

def upload_audio_to_supabase(supabase_client, audio_file_path: str, filename: str, user_id: str = "test_user"):
    """Upload audio file to Supabase Storage"""
    try:
        # Create the file path in storage
        file_path = f"tts-audio/{user_id}/{filename}"
        
        print(f"[UPLOAD] Uploading to: {file_path}")
        
        # Read the audio file
        with open(audio_file_path, 'rb') as f:
            audio_data = f.read()
        
        print(f"[DEBUG] Audio file size: {len(audio_data)} bytes")
        
        # Upload to Supabase Storage
        result = supabase_client.storage.from_('user-files').upload(
            path=file_path,
            file=audio_data,
            file_options={"content-type": "audio/wav"}
        )
        
        if result:
            print(f"[SUCCESS] File uploaded successfully")
            
            # Get the public URL
            public_url = supabase_client.storage.from_('user-files').get_public_url(file_path)
            print(f"[SUCCESS] Public URL: {public_url}")
            
            return public_url
        else:
            print("[ERROR] Upload failed - no result returned")
            return None
            
    except Exception as e:
        print(f"[ERROR] Upload failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_tts_with_upload():
    """Test TTS generation and upload to Supabase"""
    print("=== TTS UPLOAD TEST ===")
    
    # Step 1: Debug environment
    supabase_url, supabase_service_key = debug_environment()
    
    if not supabase_url or not supabase_service_key:
        print("[ERROR] Missing environment variables!")
        return None
    
    # Step 2: Test Supabase connection
    supabase_client = test_supabase_connection(supabase_url, supabase_service_key)
    
    if not supabase_client:
        print("[ERROR] Failed to connect to Supabase!")
        return None
    
    # Step 3: Test TTS and upload
    test_text = "Hello! Welcome to your interview. Are you ready to begin?"
    user_id = "test_user"
    
    print(f"\n[TEST] Testing TTS with upload")
    print(f"[TEST] Text: {test_text}")
    
    try:
        # Generate audio file
        print("[STEP 1] Generating audio...")
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        temp_file.close()
        
        file_path = synthesize_text_to_wav(test_text, temp_file.name)
        print(f"[SUCCESS] Audio generated: {file_path}")
        
        # Generate filename
        filename = generate_filename(test_text, user_id)
        print(f"[INFO] Generated filename: {filename}")
        
        # Upload to Supabase
        print("[STEP 2] Uploading to Supabase...")
        public_url = upload_audio_to_supabase(supabase_client, file_path, filename, user_id)
        
        if public_url:
            print(f"[SUCCESS] Complete! Audio URL: {public_url}")
            
            # Test if URL is accessible
            print("[TEST] Testing URL accessibility...")
            response = requests.head(public_url)
            if response.status_code == 200:
                print("[SUCCESS] URL is accessible!")
            else:
                print(f"[WARNING] URL returned status: {response.status_code}")
            
            return public_url
        else:
            print("[ERROR] Upload failed")
            return None
            
    except Exception as e:
        print(f"[ERROR] Test failed: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        # Clean up temporary file
        if 'temp_file' in locals() and os.path.exists(temp_file.name):
            os.unlink(temp_file.name)
            print(f"[CLEANUP] Removed temporary file: {temp_file.name}")

if __name__ == "__main__":
    test_tts_with_upload()
