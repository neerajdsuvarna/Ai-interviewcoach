# 🎯 Interview Coach AI Platform

This **AI-powered interview coaching platform** provides comprehensive mock interview experiences with real-time feedback, audio processing, and advanced analytics tracking.

---

## 🌟 **Features**
- **AI Mock Interviews** – Personalized interview questions based on resume and job description
- **Real-time Audio Processing** – Voice synthesis and transcription using Piper TTS and Whisper
- **Comprehensive Feedback** – AI-generated performance analysis with strengths and improvement areas
- **Payment Integration** – Secure payment processing with Dodo Payments
- **Analytics Tracking** – Mixpanel integration for user behavior and conversion tracking
- **Head Tracking** – Real-time eye contact and attention monitoring
- **Audio Enhancement** – Noise removal and audio quality improvement
- **One-Click Setup** – Fully automated dependency installation
- **GPU Acceleration** – Supports **CUDA, MPS, or CPU**  

---

## 📂 **Project Structure**
```
interviewcoach/
├── backend/                          # Backend Flask API and AI services
│   ├── app.py                        # Main Flask application with interview logic
│   ├── common/                       # Shared utilities and models
│   │   ├── auth.py                   # Supabase authentication utilities
│   │   └── GPU_Check.py              # Auto-detect GPU/CPU (CUDA, MPS, etc.)
│   ├── INTERVIEW/                    # Interview processing modules
│   │   ├── Resumeparser.py           # Resume parsing and question generation
│   │   ├── Interview_functions.py    # Interview management functions
│   │   ├── Interview_manager.py      # Interview orchestration and evaluation
│   │   ├── interview_config.json     # Interview configuration
│   │   └── INTERVIEWBOT_CLI.py       # Command-line interview interface
│   ├── Piper/                        # Text-to-Speech (Piper TTS)
│   │   ├── voiceCloner.py            # Voice synthesis and TTS processing
│   │   ├── en_US-kusal-medium.onnx   # Piper TTS model files
│   │   └── en_US-kusal-medium.onnx.json
│   └── README.md                     # Backend documentation
├── frontend/                         # React-based web application
│   ├── src/                          # React source code
│   │   ├── components/               # React components
│   │   │   ├── Navbar.jsx            # Navigation component
│   │   │   ├── ThemeToggle.jsx       # Theme switching
│   │   │   ├── InterviewHistoryCard.jsx # Interview history display
│   │   │   ├── interview/            # Interview-related components
│   │   │   │   └── ChatWindow.jsx    # Main interview chat interface
│   │   │   ├── landing/              # Landing page components
│   │   │   ├── upload/               # File upload components
│   │   │   └── ui/                   # UI components
│   │   ├── pages/                    # Page components
│   │   │   ├── InterviewPage.jsx     # Interview interface
│   │   │   ├── InterviewFeedbackPage.jsx # Interview feedback display
│   │   │   ├── PaymentsStatus.jsx    # Payment status handling
│   │   │   ├── Landing.jsx           # Landing page
│   │   │   ├── Login.jsx             # Login page
│   │   │   ├── ProfilePage.jsx       # User profile and history
│   │   │   ├── QuestionPage.jsx      # Question management and payment
│   │   │   ├── SignUp.jsx            # Registration page
│   │   │   └── UploadPage.jsx        # File upload page
│   │   ├── contexts/                 # React contexts
│   │   │   └── AuthContext.jsx       # Authentication context
│   │   ├── hooks/                    # Custom React hooks
│   │   │   ├── useTheme.js           # Theme management hook
│   │   │   ├── useMixpanel.js        # Mixpanel analytics hook
│   │   │   ├── useHeadTracking.js    # Head tracking integration
│   │   │   └── useEmailVerification.js # Email verification hook
│   │   ├── services/                 # External services
│   │   │   └── mixpanel.js           # Mixpanel analytics service
│   │   ├── utils/                    # Utility functions
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
│       ├── dodo-webhook/             # Payment webhook handler
│       ├── interview-feedback/       # Interview feedback processing
│       ├── interview-setup/          # Interview initialization
│       ├── interviews/               # Interview management
│       ├── job-descriptions/         # Job description handling
│       ├── payments/                 # Payment processing
│       ├── questions/                # Question management
│       ├── resumes/                  # Resume processing
│       ├── transcripts/              # Transcript management
│       └── upload-file/              # File upload handling
├── install_dependencies_windows.bat  # Windows dependency installer
├── install_dependencies_linux.sh     # Linux dependency installer
├── install_dependencies_macos.sh     # macOS dependency installer
├── start_dev.bat                     # Windows development server starter
├── start_dev.sh                      # Linux/macOS development server starter
└── README.md                         # This file
```

