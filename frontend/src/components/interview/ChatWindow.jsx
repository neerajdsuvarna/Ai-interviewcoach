import React, { useState, useRef, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Square } from 'lucide-react'; // ✅ Add Square icon for end button
import { uploadFile, apiPost, apiDelete } from '../../api';
import { useAuth } from '../../contexts/AuthContext'; // ✅ Use useAuth hook
import { supabase } from '../../supabaseClient'; // ✅ Import supabase client

function ChatWindow({ conversation, setConversation, isLoading, setIsLoading }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  // ✅ Use useAuth hook to get user
  const { user } = useAuth();

  // Add this state for loading
  const [isEndingInterview, setIsEndingInterview] = useState(false);

  // Auto-scroll to bottom when new messages are added
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  // Cleanup function to stop media stream when component unmounts
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Debug loading state changes
  useEffect(() => {
    console.log('🔄 Loading state changed to:', isLoading);
  }, [isLoading]);

  // Function to call Interview Manager API
  const callInterviewManager = async (userInput) => {
    try {
      console.log('🤖 Calling Interview Manager API with:', userInput);
      
      // ✅ Get interview_id from URL
      const urlParams = new URLSearchParams(window.location.search);
      const interviewId = urlParams.get('interview_id');
      
      if (!interviewId) {
        console.error('❌ No interview_id found in URL');
        return;
      }
      
      const response = await apiPost('/api/generate-response', {
        message: userInput,
        interview_id: interviewId // ✅ Send interview_id to backend
      });

      console.log('📥 Interview Manager response:', response);
      
      if (response.success) {
        const { response: textResponse, audio_url, should_delete_audio } = response.data;
        
        const newMessage = {
          id: Date.now(),
          speaker: 'interviewer',
          message: textResponse,
          timestamp: new Date().toLocaleTimeString()
        };
        
        setConversation(prev => [...prev, newMessage]);
        console.log('✅ Interviewer response added');
        
        // ✅ NEW: Play audio if available
        if (audio_url) {
          console.log('🔊 Playing audio response:', audio_url);
          const audio = new Audio(audio_url);
          
          // ✅ NEW: Delete audio file after playback
          audio.onended = async () => {
            if (should_delete_audio) {
              try {
                console.log('🗑️ Deleting audio file after playback...');
                console.log('🗑️ Audio URL to delete:', audio_url);
                
                // ✅ FIXED: Use apiDelete instead of apiPost
                await apiDelete('/api/delete-audio', {
                  body: { audio_url }
                });
                console.log('✅ Audio file deleted successfully');
              } catch (error) {
                console.error('❌ Failed to delete audio file:', error);
                console.error('❌ Error details:', error.message);
              }
            } else {
              console.log('ℹ️ Audio deletion skipped (should_delete_audio is false)');
            }
          };
          
          // ✅ NEW: Handle audio play errors
          audio.onerror = (error) => {
            console.error('❌ Audio playback failed:', error);
          };
          
          // ✅ NEW: Play the audio
          audio.play().catch(error => {
            console.error('❌ Failed to play audio:', error);
          });
        } else {
          console.log('ℹ️ No audio URL provided in response');
        }
      } else {
        console.error('❌ Interview Manager API error:', response.message);
      }
    } catch (error) {
      console.error('❌ Error calling Interview Manager:', error);
    }
  };

  // Update the handleEndInterview function
  const handleEndInterview = async () => {
    const confirmed = window.confirm('Are you sure you want to end the interview? This action cannot be undone.');
    
    if (confirmed) {
      console.log('✅ User confirmed ending interview');
      
      // ✅ NEW: Show loading state
      setIsEndingInterview(true);
      
      try {
        // ✅ NEW: Send END_INTERVIEW command to backend
        console.log('📤 Sending END_INTERVIEW command to backend...');
        
        // Get interview_id from URL
        const urlParams = new URLSearchParams(window.location.search);
        const interviewId = urlParams.get('interview_id');
        
        if (!interviewId) {
          console.error('❌ No interview_id found in URL');
          setIsEndingInterview(false); // Hide loading
          return;
        }
        
        // ✅ Use the same apiPost function that works for normal responses
        const response = await apiPost('/api/generate-response', {
          message: 'END_INTERVIEW',
          interview_id: interviewId
        });
        
        console.log('📥 End interview response:', response);
        
        if (response.success) {
          const { response: textResponse, audio_url, should_delete_audio, interview_done } = response.data;
          
          // Add the final response to conversation
          const newMessage = {
            id: Date.now(),
            speaker: 'interviewer',
            message: textResponse,
            timestamp: new Date().toLocaleTimeString()
          };
          
          setConversation(prev => [...prev, newMessage]);
          
          // ✅ NEW: Play audio for final response (if available)
          if (audio_url) {
            console.log('🔊 Playing final audio response:', audio_url);
            const audio = new Audio(audio_url);
            
            audio.onended = async () => {
              if (should_delete_audio) {
                try {
                  console.log('🗑️ Deleting final audio file after playback...');
                  console.log('🗑️ Final audio URL to delete:', audio_url);
                  
                  // ✅ FIXED: Use apiDelete instead of apiPost
                  await apiDelete('/api/delete-audio', {
                    body: { audio_url }
                  });
                  console.log('✅ Final audio file deleted successfully');
                } catch (error) {
                  console.error('❌ Failed to delete final audio file:', error);
                  console.error('❌ Error details:', error.message);
                }
              }
              
              // ✅ NEW: Redirect to feedback page after audio finishes
              if (interview_done) {
                console.log('🎯 Interview completed, redirecting to feedback...');
                // Add a small delay to ensure audio deletion completes
                setTimeout(() => {
                  window.location.href = `/interview-feedback?interview_id=${interviewId}`;
                }, 1000);
              }
            };
            
            audio.play().catch(error => {
              console.error('❌ Failed to play final audio:', error);
              // Still redirect even if audio fails
              if (interview_done) {
                window.location.href = `/interview-feedback?interview_id=${interviewId}`;
              }
            });
          } else if (interview_done) {
            // ✅ NEW: If no audio but interview is done, redirect immediately
            console.log('🎯 Interview completed (no audio), redirecting to feedback...');
            window.location.href = `/interview-feedback?interview_id=${interviewId}`;
          }
          
        } else {
          console.error('❌ End interview API error:', response.message);
          // ✅ NEW: Hide loading on error
          setIsEndingInterview(false);
        }
      } catch (error) {
        console.error('❌ Error ending interview:', error);
        // ✅ NEW: Hide loading on error
        setIsEndingInterview(false);
      }
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      console.log('🛑 Stopping recording...');
      setIsRecording(false);
      setIsLoading(true);
      console.log('🔄 Loading state set to true');
      
      try {
        // Stop the media recorder
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        
        // Wait for the recording to finish
        await new Promise((resolve) => {
          if (mediaRecorderRef.current) {
            mediaRecorderRef.current.onstop = resolve;
          } else {
            resolve();
          }
        });
        
        // Create audio blob from chunks
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = []; // Reset chunks
        
        // Stop the media stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        console.log('🎵 Audio recording completed, blob size:', audioBlob.size, 'bytes');
        
        // Send audio to backend for transcription
        console.log('📤 Sending audio to backend for transcription...');
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          
          const result = await uploadFile('/api/transcribe-audio', formData);
          
          console.log('📥 Backend response:', result);
          
          if (result.success) {
            const transcription = result.data.transcription;
            
            if (transcription && transcription.trim()) {
              // Add candidate's response to conversation
              const newMessage = {
                id: Date.now(), // Use timestamp as unique ID
                speaker: 'candidate',
                message: transcription,
                timestamp: new Date().toLocaleTimeString()
              };
              
              setConversation(prev => [...prev, newMessage]);
              console.log('✅ Candidate message added');
              setIsLoading(false); // Stop loading immediately after user message appears
              
              // Call Interview Manager API to get the next question/response
              await callInterviewManager(transcription);
              
            } else {
              // No speech detected
              console.log('⚠️ No speech detected');
              const newMessage = {
                id: Date.now(), // Use timestamp as unique ID
                speaker: 'candidate',
                message: '[No speech detected]',
                timestamp: new Date().toLocaleTimeString()
              };
              setConversation(prev => [...prev, newMessage]);
              setIsLoading(false);
            }
          } else {
            console.error('❌ Transcription failed:', result.message);
            // Add error message to conversation
            const errorMessage = {
              id: Date.now(), // Use timestamp as unique ID
              speaker: 'system',
              message: `Transcription failed: ${result.message || 'Unknown error'}`,
              timestamp: new Date().toLocaleTimeString()
            };
            setConversation(prev => [...prev, errorMessage]);
            setIsLoading(false);
          }
          
        } catch (error) {
          console.error('❌ Error sending audio to backend:', error);
          // Add error message to conversation
          const errorMessage = {
            id: Date.now(), // Use timestamp as unique ID
            speaker: 'system',
            message: `Error processing audio: ${error.message}`,
            timestamp: new Date().toLocaleTimeString()
          };
          setConversation(prev => [...prev, errorMessage]);
          setIsLoading(false);
        }
        
      } catch (error) {
        console.error('❌ Error processing audio:', error);
        setIsLoading(false);
      }
      
    } else {
      // Start recording
      console.log('🎙️ Starting recording...');
      
      // Disable button for 3 seconds to prevent edge cases
      setIsButtonDisabled(true);
      setTimeout(() => {
        setIsButtonDisabled(false);
      }, 3000);
      
      try {
        // Get user media stream
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true,
          video: false
        });
        
        // Store stream reference for cleanup
        streamRef.current = stream;
        
        // Create a new MediaRecorder
        mediaRecorderRef.current = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        
        // Set up event handlers
        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        // Start recording
        mediaRecorderRef.current.start();
        setIsRecording(true);
        console.log('✅ Recording started');
        
      } catch (error) {
        console.error('❌ Error starting recording:', error);
        alert('Failed to start recording. Please check microphone permissions.');
        setIsButtonDisabled(false); // Re-enable button if recording fails
      }
    }
  };

  // Add the loading popup component
  const LoadingPopup = () => {
    if (!isEndingInterview) return null;
    
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl border border-gray-200/50 animate-in zoom-in-95 duration-300">
          {/* Animated Icon */}
          <div className="relative mb-6">
            <div className="w-16 h-16 mx-auto relative">
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full border-4 border-blue-100 animate-pulse"></div>
              {/* Spinning ring */}
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 border-r-blue-500 animate-spin"></div>
              {/* Inner circle */}
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                <div className="w-3 h-3 bg-blue-600 rounded-full animate-ping"></div>
              </div>
            </div>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-gray-900 mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Ending Interview
          </h3>

          {/* Progress Steps */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-center space-x-3 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-gray-600">Generating interview summary...</span>
            </div>
            <div className="flex items-center justify-center space-x-3 text-sm">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-gray-600">Saving feedback and evaluation...</span>
            </div>
            <div className="flex items-center justify-center space-x-3 text-sm">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
              <span className="text-gray-600">Preparing your results...</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4 overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full animate-pulse" 
                 style={{ width: '100%' }}></div>
          </div>

          {/* Message */}
          <p className="text-gray-600 text-sm leading-relaxed">
            Please wait while we process your interview data and generate comprehensive feedback.
          </p>
          
          {/* Subtitle */}
          <p className="text-xs text-gray-500 mt-3 font-medium">
            This usually takes 10-15 seconds
          </p>

          {/* Decorative Elements */}
          <div className="absolute top-4 right-4">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          </div>
          <div className="absolute bottom-4 left-4">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
          </div>
          <div className="absolute top-4 left-4">
            <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
          </div>
          <div className="absolute bottom-4 right-4">
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '600ms' }}></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="h-full flex flex-col p-4 lg:p-6"
      style={{ 
        backgroundColor: 'var(--color-card)',
        borderLeft: '1px solid var(--color-border)'
      }}
    >
      {/* Header with Title and Buttons */}
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex items-center justify-between">
          <h2 
            className="text-xl md:text-2xl font-bold tracking-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Interview Conversation
          </h2>
          
          {/* End Interview Button */}
          <button
            onClick={handleEndInterview}
            className="ml-auto px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 text-xs sm:text-sm md:text-base bg-transparent border-2 font-semibold rounded-full transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 whitespace-nowrap"
            style={{
              borderColor: 'var(--color-error)',
              color: 'var(--color-error)',
              backgroundColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'var(--color-error)';
              e.target.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.color = 'var(--color-error)';
            }}
            title="End Interview"
          >
            <span className="hidden sm:inline">End Interview</span>
            <span className="sm:hidden">End</span>
          </button>
        </div>
        
        {/* Pill-shaped Recording Button */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={toggleRecording}
            disabled={isButtonDisabled}
            className={`w-full px-8 py-4 rounded-full flex items-center justify-center gap-3 text-white font-semibold transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 ${
              isButtonDisabled
                ? 'bg-gray-400 cursor-not-allowed opacity-60'
                : isRecording 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-blue-500 hover:bg-blue-600'
            }`}
            title={isRecording ? 'Stop Recording' : 'Speak Now'}
          >
            {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
            <span className="text-sm font-medium">
              {isRecording ? 'Stop Recording' : 'Speak Now'}
            </span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2">
        <AnimatePresence>
          {conversation.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex ${message.speaker === 'interviewer' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[85%] p-5 rounded-2xl shadow-lg ${
                  message.speaker === 'interviewer'
                    ? 'border border-[var(--color-border)]'
                    : 'border border-[var(--color-primary)]'
                }`}
                style={{
                  backgroundColor: message.speaker === 'interviewer' 
                    ? 'var(--color-input-bg)' 
                    : 'var(--color-primary)',
                  color: message.speaker === 'interviewer' 
                    ? 'var(--color-text-primary)' 
                    : 'white',
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span 
                    className={`text-xs font-bold px-3 py-1 rounded-full tracking-wide ${
                      message.speaker === 'interviewer'
                        ? 'bg-[var(--color-border)] text-[var(--color-text-secondary)]'
                        : 'bg-white/20 text-white'
                    }`}
                  >
                    {message.speaker === 'interviewer' ? 'INTERVIEWER' : 'YOU'}
                  </span>
                  <span 
                    className="text-xs font-medium opacity-70"
                    style={{ color: message.speaker === 'interviewer' ? 'var(--color-text-secondary)' : 'rgba(255,255,255,0.7)' }}
                  >
                    {message.timestamp}
                  </span>
                </div>
                <p className="text-sm md:text-base leading-relaxed font-medium">{message.message}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {/* Loading indicator for new messages */}
        {isLoading && (
          <motion.div
            key="loading-indicator"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex justify-end"
          >
            <div 
              className="max-w-[85%] p-4 rounded-lg border"
              style={{ 
                backgroundColor: 'var(--color-primary)',
                borderColor: 'var(--color-primary)',
                color: 'white'
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span 
                  className="text-xs font-bold px-3 py-1 rounded-full tracking-wide"
                  style={{ 
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    color: 'white'
                  }}
                >
                  YOU
                </span>
                <span 
                  className="text-xs"
                  style={{ color: 'rgba(255,255,255,0.8)' }}
                >
                  Processing audio...
                </span>
              </div>
              <div className="flex space-x-1">
                <div 
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ backgroundColor: 'rgba(255,255,255,0.8)' }}
                ></div>
                <div 
                  className="w-2 h-2 rounded-full animate-bounce" 
                  style={{ 
                    backgroundColor: 'rgba(255,255,255,0.8)',
                    animationDelay: '0.1s' 
                  }}
                ></div>
                <div 
                  className="w-2 h-2 rounded-full animate-bounce" 
                  style={{ 
                    backgroundColor: 'rgba(255,255,255,0.8)',
                    animationDelay: '0.2s' 
                  }}
                ></div>
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Auto-scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Instructions */}
      <div 
        className="text-center border-t pt-4"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <p 
          className="text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {isRecording 
            ? 'Click to stop recording and submit your response'
            : 'Click to start recording your response'
          }
        </p>
      </div>

      {/* Session Info */}
      <div 
        className="flex items-center justify-between text-xs pt-2 border-t mt-4"
        style={{ 
          color: 'var(--color-text-secondary)',
          borderColor: 'var(--color-border)' 
        }}
      >
      </div>

      {/* ✅ NEW: Loading popup */}
      <LoadingPopup />
    </div>
  );
}

export default ChatWindow;