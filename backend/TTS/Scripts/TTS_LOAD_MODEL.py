#!/usr/bin/env python3
import os
import sys
import torch
import torchaudio
import numpy as np
import argparse
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import Xtts
import uuid
import contextlib
import io

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.append(ROOT_DIR)
from common.GPU_Check import get_device

DEVICE = get_device()
print(f"Using {DEVICE.upper()} for processing.")

SAMPLE_RATE = 24000
CROSSFADE_SECONDS = 0.1  
CROSSFADE_SAMPLES = int(CROSSFADE_SECONDS * SAMPLE_RATE)

def clear_gpu_cache():
    if DEVICE == "cuda":
        torch.cuda.empty_cache()

# Global model variable
XTTS_MODEL = None

def split_text_fixed(text, max_chars=250):
    """
    Splits the input text into segments of approximately max_chars characters.
    Ensures natural breaks at punctuation or spaces.
    """
    segments = []
    start = 0
    text = text.strip()
    while start < len(text):
        if len(text) - start <= max_chars:
            segments.append(text[start:].strip())
            break
        end = text.rfind('.', start, start + max_chars)
        if end == -1:
            end = text.rfind('!', start, start + max_chars)
        if end == -1:
            end = text.rfind('?', start, start + max_chars)
        if end == -1:
            end = text.rfind(' ', start, start + max_chars)
        if end == -1 or end <= start:
            end = start + max_chars
        else:
            end += 1  
        segment = text[start:end].strip()
        segments.append(segment)
        start = end

    print("Split text into segments:")
    for idx, seg in enumerate(segments, start=1):
        print(f"Segment {idx} ({len(seg)} chars): {seg[:60]}{'...' if len(seg) > 60 else ''}")
    return segments

def crossfade_concat(audio_segments, crossfade_samples=CROSSFADE_SAMPLES):
    """
    Concatenates a list of audio segments using linear crossfade
    to create smooth transitions.
    """
    if not audio_segments:
        return None
    final_audio = audio_segments[0]
    for seg in audio_segments[1:]:
        overlap = min(crossfade_samples, len(final_audio), len(seg))
        if overlap <= 0:
            final_audio = np.concatenate([final_audio, seg])
        else:
            fade_out = np.linspace(1, 0, overlap)
            fade_in = np.linspace(0, 1, overlap)
            final_audio[-overlap:] = final_audio[-overlap:] * fade_out + seg[:overlap] * fade_in
            final_audio = np.concatenate([final_audio, seg[overlap:]])
    return final_audio

def load_model(xtts_checkpoint, xtts_config, xtts_vocab):
    """
    Loads the XTTS model using the provided checkpoint, config, and vocab files.
    """
    global XTTS_MODEL
    clear_gpu_cache()
    
    if not all(os.path.exists(x) for x in [xtts_checkpoint, xtts_config, xtts_vocab]):
        print(f" ERROR: One or more XTTS model files are missing:\n- {xtts_checkpoint}\n- {xtts_config}\n- {xtts_vocab}")
        return False

    try:
        config = XttsConfig()
        config.load_json(xtts_config)
        XTTS_MODEL = Xtts.init_from_config(config)
        XTTS_MODEL.load_checkpoint(
            config, checkpoint_path=xtts_checkpoint, vocab_path=xtts_vocab, use_deepspeed=False
        )
        XTTS_MODEL.to(DEVICE)
        print(f" Model loaded successfully from {xtts_checkpoint}")
        return True
    except Exception as e:
        print(f" ERROR: Failed to load XTTS model: {e}")
        return False


def _run_tts_core(speaker_audio_file, output_dir, tts_text, max_chars=250):
    """
    Converts input text to speech and saves output dynamically.
    """
    if XTTS_MODEL is None:
        print(" Error: Model is not loaded.")
        return None  # Return None if model fails

    speaker_audio_file = speaker_audio_file.strip().strip('"')
    output_dir = output_dir.strip().strip('"')

    if not os.path.exists(speaker_audio_file):
        print(f" Error: Speaker audio file not found: {speaker_audio_file}")
        return None

    try:
        # Generate unique filename for each response
        unique_filename = f"response_audio_{uuid.uuid4().hex[:8]}.wav"
        output_audio_path = os.path.join(output_dir, unique_filename)

        # Generate speech and save it
        gpt_cond_latent, speaker_embedding = XTTS_MODEL.get_conditioning_latents(
            audio_path=speaker_audio_file,
            gpt_cond_len=XTTS_MODEL.config.gpt_cond_len,
            max_ref_length=XTTS_MODEL.config.max_ref_len,
            sound_norm_refs=XTTS_MODEL.config.sound_norm_refs,
        )

        segments = split_text_fixed(tts_text, max_chars=max_chars)
        audio_segments = []

        for i, segment in enumerate(segments):
            print(f" Processing segment {i+1}/{len(segments)}: '{segment}'")
            try:
                out = XTTS_MODEL.inference(
                    text=segment,
                    language="en",
                    gpt_cond_latent=gpt_cond_latent,
                    speaker_embedding=speaker_embedding,
                    temperature=XTTS_MODEL.config.temperature,
                    length_penalty=XTTS_MODEL.config.length_penalty,
                    repetition_penalty=XTTS_MODEL.config.repetition_penalty,
                    top_k=XTTS_MODEL.config.top_k,
                    top_p=XTTS_MODEL.config.top_p,
                )
                audio_segments.append(np.array(out["wav"]))
            except Exception as e:
                print(f" Error processing segment {i+1}: {e}")
                continue

        # If no audio was generated, return None
        if not audio_segments:
            print(" No valid speech segments generated.")
            return None

        # Save the final speech output
        final_audio = crossfade_concat(audio_segments, crossfade_samples=CROSSFADE_SAMPLES)
        torchaudio.save(output_audio_path, torch.tensor(final_audio).unsqueeze(0).cpu(), SAMPLE_RATE)

        print(f" Speech generated and saved at: {output_audio_path}")
        return output_audio_path  # Return the filename for further processing

    except Exception as e:
        print(f" Error during inference: {e}")
        return None

def run_tts(speaker_audio_file, output_dir, tts_text, max_chars=250, suppress_output=True):
    """
    Converts input text to speech and saves output dynamically.
    Optionally suppresses stdout/stderr during inference.
    """
    if suppress_output:
        buffer = io.StringIO()
        with contextlib.redirect_stdout(buffer), contextlib.redirect_stderr(buffer):
            return _run_tts_core(speaker_audio_file, output_dir, tts_text, max_chars)
    else:
        return _run_tts_core(speaker_audio_file, output_dir, tts_text, max_chars)
    
def main():
    parser = argparse.ArgumentParser(description="Run TTS model for speech synthesis.")
    parser.add_argument("--model_dir", type=str, required=True, help="Path to trained TTS model.")
    parser.add_argument("--speaker_audio", type=str, required=True, help="Path to enhanced speaker audio file.")
    parser.add_argument("--text", type=str, required=True, help="Text to convert to speech.")
    parser.add_argument("--output_dir", type=str, required=True, help="Output directory for generated speech files.")
    parser.add_argument("--counter", type=int, default=1, help="File counter for output naming.")

    args = parser.parse_args()

    checkpoint_path = os.path.join(args.model_dir, "checkpoint.pth")
    config_path = os.path.join(args.model_dir, "config.json")
    vocab_path = os.path.join(args.model_dir, "vocab.json")

    if not load_model(checkpoint_path, config_path, vocab_path):
        sys.exit(1)

    run_tts(args.speaker_audio, args.output_dir, args.text)

if __name__ == "__main__":
    main()
