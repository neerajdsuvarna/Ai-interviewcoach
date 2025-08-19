import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';
import { uploadFile } from '../../api';


function ChatWindow({ conversation, setConversation, isLoading, setIsLoading }) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  // Cleanup function to stop media stream when component unmounts
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      console.log('🛑 Stopping recording...');
      setIsRecording(false);
      setIsLoading(true);
      
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
                id: conversation.length + 1,
                speaker: 'candidate',
                message: transcription,
                timestamp: new Date().toLocaleTimeString()
              };
              
              setConversation(prev => [...prev, newMessage]);
              
              // Simulate interviewer's follow-up question
              setTimeout(() => {
                const followUp = {
                  id: conversation.length + 2,
                  speaker: 'interviewer',
                  message: 'Thank you for that response. Can you tell me more about your experience with team leadership and how you handle challenging situations?',
                  timestamp: new Date().toLocaleTimeString()
                };
                setConversation(prev => [...prev, followUp]);
                setIsLoading(false);
              }, 2000);
            } else {
              // No speech detected
              const newMessage = {
                id: conversation.length + 1,
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
              id: conversation.length + 1,
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
            id: conversation.length + 1,
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
        console.log('✅ Recording started successfully');
        
      } catch (error) {
        console.error('❌ Error starting recording:', error);
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
      style={{ color: 'var(--color-text-secondary)' }}
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div 
              className="max-w-[85%] p-4 rounded-lg border"
              style={{ 
                backgroundColor: 'var(--color-input-bg)',
                borderColor: 'var(--color-border)'
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span 
                  className="text-xs font-medium px-2 py-1 rounded-full"
                  style={{ 
                    backgroundColor: 'var(--color-border)',
                    color: 'var(--color-text-secondary)'
                  }}
                >
                  Interviewer
                </span>
                <span 
                  className="text-xs"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Typing...
                </span>
              </div>
              <div className="flex space-x-1">
                <div 
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ backgroundColor: 'var(--color-text-secondary)' }}
                ></div>
                <div 
                  className="w-2 h-2 rounded-full animate-bounce" 
                  style={{ 
                    backgroundColor: 'var(--color-text-secondary)',
                    animationDelay: '0.1s' 
                  }}
                ></div>
                <div 
                  className="w-2 h-2 rounded-full animate-bounce" 
                  style={{ 
                    backgroundColor: 'var(--color-text-secondary)',
                    animationDelay: '0.2s' 
                  }}
                ></div>
              </div>
            </div>
          </motion.div>
        )}
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