#!/bin/bash

set -ex  # Exit immediately if a command exits with a non-zero status

if ! dpkg -s build-essential &>/dev/null; then
    echo "[WARNING] build-essential not found. Installing..."
    sudo apt-get update
    sudo apt-get install -y build-essential
    echo "[INFO] build-essential installed successfully."
else
    echo "[OK] build-essential already installed."
fi
echo
echo "============================================"
echo "[SECTION] Installing CLI tools: curl, tmux, nano, lsof"
echo "============================================"
sudo apt-get install -y curl tmux nano lsof

echo
echo "============================================"
echo "[SECTION] Updating pip3"
echo "============================================"
python3 -m pip install --upgrade pip

echo
echo "============================================"
echo "[SECTION] Checking for CUDA availability"
echo "============================================"

if command -v nvidia-smi &> /dev/null; then
    echo "[INFO] NVIDIA GPU detected. Installing PyTorch with CUDA 12 support."
    pip3 install torch==2.5.1 torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
    pip3 install faster-whisper
    pip3 install onnxruntime-gpu
else
    echo "[WARNING] No NVIDIA GPU detected. Installing CPU-only PyTorch."
    pip3 install torch==2.5.1 torchvision torchaudio
    pip3 install faster-whisper
    pip3 install onnxruntime
fi





echo
echo "============================================"
echo "[SECTION] Installing LIPSYNC"
echo "============================================"
pip3 install lipsync

echo
echo "============================================"
echo "[SECTION] Installing TTS Additional Dependencies"
echo "============================================"
pip3 install pyyaml regex einops spacy trainer matplotlib



echo
echo "============================================"
echo "[SECTION] Installing TTS Local Package (Editable Mode)"
echo "============================================"
# Safety check: make sure setup.py exists


cd backend/TTS
pip3 install --no-deps -e .
cd ..

echo
echo "============================================"
echo "[SECTION] Installing Specific Packages (No Deps)"
echo "============================================"
pip3 install --no-deps tokenizers==0.15.2 transformers==4.36.2



echo
echo "============================================"
echo "[SECTION] Installing More TTS Dependencies"
echo "============================================"
pip3 install pandas faster-whisper safetensors pypinyin hangul-Romanize num2words mutagen

echo
echo "============================================"
echo "[SECTION] Installing UVR Dependencies"
echo "============================================"
pip3 install pydub ml_collections beartype rotary-embedding-torch

echo
echo "============================================"
echo "[SECTION] Installing Audio Backend Dependencies"
echo "============================================"
apt-get update && apt-get install -y portaudio19-dev libportaudio2 libportaudiocpp0 ffmpeg
pip3 install pyaudio


echo
echo "============================================"
echo "[SECTION] Installing cuDNN 9.8 for CUDA 12"
echo "============================================"
apt-get install -y wget gnupg software-properties-common

wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-ubuntu2204.pin
mv cuda-ubuntu2204.pin /etc/apt/preferences.d/cuda-repository-pin-600

apt-key adv --fetch-keys https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/3bf863cc.pub

add-apt-repository "deb https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/ /"

apt-get update

apt-get install -y libcudnn9-cuda-12 libcudnn9-dev-cuda-12

echo
echo "============================================"
echo "[SECTION] Installing AVATAR Dependencies"
echo "============================================"
pip3 install ffmpeg-python future insightface

echo
echo "============================================"
echo "[SECTION] Installing Flask + Backend Dependencies"
echo "============================================"
pip3 install --ignore-installed blinker
pip3 install Flask Flask-Bcrypt Flask-Login Flask-Migrate Flask-SQLAlchemy Flask-WTF WTForms bcrypt email-validator itsdangerous Mako mediapipe ml_dtypes opt_einsum sentencepiece sounddevice


pip3 install flask_socketio
pip3 install flask-cors


echo
echo "============================================"
echo "[SECTION] Installing .env Support (python-dotenv)"
echo "============================================"
pip3 install python-dotenv

echo
echo "============================================"
echo "[SECTION] Installing Document Processing Dependencies"
echo "============================================"
pip3 install python-docx
pip3 install PyPDF2  
pip3 install Flask-Session
pip3 install supabase
pip3 install piper-tts

echo
echo "============================================"
echo "[SECTION] Fixing textract install"
echo "============================================"
python3 -m pip install "pip<24.1"
pip3 install textract
python3 -m pip install --upgrade pip

echo
echo "============================================"
echo "[SECTION] Installing Interview Dependencies"
echo "============================================"
pip3 install tiktoken

echo
echo "============================================"
echo "[SECTION] Setting up Ollama (Install if needed, Start Server, Pull Models)"
echo "============================================"

if ! command -v ollama &> /dev/null; then
    echo "[WARNING] Ollama is not installed."
    echo "[INFO] Installing Ollama..."
    curl https://ollama.ai/install.sh | sh
    export PATH="$PATH:/usr/local/bin"
else
    echo "[OK] Ollama is already installed."
fi

# Start Ollama server in background FIRST
echo "[INFO] Starting Ollama server in background..."
nohup ollama serve > /dev/null 2>&1 &

# Wait until it's up
echo "[INFO] Waiting for Ollama to become available..."
max_retries=10
until curl -s http://localhost:11434 > /dev/null || [ $max_retries -eq 0 ]; do
    echo "Waiting for Ollama... ($max_retries retries left)"
    sleep 2
    ((max_retries--))
done

if [ $max_retries -eq 0 ]; then
    echo "[ERROR] Ollama server failed to start."
else
    echo "[OK] Ollama server is running."

    echo "[INFO] Pulling models..."
    ollama pull llama3
fi

echo
echo "============================================"
echo "installing tmux and ollama python package and https requirements"
echo "============================================"
pip3 install ollama

echo
echo "============================================"
echo "[SECTION] Installing HTTPS Dependencies (nginx + certbot)"
echo "============================================"
sudo apt install -y nginx certbot python3-certbot-nginx

echo
echo "============================================"
echo "[SECTION] Uninstalling eventlet to enforce gevent-only setup"
echo "============================================"
pip3 uninstall -y eventlet || true
pip3 install gevent gunicorn


echo
echo "============================================"
echo "[SECTION] Installing Frontend Dependencies"
echo "============================================"
echo "[INFO] Checking if Node.js is installed..."
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed. Please install Node.js from https://nodejs.org/"
    echo "[INFO] After installing Node.js, run this script again."
    exit 1
fi

echo "[INFO] Node.js is installed. Installing frontend dependencies..."
cd "$(dirname "$0")/frontend"
npm install
cd "$(dirname "$0")"