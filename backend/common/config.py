import os

# Base directory (project root)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# UVR and XTTS paths
UVR_PATH = os.path.join(BASE_DIR, "UVR")
XTTS_MODEL_PATH = os.path.join(BASE_DIR, "common", "XTTS_MODEL")
AUDIO_SEPARATOR_MODELS_PATH = os.path.join(BASE_DIR, "common", "audio-separator-models")

# XTTS Model Files
MODEL_PTH = os.path.join(XTTS_MODEL_PATH, "model.pth")
DVAE_PTH = os.path.join(XTTS_MODEL_PATH, "dvae.pth")
MEL_STATS_PTH = os.path.join(XTTS_MODEL_PATH, "mel_stats.pth")
CONFIG_JSON = os.path.join(XTTS_MODEL_PATH, "config.json")
VOCAB_JSON = os.path.join(XTTS_MODEL_PATH, "vocab.json")

# UVR Model Files
UVR_MODEL_FILES = [
    "model_mel_band_roformer_ep_3005_sdr_11.4360.ckpt",  # Example UVR model
]
UVR_MODEL_PATHS = [os.path.join(AUDIO_SEPARATOR_MODELS_PATH, model) for model in UVR_MODEL_FILES]

# Function to verify paths
def verify_paths():
    missing_files = []

    # Check XTTS Model files
    xtts_files = [MODEL_PTH, DVAE_PTH, MEL_STATS_PTH, CONFIG_JSON, VOCAB_JSON]
    missing_xtts = [f for f in xtts_files if not os.path.exists(f)]
    if missing_xtts:
        print(f" Missing XTTS model files: {missing_xtts}")
        missing_files.extend(missing_xtts)
    else:
        print(" All XTTS model files are present.")

    # Check UVR model files
    missing_uvr = [f for f in UVR_MODEL_PATHS if not os.path.exists(f)]
    if missing_uvr:
        print(f" Missing UVR model files: {missing_uvr}")
        missing_files.extend(missing_uvr)
    else:
        print(" All UVR model files are present.")

    # Final check
    if missing_files:
        print("\n WARNING: Some required files are missing! Please place them in the correct directories.")
    else:
        print("\n All required model files for XTTS and UVR are present.")

# Run verification on import
verify_paths()
