import os
import sys
import torch
import torchaudio
import traceback
from TTS.demos.xtts_ft_demo.utils.formatter import format_audio_list
from TTS.demos.xtts_ft_demo.utils.gpt_train import train_gpt
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import Xtts
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.append(ROOT_DIR)
from common.config import XTTS_MODEL_PATH
from common.GPU_Check import get_device


# Define constants
LANGUAGE = "en"
XTTS_MODEL = None  # Global model variable


DEVICE = get_device()
print(f"Using {DEVICE.upper()} for processing.")

def clear_gpu_cache():
    """Clears GPU cache before training or inference."""
    if DEVICE == "cuda":
        torch.cuda.empty_cache()


def preprocess_dataset(audio_path, output_dir):
    """Processes input audio for XTTS training and saves dataset."""
    clear_gpu_cache()

    # Remove potential trailing spaces and quotes from paths
    audio_path = os.path.abspath(audio_path.strip().strip('"'))
    output_dir = os.path.abspath(output_dir.strip().strip('"'))

    dataset_path = os.path.join(output_dir, "dataset")
    os.makedirs(dataset_path, exist_ok=True)

    if not os.path.exists(audio_path):
        print(f"Error: Audio file not found at {audio_path}")
        return None, None

    try:
        # Load audio and check duration
        waveform, sample_rate = torchaudio.load(audio_path)
        duration_seconds = waveform.shape[1] / sample_rate  # Compute duration

        if duration_seconds < 60:
            print(f"Error: The input audio is only {duration_seconds:.2f} seconds long.")
            print("Please provide an audio file that is at least 1 minute (60 seconds) long.")
            return None, None

        train_csv, eval_csv, _ = format_audio_list(
            [audio_path], target_language="en", out_path=dataset_path
        )

    except Exception as e:
        traceback.print_exc()
        print(f"Data processing failed: {e}")
        return None, None

    print("Dataset processing completed.")
    return train_csv, eval_csv



def train_model(train_csv, eval_csv, output_dir):
    """Trains the XTTS model using user-selected training settings."""
    clear_gpu_cache()

    # Prompt user for training level
    while True:
        training_level = input(
            "Choose training setting (easy/medium/high): "
        ).strip().lower()
        if training_level in ["easy", "medium", "high"]:
            break
        print("Invalid choice. Please enter 'easy', 'medium', or 'high'.")

    # Optimized Fine-tuning settings (Adjusted for Memory & Speed)
    training_settings = {
        "easy": {
            "epochs": 10,
            "batch_size": 4,
            "grad_accumulation_steps": 8,
            "max_audio_size": 20,
        },
        "medium": {
            "epochs": 20,
            "batch_size": 2,
            "grad_accumulation_steps": 16,
            "max_audio_size": 15,
        },
        "high": {
            "epochs": 40,
            "batch_size": 1,
            "grad_accumulation_steps": 32,
            "max_audio_size": 20,
        },
    }

    settings = training_settings[training_level]

    try:
        # Debugging: Check return values
        result = train_gpt(
            LANGUAGE,
            settings["epochs"],
            settings["batch_size"],
            settings["grad_accumulation_steps"],
            train_csv,
            eval_csv,
            output_path=output_dir,
            max_audio_length=int(settings["max_audio_size"] * 22050),
        )

        print("DEBUG: train_gpt() returned:", result)  # Debug print

        # Fix "too many values to unpack" error
        if len(result) == 5:
            config_path, model_checkpoint, vocab_file, exp_path, speaker_wav = result
        elif len(result) == 4:
            config_path, model_checkpoint, vocab_file, exp_path = result
            speaker_wav = None  # No speaker_wav returned
        else:
            raise ValueError(
                f"Unexpected return values from train_gpt(): {len(result)}"
            )
    except Exception as e:
        traceback.print_exc()
        print(f"Training interrupted: {e}")
        return None, None, None

    checkpoint_path = os.path.join(exp_path, "best_model.pth")
    print("Model training completed.")
    return config_path, vocab_file, checkpoint_path


