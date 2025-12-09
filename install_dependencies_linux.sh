#!/bin/bash

set -e  # Exit immediately if a command exits with a non-zero status
export DEBIAN_FRONTEND=noninteractive

echo
echo "============================================"
echo "[SECTION] Updating pip"
echo "============================================"
python3 -m pip install --upgrade pip

echo
echo "============================================"
echo "[SECTION] Installing PyTorch with CUDA Support"
echo "============================================"
echo "[INFO] Installing CUDA-enabled PyTorch (defaulting to CUDA 12.x)"
echo
echo "============================================"
echo "[SECTION] Installing PyTorch (CUDA 12.x)"
echo "============================================"
pip3 install torch==2.5.1 torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip3 install faster-whisper
pip3 install onnxruntime-gpu

# echo
# echo "============================================"
# echo "[SECTION] Installing LIPSYNC"
# echo "============================================"
# pip3 install lipsync

# echo
# echo "============================================"
# echo "[SECTION] Installing TTS Additional Dependencies"
# echo "============================================"
# pip3 install pyyaml
# pip3 install regex
# pip3 install einops
# pip3 install spacy
# pip3 install trainer
# pip3 install matplotlib

# echo
# echo "============================================"
# echo "[SECTION] Installing TTS Local Package in Editable Mode"
# echo "============================================"
# cd "$(dirname "$0")/backend/TTS"
# pip3 install --no-deps -e .
# cd "$(dirname "$0")"

# echo
# echo "============================================"
# echo "[SECTION] Installing Specific Packages (No Dependencies)"
# echo "============================================"
# pip3 install --no-deps tokenizers==0.15.2 transformers==4.36.2

# echo
# echo "============================================"
# echo "[SECTION] Installing More TTS Dependencies"
# echo "============================================"
# pip3 install pandas
# pip3 install safetensors
# pip3 install pypinyin
# pip3 install hangul-Romanize
# pip3 install num2words
# pip3 install mutagen

# echo
# echo "============================================"
# echo "[SECTION] Installing UVR Dependencies"
# echo "============================================"
# pip3 install pydub
# pip3 install ml_collections  
# pip3 install beartype
# pip3 install rotary-embedding-torch

echo
echo "============================================"
echo "[SECTION] Installing Flask + Backend Dependencies"
echo "============================================"
pip3 install Flask Flask-Bcrypt Flask-Login Flask-Migrate Flask-SQLAlchemy Flask-WTF WTForms bcrypt email-validator itsdangerous Mako mediapipe ml_dtypes opt_einsum sentencepiece sounddevice
#for vast
#sudo python3.10 -m pip install --ignore-installed Flask Flask-Bcrypt Flask-Login Flask-Migrate Flask-SQLAlchemy Flask-WTF WTForms bcrypt email-validator itsdangerous Mako mediapipe ml_dtypes opt_einsum sentencepiece sounddevice
pip3 install flask_socketio
pip3 install flask-cors
pip3 install Flask-Session

echo
echo "============================================"
echo "[SECTION] Installing System Build Dependencies (for PyAudio)"
echo "============================================"
if command -v apt-get &> /dev/null; then
    echo "[INFO] Using apt-get to install build tools and PortAudio headers..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y build-essential portaudio19-dev python3-dev
    pip3 install PyAudio
else
    echo "[WARNING] apt-get not found — skipping system dependency installation. Install manually if PyAudio fails."
fi

echo
echo "============================================"
echo "[SECTION] Installing cuDNN 9.8 for CUDA 12"
echo "============================================"

apt-get install -y wget gnupg software-properties-common

# 🧹 Clean up duplicate CUDA repositories (prevents conflicts)
rm -f /etc/apt/sources.list.d/archive_uri-https_developer_download_nvidia_com_compute_cuda_repos_ubuntu2204_x86_64_-jammy.list
grep -rl 'developer.download.nvidia.com' /etc/apt/sources.list.d/ | xargs rm -f || true

wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-ubuntu2204.pin
mv cuda-ubuntu2204.pin /etc/apt/preferences.d/cuda-repository-pin-600

apt-key adv --fetch-keys https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/3bf863cc.pub

add-apt-repository "deb https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/ /"

apt-get update

# ✅ Allow held package updates (previous error fix)
apt-get --allow-change-held-packages install -y libcudnn9-cuda-12 libcudnn9-dev-cuda-12



echo
echo "============================================"
echo "[SECTION] Installing STT"
echo "============================================"
pip3 install RealtimeSTT

echo
echo "============================================"
echo "[SECTION] Installing Ollama Binary"
echo "============================================"

if ! command -v ollama &> /dev/null; then
    echo "[INFO] Ollama not found. Installing Ollama CLI..."
    curl -fsSL https://ollama.com/install.sh | sh
else
    echo "[INFO] Ollama CLI already installed."
fi


echo
echo "============================================"
echo "[SECTION] Installing Ollama and Checking Server"
echo "============================================"

echo "[INFO] Pulling llama3 model if server is running..."
if command -v ollama &> /dev/null; then
    # Try to start Ollama in background if not active
    if ! pgrep -x "ollama" > /dev/null; then
        echo "[INFO] Starting Ollama server in background..."
        nohup ollama serve > /dev/null 2>&1 &
        sleep 10
    fi

    # Try to pull llama3 safely (don’t crash if it fails)
    if ollama pull llama3; then
        echo "[DONE] Llama3 model pulled successfully."
    else
        echo "[WARNING] Ollama server not ready — skipping model pull."
    fi
else
    echo "[WARNING] Ollama CLI not found — skipping model pull."
fi

pip3 install ollama

echo
echo "============================================"
echo "[SECTION] Installing .env Support (python-dotenv)"
echo "============================================"
pip3 install python-dotenv

echo
echo "=============================="
echo "[INFO] Fixing textract install"
echo "=============================="
python3 -m pip install "pip<24.1"
pip3 install textract
python3 -m pip install --upgrade pip

echo
echo "========================================="
echo "[INFO] Installing Interview Dependencies"
echo "========================================="
pip3 install tiktoken

echo
echo "============================================"
echo "[SECTION] Installing Document Processing and TTS Dependencies"
echo "============================================"
pip3 install python-docx
pip3 install PyPDF2  
pip3 install supabase
pip3 install piper-tts
pip3 install pydub
pip3 install sentence-transformers
pip3 install faiss-cpu

echo
echo "============================================"
echo "[SECTION] Installing Node.js 20.x and Frontend Dependencies"
echo "============================================"
echo "[INFO] Installing Node.js 20.x (LTS) via NodeSource..."

export DEBIAN_FRONTEND=noninteractive

# Install curl if missing
if ! command -v curl &> /dev/null; then
    echo "[INFO] Installing curl..."
    apt-get update -y && apt-get install -y curl
fi

# Remove any existing Node.js/npm to avoid conflicts
echo "[INFO] Removing any existing Node.js/npm installations..."
apt remove -y nodejs npm 2>/dev/null || true

# Install Node.js 20.x (LTS) - this includes npm
echo "[INFO] Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "[INFO] Node.js version: $(node -v)"
echo "[INFO] npm version: $(npm -v)"

# echo "[INFO] Installing frontend dependencies..."
# cd "$(dirname "$0")/frontend"
# npm install --legacy-peer-deps
# cd "$(dirname "$0")"

sudo apt install -y libgl1 libglib2.0-0
sudo apt install -y ffmpeg
sudo apt install nano
echo
echo "============================================"
echo "[DONE] Installation Complete"
echo "============================================"
