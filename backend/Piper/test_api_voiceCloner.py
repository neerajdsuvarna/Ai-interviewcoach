from voiceCloner import synthesize_text_to_wav
import os

def test_piper_core():
    """Test basic Piper TTS functionality"""
    test_text = "Hello! Welcome to your interview. Are you ready to begin?"
    
    print(f"[TEST] Testing Piper TTS with text: {test_text}")
    
    try:
        # Test basic synthesis
        file_path = synthesize_text_to_wav(test_text, "test_output.wav")
        print(f"[SUCCESS] Audio saved at: {file_path}")
        
        # Check if file exists and has content
        if os.path.exists(file_path):
            file_size = os.path.getsize(file_path)
            print(f"[SUCCESS] File size: {file_size} bytes")
            
            if file_size > 0:
                print("[SUCCESS] Piper TTS is working correctly!")
                return True
            else:
                print("[ERROR] Generated file is empty")
                return False
        else:
            print("[ERROR] File was not created")
            return False
            
    except Exception as e:
        print(f"[ERROR] Piper test failed: {e}")
        return False

if __name__ == "__main__":
    test_piper_core()
