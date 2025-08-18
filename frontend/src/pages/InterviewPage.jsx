import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, User } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import Navbar from '@/components/Navbar';
import ChatWindow from '@/components/interview/ChatWindow';

function InterviewPage() {
  const { isDark } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
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
          audio: true 
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

  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      setIsLoading(true);
      
      // Simulate processing time
      setTimeout(() => {
        // Add candidate's response to conversation
        const newMessage = {
          id: conversation.length + 1,
          speaker: 'candidate',
          message: 'Thank you, Mr. Chen. I\'m a senior software engineer with 6 years of experience in full-stack development. I\'ve led multiple projects at my current company, including a microservices architecture that improved system performance by 40%. I\'m particularly excited about TechCorp\'s innovative approach to AI integration and the opportunity to work on cutting-edge technology.',
          timestamp: new Date().toLocaleTimeString()
        };
        
        setConversation(prev => [...prev, newMessage]);
        
        // Simulate interviewer's follow-up question
        setTimeout(() => {
          const followUp = {
            id: conversation.length + 2,
            speaker: 'interviewer',
            message: 'Impressive background. Can you walk me through a challenging technical problem you solved recently? I\'d like to understand your problem-solving approach.',
            timestamp: new Date().toLocaleTimeString()
          };
          setConversation(prev => [...prev, followUp]);
          setIsLoading(false);
        }, 2000);
        
        setIsLoading(false);
      }, 3000);
    } else {
      // Start recording
      setIsRecording(true);
    }
  };

  return (
    <>
      <Navbar />
      
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="flex h-screen">
          {/* Left - Interviewer Video */}
          <div 
            className="w-1/3 border-r p-6" 
            style={{ 
              backgroundColor: 'var(--color-card)', 
              borderColor: 'var(--color-border)' 
            }}
          >
            <div className="h-full flex flex-col">
              {/* Interviewer Video Container */}
              <div 
                className="flex-1 relative rounded-2xl overflow-hidden shadow-lg border"
                style={{ borderColor: 'var(--color-border)' }}
              >
                {/* Interviewer Image */}
                <img
                  src="/assets/interview/interviewer_1.jpg"
                  alt="Michael Chen - Senior Engineering Manager"
                  className="w-full h-full object-cover"
                />
                
                {/* Interviewer Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <h3 className="text-white font-semibold text-base">Michael Chen</h3>
                  <p className="text-gray-300 text-sm">Senior Engineering Manager</p>
                </div>

                {/* Live Indicator */}
                <div className="absolute top-4 left-4">
                  <div className="flex items-center gap-1 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                    Live
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Middle - User Camera */}
          <div 
            className="w-1/3 border-r p-6" 
            style={{ 
              backgroundColor: 'var(--color-card)', 
              borderColor: 'var(--color-border)' 
            }}
          >
            <div className="h-full flex flex-col">
              {/* User Video Container */}
              <div 
                className="flex-1 relative rounded-2xl overflow-hidden shadow-lg border"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted={isMuted}
                  className="w-full h-full object-cover"
                />
                
                {/* Recording Indicator */}
                {isRecording && (
                  <motion.div
                    className="absolute top-4 right-4"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div className="flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      Recording...
                    </div>
                  </motion.div>
                )}

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
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <h3 className="text-white font-semibold text-base">Your Camera</h3>
                  <p className="text-gray-300 text-sm">Live Feed</p>
                </div>

                {/* Connection Status */}
                <div className="absolute top-4 left-4">
                  <div 
                    className="flex items-center gap-1 text-white px-2 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                    Connected
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right - Chat Conversation */}
          <div 
            className="w-1/3"
            style={{ backgroundColor: 'var(--color-card)' }}
          >
            <ChatWindow
              conversation={conversation}
              isRecording={isRecording}
              isLoading={isLoading}
              onToggleRecording={toggleRecording}
              onToggleMute={() => {}} // Empty function since we removed mute functionality
              isMuted={isMuted}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default InterviewPage;