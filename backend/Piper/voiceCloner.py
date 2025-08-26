# import wave
# from piper import PiperVoice

# voice = PiperVoice.load(r"C:\Users\neera\Downloads\Piper_my\Piper\en_GB-alan-medium.onnx")
# with wave.open("test1.wav", "wb") as wav_file:
#     voice.synthesize_wav("The rapid growth of artificial intelligence over the past decade has reshaped ", wav_file)

import io
import wave
from piper import PiperVoice

MODEL_PATH = r"C:\Users\neera\Downloads\Piper_my\Piper\en_GB-alan-medium.onnx"
voice = PiperVoice.load(MODEL_PATH)

def synthesize_text_to_wav(text: str, output_path: str = "output.wav"):
    with wave.open(output_path, "wb") as wav_file:
        voice.synthesize_wav(text, wav_file)
    return output_path
