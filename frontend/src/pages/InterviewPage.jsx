import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { PhoneOff } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import Navbar from '@/components/Navbar';
import ChatWindow from '@/components/interview/ChatWindow';

function InterviewPage() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState([
    {
      id: 1,
      speaker: 'interviewer',
      message: 'Good morning. I\'m Michael Chen, Senior Engineering Manager at TechCorp. Thank you for joining us today. Let\'s begin with your introduction - please tell us about your background and what interests you about this position.',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  
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

  const endInterview = () => {
    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Navigate to feedback page with a mock interview ID
    // In a real implementation, this would be the actual interview ID from the backend
    const mockInterviewId = 'mock-interview-id-' + Date.now();
    navigate(`/interview-feedback?interview_id=${mockInterviewId}`);
  };

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
              
              {/* Session Status */}
              {/* <div className="flex items-center gap-1 bg-green-500/90 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs font-semibold shadow-md border border-green-400/30">
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                <span className="tracking-wide">ACTIVE</span>
              </div> */}
            </div>
          </div>

          {/* End Interview Button */}
          <button
            onClick={endInterview}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-semibold text-sm transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
          >
            <PhoneOff size={16} />
            <span className="hidden sm:inline">End Interview</span>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row h-[80vh] lg:h-[85vh]">
          {/* Left - Interviewer Video */}
          <div 
            className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r p-4 lg:p-6" 
            style={{ 
              backgroundColor: 'var(--color-card)', 
              borderColor: 'var(--color-border)' 
            }}
          >
            <div className="h-full flex flex-col">
              {/* Interviewer Video Container */}
              <div 
                className="h-48 lg:flex-1 relative rounded-2xl overflow-hidden shadow-lg border"
                style={{ borderColor: 'var(--color-border)' }}
              >
                {/* Interviewer Image */}
                <img
                  src="/assets/interview/interviewer_1.jpg"
                  alt="Michael Chen - Senior Engineering Manager"
                  className="w-full h-full object-cover"
                />
                
                {/* Interviewer Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-6">
                  <h3 className="text-white font-bold text-lg md:text-xl mb-1">Michael Chen</h3>
                  <p className="text-gray-200 text-sm md:text-base font-medium">Senior Engineering Manager</p>
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

                {/* Processing State */}
                {isLoading && (
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div 
                      className="rounded-xl p-6 text-center shadow-2xl"
                      style={{ backgroundColor: 'var(--color-card)' }}
                    >
                      <div 
                        className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-3"
                        style={{ borderColor: 'var(--color-primary)' }}
                      ></div>
                      <p 
                        className="font-medium"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        Processing...
                      </p>
                    </div>
                  </motion.div>
                )}
                
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
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default InterviewPage;