def load_model(xtts_checkpoint, xtts_config, xtts_vocab):
    """Loads a trained XTTS model from a checkpoint."""
    global XTTS_MODEL
    clear_gpu_cache()

    if not all(map(os.path.exists, [xtts_checkpoint, xtts_config, xtts_vocab])):
        print("Error: One or more XTTS model files are missing.")
        return False

    config = XttsConfig()
    config.load_json(xtts_config)
    XTTS_MODEL = Xtts.init_from_config(config)
    XTTS_MODEL.load_checkpoint(
        config, checkpoint_path=xtts_checkpoint, vocab_path=xtts_vocab, use_deepspeed=False
    )

    XTTS_MODEL.to(DEVICE)  # Set device priority here
    print(f"Model loaded successfully on {DEVICE.upper()}.")
    return True


def run_tts(audio_path, output_dir, tts_text):
    """Generates speech from text using the trained model."""
    if XTTS_MODEL is None:
        print("Error: Model is not loaded.")
        return

    audio_path = audio_path.strip().strip('"')
    output_dir = output_dir.strip().strip('"')

    if not os.path.exists(audio_path):
        print(f"Error: Speaker audio file not found: {audio_path}")
        return

    gpt_cond_latent, speaker_embedding = XTTS_MODEL.get_conditioning_latents(
        audio_path=audio_path,
        gpt_cond_len=XTTS_MODEL.config.gpt_cond_len,
        max_ref_length=XTTS_MODEL.config.max_ref_len,
        sound_norm_refs=XTTS_MODEL.config.sound_norm_refs,
    )

    out = XTTS_MODEL.inference(
        text=tts_text,
        language=LANGUAGE,
        gpt_cond_latent=gpt_cond_latent,
        speaker_embedding=speaker_embedding,
        temperature=XTTS_MODEL.config.temperature,
        length_penalty=XTTS_MODEL.config.length_penalty,
        repetition_penalty=XTTS_MODEL.config.repetition_penalty,
        top_k=XTTS_MODEL.config.top_k,
        top_p=XTTS_MODEL.config.top_p,
    )

    output_audio_path = os.path.join(output_dir, "output_speech.wav")
    torchaudio.save(
        output_audio_path, torch.tensor(out["wav"]).unsqueeze(0).cpu(), 24000
    )
    print(f"Speech generated and saved at: {output_audio_path}")


# Execute everything in one go
if __name__ == "__main__":
    print("Starting XTTS Processing Pipeline...")

    # Get audio path from the user
    audio_path = input("Enter the path to the speaker audio file: ").strip()
    # Get output directory from the user
    output_dir = input("Enter the path to the output directory: ").strip()

    # Strip quotes *before* calling preprocess_dataset and train_model
    audio_path = audio_path.strip().strip('"')
    output_dir = output_dir.strip().strip('"')

    # Step 1: Process Dataset
    train_csv, eval_csv = preprocess_dataset(audio_path, output_dir)
    if not train_csv or not eval_csv:
        print("Failed at dataset processing.")
        exit(1)

    # Step 2: Train Model
    config_path, vocab_file, checkpoint_path = train_model(
        train_csv, eval_csv, output_dir
    )
    if not checkpoint_path:
        print("Failed at model training.")
        exit(1)

    # Step 3: Load Model
    if not load_model(checkpoint_path, config_path, vocab_file):
        print("Failed at loading model.")
        exit(1)

    # Step 4: Run TTS
    TEXT_TO_CONVERT = "Hey everyone, I am Tom Holland! Hope you're all having an amazing day. I am super excited to share something incredible with you. Let us dive into a world of endless possibilities, stay curious, keep learning, and most importantly, have fun!"
    run_tts(audio_path, output_dir, TEXT_TO_CONVERT)

    print("All steps completed successfully.")
