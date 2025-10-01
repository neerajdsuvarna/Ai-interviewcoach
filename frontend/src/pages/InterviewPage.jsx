import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PhoneOff } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useHeadTracking } from '@/hooks/useHeadTracking';
import { supabase } from '../supabaseClient';
import ChatWindow from '@/components/interview/ChatWindow';
import { trackEvents } from '../services/mixpanel';
import HeadTrackingAlert from '@/components/interview/HeadTrackingAlert';
import WarningModal from '@/components/interview/WarningModal';
import WaveAnimation from '@/components/interview/WaveAnimation';

function InterviewPage() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isValidated, setIsValidated] = useState(false);
  const [isValidating, setIsValidating] = useState(true); // ✅ RENAMED: Validation loading
  
  // ✅ ADD: Separate loading state for ChatWindow
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // ✅ ADD: Audio state for wave animation
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  
  // ✅ ADD: ChatWindow states for head tracking toggle
  const [chatStates, setChatStates] = useState({
    isRecording: false,
    isResponseInProgress: false,
    canEndInterview: true
  });

  // ✅ ADD: Callback to receive state changes from ChatWindow
  const handleChatStateChange = useCallback((newStates) => {
    setChatStates(newStates);
  }, []);
  
  // ✅ ADD: Track if validation has been attempted
  const hasValidated = useRef(false);
  
  // ✅ ADD MISSING STATE VARIABLES
  const [conversation, setConversation] = useState([
    {
      id: 1,
      speaker: 'interviewer',
      message: 'Speak to start the interview.',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  
  
  // Head tracking state
  const [headTrackingEnabled, setHeadTrackingEnabled] = useState(false); // Start disabled
  const [showHeadTrackingPopup, setShowHeadTrackingPopup] = useState(false);
  const [headTrackingStarted, setHeadTrackingStarted] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningType, setWarningType] = useState(null);
  
  // Mode tracking
  const [currentMode, setCurrentMode] = useState(null); // Track current mode
  
  // Track calibration state
  const [calibrationState, setCalibrationState] = useState('idle'); // 'idle', 'checking', 'ready', 'error', 'success'
  const [showCalibrationWarning, setShowCalibrationWarning] = useState(false);
  const [calibrationCheckTimer, setCalibrationCheckTimer] = useState(null);
  const [showCalibrationSuccess, setShowCalibrationSuccess] = useState(false);
  const readyForCalibrationRef = useRef(false);
  const calibrationInProgressRef = useRef(false);
  
  const streamRef = useRef(null);

  // Handle calibration success
  const handleCalibrationSuccess = useCallback(() => {
    setCalibrationState('success');
    setShowCalibrationSuccess(true);
    
    // Clear any ongoing calibration check timer
    if (calibrationCheckTimer) {
      clearTimeout(calibrationCheckTimer);
      setCalibrationCheckTimer(null);
    }
    // Reset the calibration progress flag
    calibrationInProgressRef.current = false;
    console.log('🎉 Calibration completed successfully');
    
    // Auto-hide success message after 3 seconds
    setTimeout(() => {
      setShowCalibrationSuccess(false);
      setCalibrationState('idle');
    }, 3000);
  }, [calibrationCheckTimer]);

  // Initialize head tracking
  const {
    isCalibrated,
    isLooking,
    isConnected,
    error,
    personStatus,
    readyForCalibration,
    calibrationMessage,
    videoRef,
    startFrameSending,
    stopFrameSending,
    startCalibration,
    pauseFrameSending,
    resumeFrameSending,
    startMonitoring,
    stopMonitoring
  } = useHeadTracking(headTrackingEnabled, handleCalibrationSuccess);

  // Show head tracking popup when user enables the toggle
  useEffect(() => {
    if (headTrackingEnabled && !headTrackingStarted) {
      // Show popup when user enables head tracking
      setShowHeadTrackingPopup(true);
    }
  }, [headTrackingEnabled, headTrackingStarted]);

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
  }, [videoRef]);

  // Handle warning modal display - show warnings immediately
  useEffect(() => {
    if (!headTrackingStarted || !headTrackingEnabled) return; // Only show warnings if head tracking is active

    // Skip warning checks if warning is already displayed
    if (showWarningModal) {
      return;
    }

    // Add a small delay after warning closes to allow backend to update isLooking state
    const timeoutId = setTimeout(() => {
      // Eye tracking warnings - show immediately when not looking
      const warningConditionMet = isCalibrated && !isLooking;
      console.log(`🔍 Warning condition check: isCalibrated=${isCalibrated}, !isLooking=${!isLooking}, conditionMet=${warningConditionMet}`);
      
      if (warningConditionMet) {
        console.log('🚨 Showing head tracking warning (eye contact)');
        setWarningType('eye_contact');
        setShowWarningModal(true);
        setCurrentMode('head_tracking');
        // Pause monitoring while warning is shown
        pauseFrameSending();
      } else if (isCalibrated && isLooking) {
        console.log('✅ User is looking at camera, no warning needed');
      } else if (!isCalibrated) {
        console.log('⚠️ Not calibrated yet, skipping warning check');
      }
    }, 500); // 500ms delay to allow backend to process new frames

    return () => clearTimeout(timeoutId);
  }, [headTrackingStarted, headTrackingEnabled, isCalibrated, isLooking, showWarningModal, pauseFrameSending]);

  // Update mode when switching
  useEffect(() => {
    if (headTrackingEnabled) {
      // Switching to head tracking mode
      if (currentMode !== 'head_tracking') {
        setCurrentMode('head_tracking');
        console.log('🔄 Switched to head tracking mode');
      }
    } else {
      // No monitoring when head tracking is disabled
      if (currentMode !== 'disabled') {
        setCurrentMode('disabled');
        console.log('🔄 Disabled monitoring');
      }
    }
  }, [headTrackingEnabled, currentMode]);

  // Initialize current mode on first render
  useEffect(() => {
    if (currentMode === null) {
      setCurrentMode('disabled'); // Start with no monitoring
      setHeadTrackingStarted(false); // Don't start monitoring initially
    }
  }, [currentMode]);

  // Start monitoring when video is ready and monitoring is confirmed
  useEffect(() => {
    console.log(`🔍 Monitoring check: videoRef=${!!videoRef.current}, isConnected=${isConnected}, headTrackingStarted=${headTrackingStarted}, showHeadTrackingPopup=${showHeadTrackingPopup}`);
    
    if (videoRef.current && headTrackingStarted && !showHeadTrackingPopup) {
      const handleVideoReady = () => {
        console.log('🎥 Video ready, starting monitoring...');
        startMonitoring();
        
        // Don't start calibration immediately - wait for user to be ready
        // Calibration will start automatically when readyForCalibration becomes true
      };

      if (videoRef.current.readyState >= 2) {
        handleVideoReady();
      } else {
        videoRef.current.addEventListener('loadeddata', handleVideoReady);
        return () => {
          videoRef.current?.removeEventListener('loadeddata', handleVideoReady);
        };
      }
    }
  }, [videoRef, isConnected, headTrackingStarted, showHeadTrackingPopup, startMonitoring]);

  // Handle calibration check process
  const startCalibrationCheck = useCallback(() => {
    // Prevent multiple calibration checks from running simultaneously
    if (calibrationInProgressRef.current) {
      console.log('⚠️ Calibration check already in progress, skipping...');
      return;
    }
    
    console.log('🔍 Starting 5-second calibration check...');
    calibrationInProgressRef.current = true;
    setCalibrationState('checking');
    
    // Check for 5 seconds
    const timer = setTimeout(() => {
      console.log('⏰ 5-second check completed');
      // Get the current readyForCalibration value at the time of check
      const currentReadyForCalibration = readyForCalibrationRef.current;
      console.log(`🔍 Current readyForCalibration state: ${currentReadyForCalibration}`);
      
      if (currentReadyForCalibration && !isCalibrated) {
        console.log('✅ User is ready, starting calibration');
        setCalibrationState('ready');
        startCalibration();
      } else if (currentReadyForCalibration && isCalibrated) {
        console.log('✅ User is ready but already calibrated, skipping calibration');
        setCalibrationState('idle');
        calibrationInProgressRef.current = false;
      } else {
        console.log('❌ User not ready, showing warning modal');
        setCalibrationState('error');
        setShowCalibrationWarning(true);
        pauseFrameSending(); // Stop sending frames
      }
    }, 5000);
    
    setCalibrationCheckTimer(timer);
  }, [startCalibration, pauseFrameSending, isCalibrated]);

  // Handle calibration warning modal close
  const handleCalibrationWarningClose = useCallback(() => {
    console.log('🔄 User acknowledged warning, restarting check...');
    setShowCalibrationWarning(false);
    setCalibrationState('checking');
    resumeFrameSending(); // Resume sending frames
    
    // Start another 5-second check
    const timer = setTimeout(() => {
      console.log('⏰ Second 5-second check completed');
      // Get the current readyForCalibration value at the time of check
      const currentReadyForCalibration = readyForCalibrationRef.current;
      console.log(`🔍 Current readyForCalibration state: ${currentReadyForCalibration}`);
      
      if (currentReadyForCalibration && !isCalibrated) {
        console.log('✅ User is now ready, starting calibration');
        setCalibrationState('ready');
        startCalibration();
      } else if (currentReadyForCalibration && isCalibrated) {
        console.log('✅ User is ready but already calibrated, skipping calibration');
        setCalibrationState('idle');
        calibrationInProgressRef.current = false;
      } else {
        console.log('❌ User still not ready, showing warning again');
        setCalibrationState('error');
        setShowCalibrationWarning(true);
        pauseFrameSending(); // Stop sending frames again
      }
    }, 5000);
    
    setCalibrationCheckTimer(timer);
  }, [startCalibration, pauseFrameSending, resumeFrameSending, isCalibrated]);

  // Update ref when readyForCalibration changes
  useEffect(() => {
    readyForCalibrationRef.current = readyForCalibration;
  }, [readyForCalibration]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (calibrationCheckTimer) {
        clearTimeout(calibrationCheckTimer);
      }
      // Reset calibration progress flag
      calibrationInProgressRef.current = false;
    };
  }, [calibrationCheckTimer]);

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
        
        // ✅ UPDATED: Handle PENDING status
        if (interview.status === 'PENDING') {
          console.log('⏳ Interview is pending payment confirmation...');
          // Show loading state while waiting for payment confirmation
          setIsValidating(true);
          // You could add polling here or just show a message
          return;
        }

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

  // Handle head tracking confirmation
  const confirmHeadTracking = () => {
    setShowHeadTrackingPopup(false);
    setHeadTrackingStarted(true);
    console.log('🚀 Head tracking confirmed and started');
    
    // Start calibration check after a short delay to allow monitoring to start
    setTimeout(() => {
      console.log('⏰ Starting calibration check process...');
      startCalibrationCheck();
    }, 1000);
  };

  // Toggle head tracking on/off
  const toggleHeadTracking = () => {
    const newMode = !headTrackingEnabled;
    console.log(`🔄 Toggle requested: ${headTrackingEnabled} → ${newMode}`);
    setHeadTrackingEnabled(newMode);
    
    if (newMode) {
      // Switching TO head tracking - start fresh calibration session
      console.log('🔄 Setting up head tracking mode...');
      setCurrentMode('head_tracking');
      setHeadTrackingStarted(false); // Reset to show popup again
      setCalibrationState('idle'); // Reset calibration state
      
      // Reset all head tracking state for fresh session
      setShowWarningModal(false);
      setWarningType(null);
      
      // Clear any existing calibration check timers
      if (calibrationCheckTimer) {
        clearTimeout(calibrationCheckTimer);
        setCalibrationCheckTimer(null);
      }
      
      console.log('🔄 Toggled to head tracking - will show popup for calibration');
    } else {
      // Switching OFF head tracking - stop all monitoring
      setCurrentMode('disabled');
      setHeadTrackingStarted(false); // Stop monitoring
      
      // Clean up head tracking session
      setShowHeadTrackingPopup(false);
      setCalibrationState('idle');
      setShowWarningModal(false);
      setWarningType(null);
      
      // Reset calibration progress flag
      calibrationInProgressRef.current = false;
      
      console.log('🔄 Toggled off head tracking - stopped all monitoring');
    }
  };

  // Handle warning modal close
  const closeWarningModal = () => {
    setShowWarningModal(false);
    
    // Resume monitoring after user acknowledges warning
    setTimeout(() => {
      resumeFrameSending();
    }, 1000); // Small delay to ensure user has time to adjust
    
    console.log(`✅ Monitoring resumed for ${currentMode} mode`);
  };

  const endInterview = () => {
    // Note: Interview completion and feedback generation events are tracked in ChatWindow.jsx
    // when the backend confirms completion with interview_done: true, not here when button is clicked
    
    // Stop monitoring
    stopMonitoring();
    
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
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto mb-4"></div>
          <p className="text-[var(--color-text-secondary)]">Validating interview session...</p>
        </div>
      </div>
    );
  }

  // Show error if not validated
  if (!isValidated) {
    return null; // Will redirect to /upload
  }

  // Original interview page content
  return (
    <>
      {/* Head Tracking Alert */}
      <HeadTrackingAlert 
        isCalibrated={isCalibrated}
        isConnected={isConnected}
        error={error}
        headTrackingEnabled={headTrackingEnabled}
        readyForCalibration={readyForCalibration}
        calibrationMessage={calibrationMessage}
        calibrationState={calibrationState}
        showCalibrationSuccess={showCalibrationSuccess}
      />

      {/* Head Tracking Confirmation Popup */}
      <AnimatePresence>
        {showHeadTrackingPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Head Tracking Ready
                </h3>
                
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  We're ready to start monitoring your head position and eye contact during the interview. This helps ensure professional conduct.
                </p>
                
                <button
                  onClick={confirmHeadTracking}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
                >
                  Start Head Tracking
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Warning Modal */}
      <WarningModal
        isOpen={showWarningModal}
        onClose={closeWarningModal}
        warningType={warningType}
        headTrackingEnabled={headTrackingEnabled}
      />

      {/* Calibration Warning Modal */}
      <AnimatePresence>
        {showCalibrationWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Camera Position Required
                </h3>
                
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Please position yourself directly in front of the camera and look straight ahead. The system needs to detect your face and eye position for accurate head tracking calibration.
                </p>
                
                <button
                  onClick={handleCalibrationWarningClose}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
                >
                  OK, I'm Ready
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
        {/* Top Bar with End Interview Button */}
        <div 
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-b"
          style={{ 
            backgroundColor: 'var(--color-card)',
            borderColor: 'var(--color-border)' 
          }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <div className="flex flex-col">
                <h1 
                  className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight leading-tight"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  AI Interview Session
                </h1>
              </div>
              
              {/* Monitoring Status */}
              {headTrackingStarted && headTrackingEnabled && (
                <div className="flex items-center gap-1.5 bg-green-500/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg border border-green-400/30">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span className="tracking-wide text-xs hidden xs:inline">HEAD TRACKING</span>
                  <span className="tracking-wide text-xs xs:hidden">HT</span>
                </div>
              )}
            </div>
          </div>

          {/* Head Tracking Toggle */}
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <label className={`flex items-center gap-2 sm:gap-3 ${isAudioPlaying || chatStates.isRecording || isChatLoading || chatStates.isResponseInProgress ? 'cursor-not-allowed opacity-60' : 'cursor-pointer group'}`}>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={headTrackingEnabled}
                  onChange={(e) => setHeadTrackingEnabled(e.target.checked)}
                  disabled={isAudioPlaying || chatStates.isRecording || isChatLoading || chatStates.isResponseInProgress}
                  className="sr-only peer"
                />
                <div className={`
                  w-10 h-6 sm:w-12 sm:h-7 rounded-full transition-all duration-300 ease-in-out shadow-inner flex items-center
                  peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-offset-2
                  ${isAudioPlaying || chatStates.isRecording || isChatLoading || chatStates.isResponseInProgress
                    ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed opacity-60'
                    : headTrackingEnabled 
                      ? 'bg-blue-500 peer-focus:ring-blue-500/20 shadow-lg' 
                      : 'bg-gray-300 dark:bg-gray-600 peer-focus:ring-gray-500/20 shadow-inner'
                  }
                `}>
                  <div className={`
                    w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full shadow-lg transition-all duration-300 ease-in-out mx-0.5 sm:mx-1
                    ${headTrackingEnabled ? 'translate-x-4 sm:translate-x-5' : 'translate-x-0'}
                  `}></div>
                </div>
              </div>
              <span className={`text-xs sm:text-sm font-medium ${isAudioPlaying || chatStates.isRecording || isChatLoading || chatStates.isResponseInProgress ? 'opacity-60' : ''}`} style={{ color: 'var(--color-text-primary)' }}>
                Head Tracking
              </span>
            </label>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row min-h-0 xl:h-[calc(100vh-80px)]">
          {/* Left - Interviewer Video */}
          <div 
            className="w-full xl:w-1/3 border-b xl:border-b-0 xl:border-r p-3 sm:p-4 lg:p-6 flex-shrink-0"
            style={{ 
              backgroundColor: 'var(--color-card)', 
              borderColor: 'var(--color-border)' 
            }}
          >
            <div className="h-full flex flex-col">
              {/* Interviewer Video Container */}
              <div 
                className="h-40 sm:h-52 md:h-64 lg:h-72 xl:flex-1 relative rounded-xl sm:rounded-2xl overflow-hidden shadow-lg border flex items-center justify-center"
                style={{ 
                  borderColor: isAudioPlaying ? 'var(--color-primary)' : 'var(--color-border)', 
                  backgroundColor: 'var(--color-bg)',
                  borderWidth: isAudioPlaying ? '3px' : '1px'
                }}
              >
                {/* Interviewer Image and Info Container */}
                <div className="flex flex-col items-center">
                  {/* Interviewer Image - Circular with Wave Animation */}
                  <div className="relative mb-2 sm:mb-4">
                    <motion.img
                      src="/assets/interview/interviewer_1.png"
                      alt="Sadhan"
                      className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 xl:w-40 xl:h-40 object-cover rounded-full border-2 sm:border-4 shadow-xl relative z-10"
                      style={{
                        borderColor: isAudioPlaying ? 'var(--color-primary)' : 'white'
                      }}
                      animate={isAudioPlaying ? {
                        borderWidth: ['2px', '3px', '2px', '4px', '2px', '3px', '2px'], // Responsive border changes
                        scale: [1, 1.01, 1, 1.02, 1, 1.01, 1], // Very subtle breathing effect
                      } : {
                        borderWidth: '2px',
                        scale: 1
                      }}
                      transition={isAudioPlaying ? {
                        duration: 2.5, // Match the first wave timing
                        repeat: Infinity,
                        ease: "easeInOut",
                        times: [0, 0.2, 0.4, 0.6, 0.8, 0.9, 1], // Match the first wave timing
                      } : {
                        duration: 0.3
                      }}
                    />
                    
                    {/* Wave Animation Overlay */}
                    <WaveAnimation 
                      isActive={isAudioPlaying || isChatLoading} 
                      size={140} // Base wave size (will be scaled responsively)
                      imageSize={128} // Image size
                      listening={isChatLoading} // Use listening pattern when processing
                    />
                  </div>
                  
                </div>
                
                {/* Live Indicator */}
                <div className="absolute top-2 sm:top-4 left-2 sm:left-4">
                  <div className="flex items-center gap-1 sm:gap-2 bg-green-500/90 backdrop-blur-sm text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-semibold shadow-lg border border-green-400/30">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse"></div>
                    <span className="tracking-wide text-xs">LIVE</span>
                  </div>
                </div>

                {/* Interviewer Label */}
                <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4">
                  <h3 
                    className="font-bold text-sm sm:text-base md:text-lg lg:text-xl mb-1 drop-shadow-lg"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Sadhan
                  </h3>
                </div>
              </div>
            </div>
          </div>

          {/* Middle - User Camera */}
          <div 
            className="w-full xl:w-1/3 border-b xl:border-b-0 xl:border-r p-3 sm:p-4 lg:p-6 flex-shrink-0" 
            style={{ 
              backgroundColor: 'var(--color-card)', 
              borderColor: 'var(--color-border)' 
            }}
          >
            <div className="h-full flex flex-col">
              {/* User Video Container */}
              <div 
                className="h-40 sm:h-52 md:h-64 lg:h-72 xl:flex-1 relative rounded-xl sm:rounded-2xl overflow-hidden shadow-lg border"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted={true}
                  className="w-full h-full object-cover"
                />

                
                {/* User Camera Label */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 sm:p-4 md:p-6">
                  <h3 
                    className="font-bold text-sm sm:text-base md:text-lg lg:text-xl mb-1 text-white drop-shadow-lg"
                  >
                    Your Camera
                  </h3>
                </div>

                {/* Connection Status */}
                <div className="absolute top-2 sm:top-4 left-2 sm:left-4">
                  <div 
                    className="flex items-center gap-1 sm:gap-2 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-semibold shadow-lg border border-white/20 backdrop-blur-sm"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full"></div>
                    <span className="tracking-wide text-xs">CONNECTED</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right - Chat Conversation */}
          <div 
            className="w-full xl:w-1/3 flex-1 min-h-0 flex flex-col"
            style={{ backgroundColor: 'var(--color-card)' }}
          >
            <ChatWindow
              conversation={conversation}
              setConversation={setConversation}
              isLoading={isChatLoading}
              setIsLoading={setIsChatLoading}
              isAudioPlaying={isAudioPlaying}
              setIsAudioPlaying={setIsAudioPlaying}
              onStateChange={handleChatStateChange}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default InterviewPage;