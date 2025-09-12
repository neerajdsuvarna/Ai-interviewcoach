#!/bin/bash

set -ex  # Exit immediately if a command exits with a non-zero status

echo "============================================"
echo "[SECTION] Checking for Homebrew"
echo "============================================"

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "[WARNING] Homebrew not found. Installing..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    echo "[INFO] Homebrew installed successfully."
else
    echo "[OK] Homebrew already installed."
fi

echo
echo "============================================"
echo "[SECTION] Installing system dependencies"
echo "============================================"
brew install curl tmux nano lsof portaudio ffmpeg

echo
echo "============================================"
echo "[SECTION] Setting up Conda Environment"
echo "============================================"

# Check if conda is installed
if ! command -v conda &> /dev/null; then
    echo "[ERROR] Conda is not installed. Please install Miniconda or Anaconda first."
    echo "[INFO] Download from: https://docs.conda.io/en/latest/miniconda.html"
    exit 1
fi

# Check if interview-coach environment exists
if conda env list | grep -q "interview-coach"; then
    echo "[OK] Conda environment 'interview-coach' already exists."
else
    echo "[INFO] Creating conda environment 'interview-coach' with Python 3.11..."
    conda create -n interview-coach python=3.11 -y
fi

# Activate conda environment
echo "[INFO] Activating conda environment 'interview-coach'..."
source $(conda info --base)/etc/profile.d/conda.sh
conda activate interview-coach

# Check Python version
echo "[INFO] Python version: $(python --version)"
echo "[INFO] Pip version: $(pip --version)"