## **Installation & Setup**

### **Prerequisites**

Ensure you have **Python 3.10** installed on your system.

### **1. Clone the Repository**
```bash
git clone https://github.com/moback-ai/interviewcoach.git
cd interviewcoach
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
.\install_dependencies_windows.bat
```

#### **For Linux:**
```bash
chmod +x install_dependencies_linux.sh
./install_dependencies_linux.sh
```

#### **For macOS:**
```bash
chmod +x install_dependencies_macos.sh
./install_dependencies_macos.sh
```

### **5. Install Ollama**
Ollama is required for AI model inference. Follow these steps:

#### Step 1: Visit the Official Ollama Website
- Open your browser and navigate to: [https://ollama.ai](https://ollama.ai)

#### Step 2: Download and Install
- Select your operating system (Windows, macOS, or Linux).
- Follow the installation instructions provided on the website.

#### Step 3: Pull Required Models
After installing Ollama, pull the required models:
```bash
ollama pull llama3
```

#### Step 4: Verify Installation
- Open a terminal and run the following command:
```bash
ollama --version
```
- If the command returns a version number, Ollama has been installed successfully.

### **6. Install FFmpeg**
The application uses `pydub` for audio processing, which requires **FFmpeg**. Install it by following these steps:

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

### **7. Environment Setup**
Ensure your `.env` file in the project root directory contains the following variables:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DODO_WEBHOOK_SECRET=whsec_your_webhook_secret_here
MIXPANEL_TOKEN=your_mixpanel_token
```

**Note**: The `.env` file should be in your project root directory. Copy from `env.local`, `env.development`, or `env.production` as needed.

### **8. Start Development Server**

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
- **Frontend**: React-based web interface with interview coaching features
- **Backend**: Flask API server with AI interview processing
- **Database**: Supabase integration with user management and interview storage
- **AI Services**: Ollama-powered interview questions and feedback generation
- **Payment Processing**: Dodo Payments integration for interview access
- **Analytics**: Mixpanel tracking for user behavior and conversion analytics
- **Audio Processing**: Piper TTS for voice synthesis and Whisper for transcription

---

## **Key Features & Technologies**

### **Interview Coaching System**
- **Resume Analysis**: AI-powered resume parsing and job description matching
- **Question Generation**: Dynamic interview questions based on role and experience level
- **Real-time Interview**: Interactive chat interface with voice synthesis
- **Performance Evaluation**: Comprehensive feedback with strengths and improvement areas
- **Audio Recording**: Complete interview transcript with audio playback

### **Payment & Analytics**
- **Payment Processing**: Secure payment integration with Dodo Payments
- **User Analytics**: Mixpanel tracking for user behavior and conversion metrics
- **Interview History**: Complete record of all user interviews and feedback

### **Technical Stack**
- **Frontend**: React with Vite, Tailwind CSS, Framer Motion
- **Backend**: Flask with Socket.IO for real-time communication
- **Database**: Supabase with PostgreSQL
- **AI Models**: Ollama (Llama3), Piper TTS, Whisper STT
- **Authentication**: Supabase Auth with JWT tokens
- **File Storage**: Supabase Storage for audio files and documents

---

## **Troubleshooting**

### **Common Issues:**

1. **Virtual Environment Not Activated**: Make sure you see `(test1)` at the beginning of your command prompt/terminal
2. **Python Version**: Ensure you're using Python 3.10
3. **FFmpeg Not Found**: Verify FFmpeg is properly installed and added to your system PATH
4. **Ollama Not Running**: Start Ollama service and ensure llama3 model is pulled
5. **Environment Variables**: Verify all required environment variables are set in `.env` file
6. **Supabase Connection**: Check that Supabase URL and keys are correct
7. **Payment Issues**: Ensure Dodo webhook secret is properly configured
8. **Audio Processing**: Verify Piper TTS model files are in the correct directory

### **Getting Help:**
- Check the logs in the terminal for specific error messages
- Ensure all dependencies are properly installed
- Verify that all required environment variables are set
- Check Supabase dashboard for database connection issues
- Review browser console for frontend errors

### **Development Tips:**
- Use browser developer tools to debug frontend issues
- Check backend logs for API errors
- Verify Mixpanel events in the Mixpanel dashboard
- Test payment flow in Dodo's test environment
