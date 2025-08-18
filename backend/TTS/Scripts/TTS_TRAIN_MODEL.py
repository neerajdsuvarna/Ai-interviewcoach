#!/usr/bin/env python3

import os
import torch
import torchaudio
import traceback
import time  # Import the time module
from TTS.demos.xtts_ft_demo.utils.formatter import format_audio_list
from TTS.demos.xtts_ft_demo.utils.gpt_train import train_gpt
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import Xtts
import shutil  # Import the shutil module for file copying
import sys
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.append(ROOT_DIR)
from common.GPU_Check import get_device
from common.config import XTTS_MODEL_PATH, AUDIO_SEPARATOR_MODELS_PATH, MODEL_PTH

DEVICE = get_device()
print(f"Using {DEVICE.upper()} for processing.")

def clear_gpu_cache():
    """Clears the GPU cache if using CUDA."""
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


def train_model(train_csv, eval_csv, output_dir, preset):
    """
    Trains the model using train_gpt with the selected preset.
    The max_audio_size is now taken from the preset (in seconds) rather than the audio's duration.
    """
    clear_gpu_cache()
    # Define training settings for each preset (now including max_audio_size in seconds)
    training_settings = {
        "low": {
            "epochs": 50,
            "batch_size": 2,
            "grad_accumulation_steps": 8,
            "max_audio_size": 20,  # 20 seconds
        },
        "medium": {
            "epochs": 100,
            "batch_size": 2,
            "grad_accumulation_steps": 16,
            "max_audio_size": 15,  # 15 seconds
        },
        "high": {
            "epochs": 200,
            "batch_size": 1,
            "grad_accumulation_steps": 32,
            "max_audio_size": 10,  # 10 seconds
        },
    }

    if preset not in training_settings:
        print("Invalid preset. Defaulting to 'low'.")
        preset = "low"
    settings = training_settings[preset]
    # Set max_audio_size using the preset value (in frames)
    max_audio_size = settings["max_audio_size"] * 22050  # 22050 is the sample rate used

    start_time = time.time()  # Record the start time

    try:
        result = train_gpt(
            "en",
            settings["epochs"],
            settings["batch_size"],
            settings["grad_accumulation_steps"],
            train_csv,
            eval_csv,
            output_path=output_dir,
            max_audio_length=max_audio_size
        )

        print("DEBUG: train_gpt() returned:", result)
        # Handle the returned tuple from train_gpt
        if len(result) == 5:
            config_path, model_checkpoint, vocab_file, exp_path, speaker_wav = result
        elif len(result) == 4:
            config_path, model_checkpoint, vocab_file, exp_path = result
            speaker_wav = None
        else:
            raise ValueError(f"Unexpected return values from train_gpt(): {len(result)}")
        # **ADDITION: Copy the vocab_file to the experiment directory**
        dest_vocab_file = os.path.join(exp_path, os.path.basename(vocab_file))  # Construct the destination path
        try:
            shutil.copy2(vocab_file, dest_vocab_file)  # Copy the vocab file, preserving metadata
            print(f"Vocab file copied to: {dest_vocab_file}")
            vocab_file = dest_vocab_file  # Update vocab_file to the new location
        except Exception as e:
            print(f"Error copying vocab file: {e}")

    except Exception as e:
        traceback.print_exc()
        print(f"Training interrupted: {e}")
        return None, None, None

    end_time = time.time()  # Record the end time
    training_duration = end_time - start_time  # Calculate the duration

    # Display the training duration in the desired format
    if training_duration < 3600:
        minutes = int(training_duration // 60)
        seconds = int(training_duration % 60)
        print(f"Training duration: {minutes} minutes and {seconds} seconds")
    else:
        hours = int(training_duration // 3600)
        minutes = int((training_duration % 3600) // 60)
        print(f"Training duration: {hours} hours and {minutes} minutes")

    checkpoint_path = os.path.join(exp_path, "best_model.pth")
    print("Model training completed successfully.")
    return config_path, vocab_file, checkpoint_path

def main():
    try:
        # Get inputs from the user
        audio_path = input("Enter the path to the speaker audio file: ").strip()
        output_dir = input("Enter the output directory: ").strip()
        # Ask for model name and create a dedicated output folder
        model_name = input("Enter the name for the model: ").strip()
        model_output_dir = os.path.join(output_dir, model_name)
        os.makedirs(model_output_dir, exist_ok=True)
        # Preprocess the dataset
        train_csv, eval_csv = preprocess_dataset(audio_path, model_output_dir)
        if not train_csv or not eval_csv:
            print("Failed during dataset processing.")
            return
        # Ask for training preset and validate the input
        while True:
            preset = input("Choose training preset (low/medium/high): ").strip().lower()
            if preset in ["low", "medium", "high"]:
                break
            print("Invalid preset. Please enter 'low', 'medium', or 'high'.")

        # Train the model with the given settings using the preset max audio size
        config_path, vocab_file, checkpoint_path = train_model(
            train_csv, eval_csv, model_output_dir, preset
        )

        if not checkpoint_path:
            print("Failed during model training.")
            return
        print("Training completed successfully.")
    except Exception as e:
        traceback.print_exc()
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    main()