# Check if Python version is compatible
PYTHON_VERSION=$(python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "[INFO] Using Python version: $PYTHON_VERSION"

if [[ $(echo "$PYTHON_VERSION >= 3.13" | bc -l 2>/dev/null || echo "0") == "1" ]]; then
    echo "[WARNING] Python 3.13+ detected. Some packages may not be compatible."
    echo "[INFO] Consider using Python 3.11 or 3.12 for better compatibility."
    echo "[INFO] Continuing with installation, but some packages may fail..."
fi

echo
echo "============================================"
echo "[SECTION] Updating pip"
echo "============================================"
# Fix broken pip installation if it exists
pip install --force-reinstall pip || true
python -m pip install --upgrade pip

# Clean up broken package installations
echo "[INFO] Cleaning up broken package installations..."
pip install --force-reinstall setuptools wheel || true

echo
echo "============================================"
echo "[SECTION] Checking for GPU availability"
echo "============================================"

# Check for Apple Silicon (M1/M2) or Intel
if [[ $(uname -m) == "arm64" ]]; then
    echo "[INFO] Apple Silicon (M1/M2) detected. Installing PyTorch with MPS support."
    if ! pip install torch torchvision torchaudio; then
        echo "[WARNING] PyTorch installation failed, trying with --no-cache-dir..."
        pip install --no-cache-dir torch torchvision torchaudio
    fi
    pip install faster-whisper
    pip install onnxruntime
elif command -v nvidia-smi &> /dev/null; then
    echo "[INFO] NVIDIA GPU detected. Installing PyTorch with CUDA 12 support."
    if ! pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121; then
        echo "[WARNING] PyTorch CUDA installation failed, trying CPU version..."
        pip install torch torchvision torchaudio
    fi
    pip install faster-whisper
    pip install onnxruntime-gpu
else
    echo "[WARNING] No GPU detected. Installing CPU-only PyTorch."
    if ! pip install torch torchvision torchaudio; then
        echo "[WARNING] PyTorch installation failed, trying with --no-cache-dir..."
        pip install --no-cache-dir torch torchvision torchaudio
    fi
    pip install faster-whisper
    pip install onnxruntime
fi

echo
echo "============================================"
echo "[SECTION] Installing LIPSYNC"
echo "============================================"
pip install lipsync

echo
echo "============================================"
echo "[SECTION] Installing TTS Additional Dependencies"
echo "============================================"
pip install pyyaml regex einops spacy matplotlib

# Handle trainer package separately due to Python 3.13 compatibility
echo "[INFO] Installing trainer package (with compatibility check)..."
if ! pip install trainer; then
    echo "[WARNING] trainer package not compatible with Python 3.13, skipping..."
    echo "[INFO] This package may not be essential for basic functionality."
fi

echo
echo "============================================"
echo "[SECTION] Installing TTS Local Package (Editable Mode)"
echo "============================================"
cd backend/TTS
if ! pip install --no-deps -e .; then
    echo "[WARNING] TTS package installation failed, trying with dependencies..."
    pip install -e .
fi
cd ../..

echo
echo "============================================"
echo "[SECTION] Installing Specific Packages (No Deps)"
echo "============================================"
# Try to install specific versions, fallback to latest if needed
if ! pip install --no-deps tokenizers==0.15.2 transformers==4.36.2; then
    echo "[WARNING] Specific versions failed, trying latest versions..."
    pip install tokenizers transformers
fi

echo
echo "============================================"
echo "[SECTION] Installing More TTS Dependencies"
echo "============================================"
pip install pandas faster-whisper safetensors pypinyin hangul-Romanize num2words mutagen

echo
echo "============================================"
echo "[SECTION] Installing UVR Dependencies"
echo "============================================"
pip install pydub ml_collections beartype rotary-embedding-torch

echo
echo "============================================"
echo "[SECTION] Installing Audio Backend Dependencies"
echo "============================================"
pip install pyaudio

echo
echo "============================================"
echo "[SECTION] Installing AVATAR Dependencies"
echo "============================================"
pip install ffmpeg-python future insightface

echo
echo "============================================"
echo "[SECTION] Installing Flask + Backend Dependencies"
echo "============================================"
pip install --ignore-installed blinker
pip install Flask Flask-Bcrypt Flask-Login Flask-Migrate Flask-SQLAlchemy Flask-WTF WTForms bcrypt email-validator itsdangerous Mako mediapipe ml_dtypes opt_einsum sentencepiece sounddevice

pip install flask_socketio
pip install flask-cors

echo
echo "============================================"
echo "[SECTION] Installing .env Support (python-dotenv)"
echo "============================================"
pip install python-dotenv

echo
echo "============================================"
echo "[SECTION] Installing Document Processing Dependencies"
echo "============================================"
pip install python-docx
pip install PyPDF2  
pip install Flask-Session
pip install supabase
pip install piper-tts

echo
echo "============================================"
echo "[SECTION] Fixing textract install"
echo "============================================"
python -m pip install "pip<24.1"
pip install textract
python -m pip install --upgrade pip

echo
echo "============================================"
echo "[SECTION] Installing Interview Dependencies"
echo "============================================"
pip install tiktoken

echo
echo "============================================"
echo "[SECTION] Installing RealtimeSTT Dependencies"
echo "============================================"
pip install RealtimeSTT

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
pip install ollama

echo
echo "============================================"
echo "[SECTION] Installing HTTPS Dependencies (nginx + certbot)"
echo "============================================"
brew install nginx certbot

echo
echo "============================================"
echo "[SECTION] Uninstalling eventlet to enforce gevent-only setup"
echo "============================================"
pip uninstall -y eventlet || true
pip install gevent gunicorn

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

echo
echo "============================================"
echo "[DONE] Installation Complete"
echo "============================================"
echo "[INFO] Backend dependencies installed successfully"
echo "[INFO] Frontend dependencies installed successfully"
echo "[INFO] Conda environment created and activated: 'interview-coach'"
echo "[INFO] To activate the conda environment in future sessions:"
echo "[INFO]   conda activate interview-coach"
echo "[INFO] You can now run the development environment using:"
echo "[INFO] ./start_dev.sh"
echo
echo "[NOTE] The conda environment is now active. To deactivate it later, run:"
echo "[NOTE]   conda deactivate"
