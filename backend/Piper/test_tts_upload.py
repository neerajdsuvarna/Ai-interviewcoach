from voiceCloner import synthesize_text_to_wav
import os
import requests
from supabase import create_client, Client
from dotenv import load_dotenv
import tempfile
from datetime import datetime
import hashlib

# Load environment variables from root .env file
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"))

# Initialize Supabase client with SERVICE ROLE KEY (bypasses RLS)
supabase_url = os.getenv("SUPABASE_URL")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # Use service role key!

if not supabase_url or not supabase_service_key:
    raise ValueError("Missing Supabase environment variables")

supabase: Client = create_client(supabase_url, supabase_service_key)

def generate_filename(text: str, user_id: str = "test_user"):
    """Generate unique filename for TTS audio"""
    text_hash = hashlib.md5(text.encode()).hexdigest()[:8]
    timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    return f"tts_{user_id}_{text_hash}_{timestamp}.wav"

def upload_audio_to_supabase(audio_file_path: str, filename: str, user_id: str = "test_user"):
    """Upload audio file to Supabase Storage"""
    try:
        # Create the file path in storage
        file_path = f"tts-audio/{user_id}/{filename}"
        
        print(f"[UPLOAD] Uploading to: {file_path}")
        
        # Read the audio file
        with open(audio_file_path, 'rb') as f:
            audio_data = f.read()
        
        # Upload to Supabase Storage using service role key
        result = supabase.storage.from_('user-files').upload(
            path=file_path,
            file=audio_data,
            file_options={"content-type": "audio/wav"}
        )
        
        if result:
            print(f"[SUCCESS] File uploaded successfully")
            
            # Get the public URL
            public_url = supabase.storage.from_('user-files').get_public_url(file_path)
            print(f"[SUCCESS] Public URL: {public_url}")
            
            return public_url
        else:
            print("[ERROR] Upload failed")
            return None
            
    except Exception as e:
        print(f"[ERROR] Upload failed: {e}")
        return None

def test_tts_with_upload():
    """Test TTS generation and upload to Supabase"""
    test_text = "Hello! Welcome to your interview. Are you ready to begin?"
    user_id = "test_user"
    
    print(f"[TEST] Testing TTS with upload")
    print(f"[TEST] Text: {test_text}")
    
    try:
        # Step 1: Generate audio file
        print("[STEP 1] Generating audio...")
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        temp_file.close()
        
        file_path = synthesize_text_to_wav(test_text, temp_file.name)
        print(f"[SUCCESS] Audio generated: {file_path}")
        
        # Step 2: Generate filename
        filename = generate_filename(test_text, user_id)
        print(f"[INFO] Generated filename: {filename}")
        
        # Step 3: Upload to Supabase
        print("[STEP 2] Uploading to Supabase...")
        public_url = upload_audio_to_supabase(file_path, filename, user_id)
        
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
