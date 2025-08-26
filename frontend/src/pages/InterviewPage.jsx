import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PhoneOff } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '../supabaseClient';
import Navbar from '@/components/Navbar';
import ChatWindow from '@/components/interview/ChatWindow';

function InterviewPage() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isValidated, setIsValidated] = useState(false);
  const [isValidating, setIsValidating] = useState(true); // ✅ RENAMED: Validation loading
  
  // ✅ ADD: Separate loading state for ChatWindow
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // ✅ ADD: Track if validation has been attempted
  const hasValidated = useRef(false);
  
  // ✅ ADD MISSING STATE VARIABLES
  const [conversation, setConversation] = useState([
    {
      id: 1,
      speaker: 'interviewer',
      message: 'Good morning. I\'m Michael Chen, Senior Engineering Manager at TechCorp. Thank you for joining us today. Let\'s begin with your introduction - please tell us about your background and what interests you about this position.',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Initialize camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: 'user'
          }, 
          audio: false // No audio needed for video only
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        streamRef.current = stream;
      } catch (error) {
        console.error('Error accessing camera:', error);
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Interview validation - FIXED to only run once
  useEffect(() => {
    const validateInterview = async () => {
      // ✅ FIXED: Only validate once
      if (hasValidated.current) {
        return;
      }
      
      hasValidated.current = true;
      
      try {
        setIsValidating(true); // ✅ FIXED: Use validation-specific loading state
        
        // Get interview_id from URL
        const interviewId = searchParams.get('interview_id');
        
        if (!interviewId) {
          console.log('❌ No interview_id provided');
          navigate('/upload');
          return;
        }
        
        console.log('🔍 Validating interview:', interviewId);
        
        // Get user session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          console.log('❌ No session found');
          navigate('/upload');
          return;
        }
        
        // Check if interview exists and get its status
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/interviews/${interviewId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        
        const result = await response.json();
        
        console.log('📋 Interview validation result:', result);
        
        if (!response.ok || !result.success) {
          console.log('❌ Interview not found or access denied');
          navigate('/upload');
          return;
        }
        
        const interview = result.data;
        
        // ✅ NEW: Handle different interview statuses
        if (interview.status === 'ENDED') {
          console.log('✅ Interview already completed, redirecting to feedback page');
          navigate(`/interview-feedback?interview_id=${interviewId}`);
          return;
        }
        
        if (interview.status !== 'STARTED') {
          console.log('❌ Interview status is not STARTED:', interview.status);
          navigate('/upload');
          return;
        }
        
        console.log('✅ Interview validated successfully:', interview);
        setIsValidated(true);
        
      } catch (error) {
        console.error('❌ Interview validation error:', error);
        navigate('/upload');
      } finally {
        setIsValidating(false); // ✅ FIXED: Use validation-specific loading state
      }
    };
    
    validateInterview();
  }, []); // ✅ FIXED: Empty dependency array - only runs once on mount

  const endInterview = () => {
    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Navigate to feedback page with the actual interview ID
    const interviewId = searchParams.get('interview_id');
    navigate(`/interview-feedback?interview_id=${interviewId}`);
  };

  // Show loading while validating
  if (isValidating) { // ✅ FIXED: Use validation-specific loading state
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto mb-4"></div>
            <p className="text-[var(--color-text-secondary)]">Validating interview session...</p>
          </div>
        </div>
      </>
    );
  }

  // Show error if not validated
  if (!isValidated) {
    return null; // Will redirect to /upload
  }

  // Original interview page content
  return (
    <>
      <Navbar />
      
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
        {/* Top Bar with End Interview Button */}
        <div 
          className="flex items-center justify-between px-4 lg:px-6 py-3 border-b"
          style={{ 
            backgroundColor: 'var(--color-card)',
            borderColor: 'var(--color-border)' 
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <h1 
                className="text-lg lg:text-xl font-bold tracking-tight"
                style={{ color: 'var(--color-text-primary)' }}
              >
                AI Interview Session
              </h1>
            </div>
          </div>

          {/* End Interview Button */}
          <button
            onClick={endInterview}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <PhoneOff className="w-4 h-4" />
            End Interview
          </button>
        </div>

        {/* Main Interview Interface */}
        <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)]">
          {/* Left - AI Interviewer */}
          <div 
            className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r p-4 lg:p-6"
            style={{ 
              backgroundColor: 'var(--color-card)', 
              borderColor: 'var(--color-border)' 
            }}
          >
            <div className="h-full flex flex-col">
              {/* AI Video Container */}
              <div 
                className="h-48 lg:flex-1 relative rounded-2xl overflow-hidden shadow-lg border"
                style={{ borderColor: 'var(--color-border)' }}
              >
                {/* ✅ FIXED: Add AI interviewer image */}
                <img
                  src="/assets/interview/interviewer_1.jpg"
                  alt="AI Interviewer"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Show fallback if image fails to load
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'flex';
                  }}
                />
                
                {/* Fallback if image doesn't load */}
                <div 
                  className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center"
                  style={{ display: 'none' }}
                >
                  <div className="text-center text-white">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl font-bold">AI</span>
                    </div>
                    <h3 className="text-lg font-semibold mb-2">AI Interviewer</h3>
                    <p className="text-sm opacity-90">Ready to begin</p>
                  </div>
                </div>

                {/* Live Indicator */}
                <div className="absolute top-4 left-4">
                  <div className="flex items-center gap-2 bg-green-500/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg border border-green-400/30">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span className="tracking-wide">LIVE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Middle - User Camera */}
          <div 
            className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r p-4 lg:p-6" 
            style={{ 
              backgroundColor: 'var(--color-card)', 
              borderColor: 'var(--color-border)' 
            }}
          >
            <div className="h-full flex flex-col">
              {/* User Video Container */}
              <div 
                className="h-48 lg:flex-1 relative rounded-2xl overflow-hidden shadow-lg border"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted={true}
                  className="w-full h-full object-cover"
                />

                {/* Processing State - REMOVED: No longer needed since we have separate loading states */}
                
                {/* User Camera Label */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-6">
                  <h3 className="text-white font-bold text-lg md:text-xl mb-1">Your Camera</h3>
                  <p className="text-gray-200 text-sm md:text-base font-medium">Live Feed</p>
                </div>

                {/* Connection Status */}
                <div className="absolute top-4 left-4">
                  <div 
                    className="flex items-center gap-2 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg border border-white/20 backdrop-blur-sm"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    <span className="tracking-wide">CONNECTED</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right - Chat Conversation */}
          <div 
            className="w-full lg:w-1/3"
            style={{ backgroundColor: 'var(--color-card)' }}
          >
            <ChatWindow
              conversation={conversation}
              setConversation={setConversation}
              isLoading={isChatLoading} // ✅ FIXED: Use chat-specific loading state
              setIsLoading={setIsChatLoading} // ✅ FIXED: Use chat-specific loading state
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default InterviewPage;