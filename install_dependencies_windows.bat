@echo off
setlocal EnableDelayedExpansion

echo.
echo ============================================
echo [SECTION] Updating pip
echo ============================================
python -m pip install --upgrade pip

echo.
echo ============================================
echo [SECTION] Select PyTorch Installation Type
echo ============================================
echo 1 - CUDA (For NVIDIA GPUs)
echo 2 - MPS (For Apple Silicon M1/M2 GPUs)
echo 3 - CPU Only
set /p choice=Enter your choice (1/2/3): 

if "%choice%"=="1" goto check_cuda_version
if "%choice%"=="2" goto install_mps
if "%choice%"=="3" goto install_cpu

:check_cuda_version
echo.
echo ============================================
echo [SECTION] Checking CUDA Version
echo ============================================

:: Run nvcc to get the CUDA version
for /f "tokens=2 delims= " %%v in ('nvcc --version ^| findstr /C:"release"') do set "cuda_version=%%v"

if not defined cuda_version (
    echo [INFO] CUDA not found, defaulting to CPU installation.
    goto install_cpu
)

:: Extract only the first two digits (major version)
set "cuda_major=!cuda_version:~0,2!"

if "!cuda_major!"=="12" (
    echo [INFO] Detected CUDA 12.x (version: !cuda_version!)
    goto install_cuda_12
) else if "!cuda_major!"=="11" (
    echo [INFO] Detected CUDA 11.x (version: !cuda_version!)
    goto install_cuda_11
) else (
    echo [WARNING] Unsupported CUDA version detected (!cuda_version!), defaulting to CPU installation.
    goto install_cpu
)

:install_cuda_12
echo.
echo ============================================
echo [SECTION] Installing PyTorch (CUDA 12.x)
echo ============================================
pip install torch==2.5.1 torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install faster-whisper
pip install onnxruntime-gpu

goto continue_installation

:install_cuda_11
echo.
echo ============================================
echo [SECTION] Installing PyTorch (CUDA 11.x)
echo ============================================
pip install torch==2.5.1 torchvision torchaudio --index-url https://download.pytorch.org/whl/cu111
pip install faster-whisper

pip install onnxruntime-gpu

goto continue_installation

:install_mps
echo.
echo ============================================
echo [SECTION] Installing PyTorch (MPS - Apple Silicon)
echo ============================================
pip install torch==2.5.1 torchvision torchaudio
pip install faster-whisper
pip install onnxruntime
goto continue_installation

:install_cpu
echo.
echo ============================================
echo [SECTION] Installing PyTorch (CPU Only)
echo ============================================
pip install torch==2.5.1 torchvision torchaudio 
pip install faster-whisper
pip install onnxruntime
goto continue_installation

:continue_installation
echo.
echo ============================================
echo [SECTION] Installing LIPSYNC
echo ============================================
pip install lipsync

echo.
echo ============================================
echo [SECTION] Installing TTS Additional Dependencies
echo ============================================
pip install pyyaml
pip install regex
pip install einops
pip install spacy
pip install trainer
pip install matplotlib

echo.
echo ============================================
echo [SECTION] Installing TTS Local Package in Editable Mode
echo ============================================
pushd "%~dp0backend/TTS"
pip install --no-deps -e .
popd

echo.
echo ============================================
echo [SECTION] Installing Specific Packages (No Dependencies)
echo ============================================
pip install --no-deps tokenizers==0.15.2 transformers==4.36.2

echo.
echo ============================================
echo [SECTION] Installing More TTS Dependencies
echo ============================================
pip install pandas
pip install safetensors
pip install pypinyin
pip install hangul-Romanize
pip install num2words
pip install mutagen

echo.
echo ============================================
echo [SECTION] Installing UVR Dependencies
echo ============================================
pip install pydub
pip install ml_collections  
pip install beartype
pip install rotary-embedding-torch

echo.
echo ============================================
echo [SECTION] Installing Flask + Backend Dependencies
echo ============================================
pip install Flask Flask-Bcrypt Flask-Login Flask-Migrate Flask-SQLAlchemy Flask-WTF WTForms bcrypt email-validator itsdangerous Mako mediapipe ml_dtypes opt_einsum sentencepiece sounddevice 
pip install flask_socketio 
pip install flask-cors
pip install Flask-Session


echo.
echo ============================================
echo [SECTION] Installing STT
echo ============================================
pip install RealtimeSTT


pip install ollama

echo.
echo ============================================
echo [SECTION] Installing Ollama and Checking Server
echo ============================================
ollama pull llama3


echo.
echo Checking if Ollama is already running...

netstat -ano | findstr :11434 >nul
if %errorlevel%==0 (
    echo [INFO] Ollama is already running on port 11434.
) else (
    echo [INFO] Starting Ollama server...
    start /B ollama serve
)

echo.
echo ============================================
echo [SECTION] Installing .env Support (python-dotenv)
echo ============================================
pip install python-dotenv

echo.
echo ===============================
echo [INFO] Fixing textract install
echo ===============================
python -m pip install "pip<24.1"
pip install textract
python -m pip install --upgrade pip

echo.
echo =========================================
echo [INFO] Installing Interview Dependencies
echo =========================================
pip install tiktoken

echo.
echo ============================================
echo [SECTION] Installing Model Downloader and Downloading Models
echo ============================================
python -m pip install gdown
pip install python-docx
pip install PyPDF2  

echo.
echo [INFO] Running model_download.py with matched Python interpreter...

for /f "delims=" %%i in ('where python') do set "PYTHON=%%i" & goto breakloop
:breakloop

echo [INFO] Using Python: %PYTHON%
"%PYTHON%" "%~dp0backend/model_download.py"

echo.
echo ============================================
echo [SECTION] Installing Frontend Dependencies
echo ============================================
echo [INFO] Checking if Node.js is installed...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js from https://nodejs.org/
    echo [INFO] After installing Node.js, run this script again.
    pause
    exit /b 1
)

echo [INFO] Node.js is installed. Installing frontend dependencies...
cd "%~dp0frontend"
npm install
cd ..

echo.
echo ============================================
echo [DONE] Installation Complete
echo ============================================
echo [INFO] Backend dependencies installed successfully
echo [INFO] Frontend dependencies installed successfully
echo [INFO] You can now run the development environment using:
echo [INFO] Windows: start_dev.bat
echo [INFO] Linux/Mac: ./start_dev.sh
pause


