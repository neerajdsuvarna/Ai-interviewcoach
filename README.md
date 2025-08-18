# 🎭 AI Media Toolkit (Develop Branch)

This **AI-powered media processing suite** includes **Text-to-Speech, Lip-Sync, Avatar Swapping, and Audio Processing**, all within a single unified environment.

---

## 🌟 **Features**
- **Text-to-Speech (TTS)** – Generate speech with voice cloning  
- **Lip-Sync (Wav2Lip)** – AI-driven lip movement synced with audio  
- **Avatar Swapping** – High-quality face swapping for avatars  
- **Audio Enhancement (UVR)** – Remove noise, separate vocals/instruments  
- **One-Click Setup** – Fully automated dependency installation  
- **GPU Acceleration** – Supports **CUDA, MPS, or CPU**  

---

## 📂 **Project Structure**
```
virtual_human_simulation/
├── backend/                          # Backend Flask API and AI services
│   ├── app.py                        # Main Flask application
│   ├── common/                       # Shared utilities and models
│   │   ├── config.py                 # Centralized configuration
│   │   ├── GPU_Check.py              # Auto-detect GPU/CPU (CUDA, MPS, etc.)
│   │   ├── auth.py                   # Authentication utilities
│   │   ├── NLP_model.py              # NLP Model for AI responses
│   │   ├── XTTS_MODEL/               # TTS Model files
│   │   ├── audio-separator-models/   # UVR model files
│   │   └── checkpoints_A2H/          # LipSync & General Model Checkpoints
│   ├── INTERVIEW/                    # Interview processing modules
│   │   ├── Resumeparser.py           # Resume parsing and question generation
│   │   ├── Interview_functions.py    # Interview management functions
│   │   ├── Interview_manager.py      # Interview orchestration
│   │   └── INTERVIEWBOT_CLI.py       # Command-line interview interface
│   ├── TTS/                          # Text-to-Speech (XTTS)
│   │   ├── Scripts/                  # TTS scripts and demos
│   │   │   ├── tts_demo.py           # TTS demonstration
│   │   │   ├── TTS_LOAD_MODEL.py     # Model loading and inference
│   │   │   ├── TTS_TRAIN_MODEL.py    # Model training
│   │   │   └── UVR_TTS.py            # Audio enhancement + TTS pipeline
│   │   └── TTS/                      # TTS library files
│   ├── UVR/                          # Audio Separation (Vocal/Instrument Split)
│   │   ├── uvr/                      # UVR execution scripts and models
│   │   └── audio_enhancer.py         # Main UVR processing script
│   ├── Audio2Head/                   # Audio-to-Head movement synthesis
│   │   ├── modules/                  # Audio2Head modules
│   │   └── sync_batchnorm/           # Synchronized batch normalization
│   ├── Flask_UI/                     # Flask-based Web UI
│   │   ├── static/                   # Static files (CSS, JS, images)
│   │   ├── models.py                 # Database models
│   │   ├── import_secrets.py         # Secret management
│   │   └── README.md                 # Flask UI documentation
│   ├── model_download.py             # Model download utilities
│   ├── start.sh                      # Backend startup script
│   └── README.md                     # Backend documentation
├── frontend/                         # React-based web application
│   ├── src/                          # React source code
│   │   ├── components/               # React components
│   │   │   ├── AuthDebug.jsx         # Authentication debugging
│   │   │   ├── Navbar.jsx            # Navigation component
│   │   │   ├── ThemeToggle.jsx       # Theme switching
│   │   │   ├── interview/            # Interview-related components
│   │   │   ├── landing/              # Landing page components
│   │   │   ├── upload/               # File upload components
│   │   │   └── ui/                   # UI components
│   │   ├── pages/                    # Page components
│   │   │   ├── InterviewPage.jsx     # Interview interface
│   │   │   ├── Landing.jsx           # Landing page
│   │   │   ├── Login.jsx             # Login page
│   │   │   ├── ProfilePage.jsx       # User profile
│   │   │   ├── QuestionPage.jsx      # Question management
│   │   │   ├── SignUp.jsx            # Registration page
│   │   │   ├── TestPage.jsx          # Testing page
│   │   │   └── UploadPage.jsx        # File upload page
│   │   ├── contexts/                 # React contexts
│   │   │   └── AuthContext.jsx       # Authentication context
│   │   ├── hooks/                    # Custom React hooks
│   │   │   └── useTheme.js           # Theme management hook
│   │   ├── api.js                    # API integration
│   │   ├── supabaseClient.js         # Supabase client configuration
│   │   ├── App.jsx                   # Main App component
│   │   ├── main.jsx                  # Application entry point
│   │   └── index.css                 # Global styles
│   ├── public/                       # Public assets
│   │   ├── assets/                   # Static assets
│   │   │   ├── interview/            # Interview-related assets
│   │   │   └── landing/              # Landing page assets
│   │   └── vite.svg                  # Vite logo
│   ├── package.json                  # Node.js dependencies
│   ├── vite.config.js                # Vite configuration
│   ├── tailwindcss.config.js         # Tailwind CSS configuration
│   ├── eslint.config.js              # ESLint configuration
│   └── README.md                     # Frontend documentation
├── supabase/                         # Supabase backend services
│   ├── config.toml                   # Supabase configuration
│   ├── migrations/                   # Database migrations
│   └── functions/                    # Edge functions
│       ├── create-user/              # User creation function
│       ├── dodo-webhook/             # Webhook handler
│       ├── interview-feedback/       # Interview feedback processing
│       ├── interviews/               # Interview management
│       ├── job-descriptions/         # Job description handling
│       ├── payments/                 # Payment processing
│       ├── questions/                # Question management
│       ├── resume-test/              # Resume testing
│       ├── resumes/                  # Resume processing
│       ├── transcripts/              # Transcript management
│       └── upload-file/              # File upload handling
├── supabase_Scripts/                 # Supabase utility scripts
│   ├── all_db_edge_operations.py     # Database operations
│   ├── db_operations.py              # Database utilities
│   ├── main.py                       # Main script runner
│   ├── supabase_storage.py           # Storage utilities
│   └── Test_Resumes/                 # Test resume files
├── install_dependencies.bat          # Windows dependency installer
├── install_dependencies.sh           # Linux/macOS dependency installer
├── start_dev.bat                     # Windows development server starter
├── start_dev.sh                      # Linux/macOS development server starter
├── INSTALLATION_GUIDE.md             # Detailed installation guide
└── README.md                         # This file
```

