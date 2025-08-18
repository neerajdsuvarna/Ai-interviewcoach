import os
import sys
import gdown
from pathlib import Path
from typing import List, Dict

# Determine root directory (same folder as this script)
ROOT_DIR = Path(__file__).resolve().parent

# Files 
FILES_TO_DOWNLOAD: List[Dict[str, Path]] = [
    # Audio-separator models
    {"id": "1BFwar3igCdGVTeRBw5sWjwIvFGHFTqs6", "output": ROOT_DIR / "common/audio-separator-models/Kim_Vocal_2.onnx"},
    {"id": "1SpOJkQ2JcSKxAUWhHNUO9nwzPmYc3Cg_", "output": ROOT_DIR / "common/audio-separator-models/model_mel_band_roformer_ep_3005_sdr_11.4360.ckpt"},
    {"id": "1K8DTst1uAEA27iOEoP7SdWtkptmYDUrm", "output": ROOT_DIR / "common/audio-separator-models/download_checks.json"},
    {"id": "1TQ6RKr-ownfOtwLK382A6hLx4qmaqzuv", "output": ROOT_DIR / "common/audio-separator-models/mdx_model_data.json"},
    {"id": "1EYS-5ohzXWLyjwLv1F8toxuPylQ6Lc1S", "output": ROOT_DIR / "common/audio-separator-models/model_mel_band_roformer_ep_3005_sdr_11.4360.yaml"},
    {"id": "1Sfo2smJCZ9uwOTuB_TfiEwQqyJnY7NuQ", "output": ROOT_DIR / "common/audio-separator-models/vr_model_data.json"},

    # XTTS model files
    {"id": "1BOSPjpoSqnke3EHjhSm2LPULNlLMSlAe", "output": ROOT_DIR / "common/XTTS_MODEL/dvae.pth"},
    {"id": "1ePvCIyHHtBLWl4PTwLRNjfVobF1F7pKe", "output": ROOT_DIR / "common/XTTS_MODEL/model.pth"},
    {"id": "1hJ6MsP9BUw47Li9M-Rh-iTHyh05wzLZq", "output": ROOT_DIR / "common/XTTS_MODEL/config.json"},
    {"id": "1rDo6ye8G9Yi2MTvCBnzhBmm-Ad4krA15", "output": ROOT_DIR / "common/XTTS_MODEL/mel_stats.pth"},
    {"id": "1aMuyCDc5NSCt0uPzIRd2j5_V9R5lFUZn", "output": ROOT_DIR / "common/XTTS_MODEL/vocab.json"},

    # Audio2Head model
    {"id": "1dFrymgYa3cimbezFgrFNf7qV1Aiz22Xj", "output": ROOT_DIR / "common/checkpoints_A2H/audio2head.pth.tar"},
]

def ensure_dirs():
    for file in FILES_TO_DOWNLOAD:
        os.makedirs(file["output"].parent, exist_ok=True)

def download_models(force=False):
    skipped, downloaded, failed = 0, 0, 0

    for file in FILES_TO_DOWNLOAD:
        output_path = file["output"]
        file_id = file["id"]

        if output_path.exists() and not force:
            print(f"[SKIP] Already exists: {output_path}")
            skipped += 1
            continue

        try:
            print(f"[DOWNLOADING] {output_path}...")
            gdown.download(id=file_id, output=str(output_path), quiet=False)
            print(f"[SUCCESS] Downloaded: {output_path}")
            downloaded += 1
        except Exception as e:
            print(f"[ERROR] Failed to download {output_path}: {e}")
            failed += 1

    return skipped, downloaded, failed


if __name__ == "__main__":
    force_download = "--force" in sys.argv
    ensure_dirs()

    # Download individual files
    skipped, downloaded, failed = download_models(force=force_download)

    # Print unified summary
    print("\n" + "=" * 40)
    print("Download Summary:")
    print(f"[FILES] Skipped   : {skipped}")
    print(f"[FILES] Downloaded: {downloaded}")
    print(f"[FILES] Failed    : {failed}")
    print("=" * 40)
