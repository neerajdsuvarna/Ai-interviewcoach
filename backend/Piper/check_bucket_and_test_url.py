from voiceCloner import synthesize_text_to_wav
import os
import requests
from supabase import create_client, Client
from dotenv import load_dotenv
import tempfile
from datetime import datetime
import hashlib

# Load environment variables from backend .env file
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
load_dotenv(dotenv_path=env_path)

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supabase_url, supabase_service_key)

def list_bucket_contents(bucket_name="user-files", folder_path="tts-audio"):
    """List all files in the specified bucket and folder"""
    print(f"\n=== BUCKET CONTENTS: {bucket_name}/{folder_path} ===")
    
    try:
        # List all files in the bucket
        result = supabase.storage.from_(bucket_name).list(path=folder_path)
        
        if result:
            print(f"[SUCCESS] Found {len(result)} files in {bucket_name}/{folder_path}")
            for file_info in result:
                print(f"[FILE] {file_info['name']} - Size: {file_info.get('metadata', {}).get('size', 'Unknown')} bytes")
                print(f"       Created: {file_info.get('created_at', 'Unknown')}")
                print(f"       Updated: {file_info.get('updated_at', 'Unknown')}")
                print()
        else:
            print(f"[INFO] No files found in {bucket_name}/{folder_path}")
            
        return result
        
    except Exception as e:
        print(f"[ERROR] Failed to list bucket contents: {e}")
        return None

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
        
        print(f"[DEBUG] Audio file size: {len(audio_data)} bytes")
        
        # Upload to Supabase Storage
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
            print("[ERROR] Upload failed - no result returned")
            return None
            
    except Exception as e:
        print(f"[ERROR] Upload failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_audio_url(url):
    """Test if the audio URL is accessible and playable"""
    print(f"\n=== TESTING AUDIO URL ===")
    print(f"[URL] {url}")
    
    try:
        # Test if URL is accessible
        response = requests.head(url)
        print(f"[HTTP] Status: {response.status_code}")
        print(f"[HTTP] Content-Type: {response.headers.get('content-type', 'Unknown')}")
        print(f"[HTTP] Content-Length: {response.headers.get('content-length', 'Unknown')}")
        
        if response.status_code == 200:
            print("[SUCCESS] URL is accessible!")
            
            # Test with GET request to see if we can download the file
            get_response = requests.get(url, stream=True)
            if get_response.status_code == 200:
                print(f"[SUCCESS] File can be downloaded! Size: {len(get_response.content)} bytes")
                return True
            else:
                print(f"[WARNING] GET request failed: {get_response.status_code}")
                return False
        else:
            print(f"[ERROR] URL not accessible: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"[ERROR] URL test failed: {e}")
        return False

def create_and_test_audio():
    """Create a new audio file and test the complete flow"""
    print("=== CREATE AND TEST AUDIO ===")
    
    test_text = "Hello! This is a test audio file. Can you hear this clearly?"
    user_id = "test_user"
    
    print(f"[TEST] Text: {test_text}")
    
    try:
        # Step 1: Generate audio file
        print("\n[STEP 1] Generating audio...")
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        temp_file.close()
        
        file_path = synthesize_text_to_wav(test_text, temp_file.name)
        print(f"[SUCCESS] Audio generated: {file_path}")
        
        # Step 2: Generate filename
        filename = generate_filename(test_text, user_id)
        print(f"[INFO] Generated filename: {filename}")
        
        # Step 3: Upload to Supabase
        print("\n[STEP 2] Uploading to Supabase...")
        public_url = upload_audio_to_supabase(file_path, filename, user_id)
        
        if public_url:
            print(f"\n[SUCCESS] Complete! Audio URL: {public_url}")
            
            # Step 4: Test the URL
            url_works = test_audio_url(public_url)
            
            if url_works:
                print("\n🎉 SUCCESS! Your audio file is:")
                print(f"✅ Generated: {file_path}")
                print(f"✅ Uploaded to Supabase")
                print(f"✅ Accessible via URL: {public_url}")
                print(f"✅ Ready to play in browser!")
                
                print(f"\n📁 Local file preserved at: {file_path}")
                print("💡 You can now open the URL in your browser to test the audio!")
                
            return public_url, file_path
        else:
            print("[ERROR] Upload failed")
            return None, file_path
            
    except Exception as e:
        print(f"[ERROR] Test failed: {e}")
        import traceback
        traceback.print_exc()
        return None, None

if __name__ == "__main__":
    # First, check existing bucket contents
    list_bucket_contents()
    
    # Then create and test a new audio file
    url, local_file = create_and_test_audio()
    
    if url:
        print(f"\n�� To test the audio, open this URL in your browser:")
        print(f"🔗 {url}")
        print(f"\n📁 Local file saved at: {local_file}")
        print("💡 The local file is NOT deleted so you can compare it with the uploaded version!")
