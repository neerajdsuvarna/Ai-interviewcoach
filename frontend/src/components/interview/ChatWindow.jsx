import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

function ChatWindow({ conversation, isRecording, isLoading, onToggleRecording, onToggleMute, isMuted }) {
  return (
    <div 
      className="h-full flex flex-col p-6"
      style={{ 
        backgroundColor: 'var(--color-card)',
        borderLeft: '1px solid var(--color-border)'
      }}
    >
      {/* Header with Title and Mic Button */}
      <div className="flex items-center justify-between mb-4">
        <h2 
          className="text-lg font-semibold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Interview Conversation
        </h2>
        
        {/* Mic Button at Top */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMute}
            className={`p-2 rounded-full transition-all ${
              isMuted 
                ? 'border border-red-200' 
                : 'border border-gray-200 hover:opacity-80'
            }`}
            style={{ 
              backgroundColor: isMuted ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-input-bg)',
              color: isMuted ? '#ef4444' : 'var(--color-text-secondary)'
            }}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          <button
            onClick={onToggleRecording}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-medium transition-all shadow-lg ${
              isRecording 
                ? 'hover:opacity-80' 
                : 'hover:opacity-80'
            }`}
            style={{ 
              backgroundColor: isRecording ? '#ef4444' : 'var(--color-primary)'
            }}
          >
            {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
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
                className={`max-w-[85%] p-4 rounded-lg ${
                  message.speaker === 'interviewer'
                    ? 'border'
                    : 'border'
                }`}
                style={{
                  backgroundColor: message.speaker === 'interviewer' 
                    ? 'var(--color-input-bg)' 
                    : 'var(--color-primary)',
                  color: message.speaker === 'interviewer' 
                    ? 'var(--color-text-primary)' 
                    : 'white',
                  borderColor: message.speaker === 'interviewer' 
                    ? 'var(--color-border)' 
                    : 'var(--color-primary)'
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span 
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      message.speaker === 'interviewer'
                        ? ''
                        : 'bg-white/20'
                    }`}
                    style={{
                      backgroundColor: message.speaker === 'interviewer' 
                        ? 'var(--color-border)' 
                        : 'rgba(255, 255, 255, 0.2)',
                      color: message.speaker === 'interviewer' 
                        ? 'var(--color-text-secondary)' 
                        : 'white'
                    }}
                  >
                    {message.speaker === 'interviewer' ? 'Interviewer' : 'You'}
                  </span>
                  <span 
                    className="text-xs"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {message.timestamp}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{message.message}</p>
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
            : 'Click the microphone to begin your response'
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