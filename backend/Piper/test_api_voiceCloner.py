from voiceCloner import synthesize_text_to_wav

file_path = synthesize_text_to_wav("Hello, this is without Flask API.")
print("Audio saved at:", file_path)
