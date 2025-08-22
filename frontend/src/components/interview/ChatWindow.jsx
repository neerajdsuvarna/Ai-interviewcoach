import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';
import { uploadFile, apiPost } from '../../api';

function ChatWindow({ conversation, setConversation, isLoading, setIsLoading }) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const messagesEndRef = useRef(null);

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
      
      const response = await apiPost('/api/generate-response', {
        message: userInput, // Changed from user_input to message
        model_name: 'llama3', // You can make this configurable
        candidate_name: 'default' // You can make this configurable
      });

      console.log('📥 Interview Manager response:', response);

      if (response.success) {
        const interviewerMessage = {
          id: Date.now() + 1,
          speaker: 'interviewer',
          message: response.data.response,
          timestamp: new Date().toLocaleTimeString()
        };
        
        setConversation(prev => [...prev, interviewerMessage]);
        console.log('✅ Interviewer response added');
      } else {
        console.error('❌ Interview Manager API failed:', response.message);
        // Add error message to conversation
        const errorMessage = {
          id: Date.now() + 1,
          speaker: 'system',
          message: `Interview response failed: ${response.message || 'Unknown error'}`,
          timestamp: new Date().toLocaleTimeString()
        };
        setConversation(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('❌ Error calling Interview Manager API:', error);
      // Add error message to conversation
      const errorMessage = {
        id: Date.now() + 1,
        speaker: 'system',
        message: `Error getting interview response: ${error.message}`,
        timestamp: new Date().toLocaleTimeString()
      };
      setConversation(prev => [...prev, errorMessage]);
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
      }
    }
  };

  return (
    <div 
      className="h-full flex flex-col p-4 lg:p-6"
      style={{ 
        backgroundColor: 'var(--color-card)',
        borderLeft: '1px solid var(--color-border)'
      }}
    >
      {/* Header with Title and Mic Button */}
      <div className="flex items-center justify-between mb-4">
        <h2 
          className="text-xl md:text-2xl font-bold tracking-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Interview Conversation
        </h2>
        
        {/* Single Recording Button */}
        <div className="flex items-center gap-3">
          {/* Recording Status Indicator */}
          {isRecording && (
            <div className="flex items-center gap-2 bg-red-500/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg border border-red-400/30">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="tracking-wide">RECORDING</span>
            </div>
          )}
          
          <button
            onClick={toggleRecording}
            className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-semibold transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 ${
              isRecording 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
            title={isRecording ? 'Stop Recording' : 'Start Recording'}
          >
            {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
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
    </div>
  );
}

export default ChatWindow;