import torch
import torchaudio
import traceback
import time
import sys
import os
import glob
import shutil

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.append(ROOT_DIR)

from common.GPU_Check import get_device
from common.config import UVR_PATH
from TTS.demos.xtts_ft_demo.utils.formatter import format_audio_list
from TTS.demos.xtts_ft_demo.utils.gpt_train import train_gpt

# Ensure UVR is in sys.path
if UVR_PATH not in sys.path:
    sys.path.append(UVR_PATH)
from audio_enhancer import process_audio
DEVICE = get_device()
print(f"Using {DEVICE.upper()} for processing.")

def clear_gpu_cache():
    if DEVICE == "cuda":
        torch.cuda.empty_cache()

# -------------------------------
# Audio Enhancement
# -------------------------------
def process_audio_file(noisy_audio_path, output_dir):
    """
    Enhances the given noisy audio file using the UVR model and saves the cleaned version.
    """
    noisy_audio_path = noisy_audio_path.strip().strip('"')
    base_name = os.path.splitext(os.path.basename(noisy_audio_path))[0]
    pattern = os.path.join(output_dir, f"{base_name}_*enhanced*.wav")
    existing_files = glob.glob(pattern)

    if existing_files:
        print("Enhanced file already exists, skipping processing.")
        return existing_files[0]

    enhanced_file = process_audio(
        audio_file=noisy_audio_path,
        output_dir=output_dir,
        single_stem="Vocals",
    )
    return enhanced_file

# -------------------------------
# Dataset Preprocessing
# -------------------------------
def preprocess_dataset(audio_path, output_dir):
    """
    Prepares the dataset for XTTS training using the enhanced audio file.
    """
    clear_gpu_cache()
    audio_path = os.path.abspath(audio_path.strip().strip('"'))
    output_dir = os.path.abspath(output_dir.strip().strip('"'))
    
    dataset_path = os.path.join(output_dir, "dataset")
    os.makedirs(dataset_path, exist_ok=True)

    if not os.path.exists(audio_path):
        print(f" Error: Audio file not found at {audio_path}")
        return None, None

    try:
        waveform, sample_rate = torchaudio.load(audio_path)
        duration_seconds = waveform.shape[1] / sample_rate

        if duration_seconds < 50:
            print(f" Error: Audio too short ({duration_seconds:.2f} seconds). Minimum required: 60 seconds.")
            return None, None

        train_csv, eval_csv, _ = format_audio_list(
            [audio_path], target_language="en", out_path=dataset_path
        )

    except Exception as e:
        traceback.print_exc()
        print(f" Data processing failed: {e}")
        return None, None

    print(" Dataset processing completed.")
    return train_csv, eval_csv

# -------------------------------
# Model Training
# -------------------------------
import shutil
import os
import time
import traceback