## **Installation & Setup**

### **Prerequisites**

Ensure you have **Python 3.10** installed on your system.

### **1. Clone the Repository**
```bash
git clone https://github.com/moback-ai/virtual_human_simulation.git
cd virtual_human_simulation
```

### **2. Create Virtual Environment**

#### **For Windows:**
```bash
py -3.10 -m venv test1
```

#### **For Linux/macOS:**
```bash
python3.10 -m venv test1
```

### **3. Activate Virtual Environment**

#### **For Windows:**
```bash
.\test1\Scripts\activate
```

#### **For Linux/macOS:**
```bash
source test1/bin/activate
```

### **4. Install Dependencies**

#### **For Windows:**
```bash
.\install_dependencies.bat
```

#### **For Linux/macOS:**
```bash
chmod +x install_dependencies.sh
./install_dependencies.sh
```

### **5. Install Ollama**
Ollama is required for AI model inference. Follow these steps:

#### Step 1: Visit the Official Ollama Website
- Open your browser and navigate to: [https://ollama.ai](https://ollama.ai)

#### Step 2: Download and Install
- Select your operating system (Windows, macOS, or Linux).
- Follow the installation instructions provided on the website.

#### Step 3: Verify Installation
- Open a terminal and run the following command:
```bash
ollama --version
```
- If the command returns a version number, Ollama has been installed successfully.

### **6. Install FFmpeg**
The script uses `pydub`, which requires **FFmpeg**. Install it by following these steps:

#### **For Windows:**

**Download FFmpeg**  
- Open a web browser.  
- Navigate to **[Windows build from gyan.dev](https://www.gyan.dev/ffmpeg/builds/)**.  
- Under **"Git Master Builds,"** locate and download:  
    ```text
    ffmpeg-git-full.7z
    ```

**Extract and Move FFmpeg**  
- Once downloaded, extract the `.7z` file using **WinRAR** or **7-Zip**.  
- Move the extracted folder to:  
    ```text
    C:\Program Files\
    ```
- Open the extracted folder, navigate to the **bin** directory, and copy the full path. Example:  
    ```text
    C:\Program Files\ffmpeg-7.1-full_build\bin
    ```

**Set Up Environment Variables**  
- In the **Windows Search Bar**, type:  
    ```text
    Edit the system environment variables
    ```  
- Click on **Environment Variables** at the bottom of the window.  
- Under **User Variables**, locate and select **Path**, then click **Edit**.  
- In the **Edit Environment Variable** window, click **New**, paste the copied FFmpeg **bin** path, and click **OK**.  
- Click **OK** on all open windows to save the changes.  

#### **For Linux/macOS:**
```bash
sudo apt install ffmpeg   # Ubuntu/Debian
brew install ffmpeg       # macOS (Homebrew)
```

**Verify FFmpeg Installation:**
```bash
ffmpeg -version
```

### **7. Start Development Server**

#### **For Windows:**
```bash
start_dev.bat
```

#### **For Linux/macOS:**
```bash
chmod +x start_dev.sh
./start_dev.sh
```

---

## **Running the Application**

After completing the installation and setup steps above, the development server will automatically start and you can access the application through your web browser.

The application includes:
- **Frontend**: React-based web interface
- **Backend**: Flask API server
- **Database**: Supabase integration
- **AI Services**: Ollama-powered interview and resume processing

---

## **Project Structure**
All the necessary model files, your `backend/common/` folder should look like this:

```
backend/common/
├── audio-separator-models/                                      # UVR model files
│ ├── download_checks.json
│ ├── Kim_Vocal_2.onnx
│ ├── mdx_model_data.json
│ ├── model_mel_band_roformer_ep_3005_sdr_11.4360.ckpt
│ ├── model_mel_band_roformer_ep_3005_sdr_11.4360.yaml
│ ├── vr_model_data.json
├── XTTS_MODEL/                                                  # XTTS model files
│ ├── config.json
│ ├── dvae.pth
│ ├── mel_stats.pth
│ ├── model.pth
│ ├── vocab.json
├── checkpoints_A2H/                                                 # LipSync & General Model Checkpoints
│ ├── audio2head.pth.tar
├── config.py # Centralized configuration file
├── GPU_Check.py # Auto-detects GPU/CPU (CUDA, MPS, etc.)
```

---

## **Troubleshooting**

### **Common Issues:**

1. **Virtual Environment Not Activated**: Make sure you see `(test1)` at the beginning of your command prompt/terminal
2. **Python Version**: Ensure you're using Python 3.10
3. **FFmpeg Not Found**: Verify FFmpeg is properly installed and added to your system PATH
4. **Ollama Not Running**: Start Ollama service before running the application

### **Getting Help:**
- Check the logs in the terminal for specific error messages
- Ensure all dependencies are properly installed
- Verify that all required model files are in the correct directories