def train_model(train_csv, eval_csv, output_dir):
    """
    Trains the XTTS model using a fixed configuration.
    Ensures that all required files (config, checkpoint, vocab) are correctly saved.
    """
    clear_gpu_cache()

    #  Fixed Training Configuration
    training_settings = {
        "epochs":10 ,  # Adjust as needed
        "batch_size": 2,
        "grad_accumulation_steps": 16,
        "max_audio_size": 15,  # in seconds
    }
    
    max_audio_size = training_settings["max_audio_size"] * 22050  # Convert to frames

    start_time = time.time()
    try:
        # Start training
        result = train_gpt(
            "en",
            training_settings["epochs"],
            training_settings["batch_size"],
            training_settings["grad_accumulation_steps"],
            train_csv,
            eval_csv,
            output_path=output_dir,
            max_audio_length=max_audio_size
        )

        print("DEBUG: train_gpt() returned:", result)

        # Ensure the result contains expected values
        if len(result) == 5:
            config_path, model_checkpoint, vocab_file, exp_path, speaker_wav = result
        elif len(result) == 4:
            config_path, model_checkpoint, vocab_file, exp_path = result
            speaker_wav = None
        else:
            raise ValueError(f"Unexpected return values from train_gpt(): {len(result)}")

        #  Define the correct paths
        checkpoint_path = os.path.join(exp_path, "checkpoint.pth")  # Expected checkpoint file
        best_model_path = os.path.join(exp_path, "best_model.pth")  # Best trained model
        config_path = os.path.join(exp_path, "config.json")  # Config file
        vocab_path = os.path.join(exp_path, "vocab.json")  # Vocab file

        #  Copy the model checkpoint if it's missing
        if not os.path.exists(checkpoint_path):
            print(f" WARNING: checkpoint.pth missing. Copying from best_model.pth...")
            shutil.copy2(best_model_path, checkpoint_path)

        #  Copy vocab file to the experiment directory
        dest_vocab_file = os.path.join(exp_path, os.path.basename(vocab_file))
        shutil.copy2(vocab_file, dest_vocab_file)
        vocab_file = dest_vocab_file

        #  Verify that all required model files exist
        missing_files = [f for f in [checkpoint_path, best_model_path, config_path, vocab_path] if not os.path.exists(f)]
        if missing_files:
            print(f" ERROR: Missing model files after training: {missing_files}")
            return None, None, None

        print(f" Model training complete. All files saved successfully.")

    except Exception as e:
        traceback.print_exc()
        print(f" Training interrupted: {e}")
        return None, None, None

    #  Compute Training Time
    end_time = time.time()
    training_duration = end_time - start_time
    minutes = int(training_duration // 60)
    seconds = int(training_duration % 60)
    print(f" Training completed in {minutes} minutes and {seconds} seconds.")

    for fpath in glob.glob(os.path.join(exp_path, "best_model*.pth")):
        try:
            os.remove(fpath)
            print(f"[CLEANUP] Deleted: {fpath}")
        except Exception as cleanup_err:
            print(f"[WARNING] Could not delete {fpath}: {cleanup_err}")
    #  DELETE: Remove dataset folder
    dataset_path = os.path.join(output_dir, "dataset")
    if os.path.exists(dataset_path):
        try:
            shutil.rmtree(dataset_path)
            print(f"[CLEANUP] Deleted dataset folder: {dataset_path}")
        except Exception as dataset_err:
            print(f"[WARNING] Could not delete dataset folder: {dataset_err}")
# Return the retained checkpoint instead of the deleted best_model
    return config_path, vocab_file, checkpoint_path

# -------------------------------
# Main Processing Pipeline
# -------------------------------
def main(noisy_audio_path, output_dir, model_name):
    """
    Full pipeline for audio enhancement and training.
    """
    print(f" DEBUG: Starting UVR_TTS with parameters:")
    print(f" Noisy Audio Path: {noisy_audio_path}")
    print(f" Output Directory: {output_dir}")
    print(f" Model Name: {model_name}")

    model_output_dir = os.path.join(output_dir, model_name)
    os.makedirs(model_output_dir, exist_ok=True)

    # Step 1: Enhance the noisy audio
    print(" Enhancing audio...")
    enhanced_audio = process_audio_file(noisy_audio_path, output_dir)
    if not enhanced_audio:
        print(" Audio enhancement failed. Exiting.")
        return

    print(f" Enhanced audio saved at: {enhanced_audio}")

    # Step 2: Preprocess dataset
    train_csv, eval_csv = preprocess_dataset(enhanced_audio, model_output_dir)
    if not train_csv or not eval_csv:
        print(" Dataset processing failed. Exiting.")
        return

    # Step 3: Train the model
    config_path, vocab_file, checkpoint_path = train_model(train_csv, eval_csv, model_output_dir)
    if not checkpoint_path:
        print(" Model training failed. Exiting.")
        return

    print(f" Model trained and ready at {model_output_dir}")

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(" Error: Missing arguments.")
        print("Usage: python UVR_TTS.py <noisy_audio_path> <output_dir> <model_name>")
        sys.exit(1)

    noisy_audio_path = sys.argv[1]
    output_dir = sys.argv[2]
    model_name = sys.argv[3]

    main(noisy_audio_path, output_dir, model_name)  #  Call main() with parameters
