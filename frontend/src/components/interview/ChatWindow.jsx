import React, { useState, useRef, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Square } from 'lucide-react'; // ✅ Add Square icon for end button
import { uploadFile, apiPost, apiDelete } from '../../api';
import { useAuth } from '../../contexts/AuthContext'; // ✅ Use useAuth hook
import { supabase } from '../../supabaseClient'; // ✅ Import supabase client
import { trackEvents } from '../../services/mixpanel';

function ChatWindow({ conversation, setConversation, isLoading, setIsLoading, isAudioPlaying, setIsAudioPlaying, onStateChange }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const [isListening, setIsListening] = useState(false); // VAD listening state
  const [audioLevel, setAudioLevel] = useState(0); // Current audio level for visualization
  const [vadStatus, setVadStatus] = useState('idle'); // 'idle', 'listening', 'speaking', 'processing'
  const [noiseLevel, setNoiseLevel] = useState('normal'); // 'quiet', 'normal', 'noisy'

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // VAD-specific refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const isVADInitialized = useRef(false);
  const isVADListening = useRef(false);
  const isVADRecording = useRef(false); // Ref-based listening state
  const audioHistoryRef = useRef([]); // Store audio samples for voice pattern analysis

  // VAD Configuration (Professional settings)
  const VAD_CONFIG = {
      voiceThreshold: 0.02,
      silenceThreshold: 0.01,
      silenceTimeout: 2000,        // Stop recording after 2s silence
      minRecordingDuration: 500,   // Minimum recording length (ms)
      maxRecordingDuration: 30000, // Maximum recording length (ms)
      analysisInterval: 100,       // Check audio level every 100ms
      smoothingFactor: 0.8,        // For audio level smoothing

      // Advanced voice detection parameters
      speechFrequencyMin: 300,     // Human speech formants start around 300 Hz
      speechFrequencyMax: 3400,    // Human speech formants up to 3400 Hz
      voiceActivityWindow: 5,      // Number of samples to analyze for voice patterns
      voiceConfidenceThreshold: 0.5, // Higher threshold for multi-feature approach
      noiseReductionFactor: 0.3,

  };


    switch (noiseLevel) {   // Switch case for ambient noise configuration settings
            case "quiet":
                VAD_CONFIG.noiseReductionFactor = 0.3;
                VAD_CONFIG.silenceThreshold = 0.005;
                VAD_CONFIG.voiceThreshold = 0.1;
                break;
            case "noisy":
                VAD_CONFIG.noiseReductionFactor = 0.7;
                VAD_CONFIG.silenceThreshold = 0.015;
                VAD_CONFIG.voiceThreshold = 0.3;
                break;
            case "normal":
                VAD_CONFIG.noiseReductionFactor = 0.5;
                VAD_CONFIG.silenceThreshold = 0.01;
                VAD_CONFIG.voiceThreshold = 0.2;
                break;
    }

  // ✅ Use useAuth hook to get user
  const { user } = useAuth();

  // Add this state for loading
  const [isEndingInterview, setIsEndingInterview] = useState(false);
  const [currentAudioElement, setCurrentAudioElement] = useState(null);
  const [canEndInterview, setCanEndInterview] = useState(true); // Start enabled
  const [isResponseInProgress, setIsResponseInProgress] = useState(false);

  // Auto-scroll to bottom when new messages are added
  const scrollToBottom = () => {
    // ✅ FIXED: Scroll only the messages container
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    // ✅ FIXED: Scroll only the messages container
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [conversation]);

  // Initialize VAD when component mounts (professional approach)
  useEffect(() => {
    let mounted = true;
    let timeoutId = null;

    //Retrieve noise level settings from dropdown menu
    document.getElementById('noiseLevelDropdown').addEventListener('change', function(event) {
        console.log(this.value);
        setNoiseLevel(this.value);
    });

    const initVAD = async () => {
      if (!mounted) return;

      console.log('🚀 Starting VAD initialization...');
      await initializeVAD();
    };

    // Use setTimeout to ensure this runs after all other effects
    timeoutId = setTimeout(initVAD, 100);

    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Only cleanup if component is actually unmounting
      if (isVADInitialized.current) {
        console.log('🧹 Component unmounting, cleaning up VAD...');
        cleanupVAD();
      }

      // ✅ NEW: Clean up audio state
      if (currentAudioElement) {
        currentAudioElement.pause();
        currentAudioElement.currentTime = 0;
      }
      setIsAudioPlaying(false);
      setCurrentAudioElement(null);
      setCanEndInterview(true);
    };
  }, []); // Empty dependency array ensures this runs only once

  // Debug loading state changes
  useEffect(() => {
    console.log('🔄 Loading state changed to:', isLoading);
  }, [isLoading]);

  // Notify parent component of state changes for head tracking toggle
  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        isRecording,
        isResponseInProgress,
        isAudioPlaying,
        canEndInterview,
        vadStatus,
        isListening,
        noiseLevel
      });
    }
  }, [isRecording, isResponseInProgress, isAudioPlaying, canEndInterview, vadStatus, isListening, noiseLevel, onStateChange]);

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

        // Remove thinking message and add actual response
        setConversation(prev => {
          const filtered = prev.filter(msg => !msg.isThinking);
          return [...filtered, newMessage];
        });
        console.log('✅ Interviewer response added');

        // ✅ NEW: Play audio if available
        if (audio_url) {
          console.log('🔊 Playing audio response:', audio_url);
          const audio = new Audio(audio_url);

          // ✅ NEW: Track audio playback state
          setIsAudioPlaying(true);
          setCurrentAudioElement(audio);
          setCanEndInterview(false); // Disable end interview button while audio plays
          setIsResponseInProgress(true);
          setVadStatus("processing"); // Change VAD status to 'processing'
          setIsRecording(false); // Disable recording state
          setIsListening(false); // Disable listening state
          isVADListening.current = false; // Disable VAD listening
          isVADRecording.current = false; // Disable VAD recording

          // ✅ NEW: Delete audio file after playback
          audio.onended = async () => {
                console.log('✅ Audio playback completed');
                setIsAudioPlaying(false);
                setCurrentAudioElement(null);
                setCanEndInterview(true); // Re-enable end interview button
                setIsResponseInProgress(false); // ✅ NEW: Response process complete
                setVadStatus('listening'); // Change VAD state to 'listening'
                isVADListening.current = true; // Enable VAD listening


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
            setIsAudioPlaying(false);
            setCurrentAudioElement(null);
            setCanEndInterview(true); // Re-enable button on error
            setIsResponseInProgress(false); // ✅ NEW: Response process complete on error
            setVadStatus('listening'); // Change VAD state to 'listening'
            isVADListening.current = true; // Enable VAD listening
          };

          // ✅ NEW: Play the audio
          audio.play().catch(error => {
            console.error('❌ Failed to play audio:', error);
            setIsAudioPlaying(false);
            setCurrentAudioElement(null);
            setCanEndInterview(true); // Re-enable button on error
            setIsResponseInProgress(false); // ✅ NEW: Response process complete on error
            setVadStatus('listening'); // Change VAD state to 'listening'
            isVADListening.current = true; // Enable VAD listening

          });
        } else {
          console.log('ℹ️ No audio URL provided in response');
          setCanEndInterview(true); // No audio, so button can be enabled
          setIsResponseInProgress(false); // ✅ NEW: Response process complete
          setVadStatus('listening'); // Change VAD state to 'listening'
          isVADListening.current = true; // Enable VAD listening
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
          const { response: textResponse, audio_url, should_delete_audio, interview_done, feedback_saved_successfully } = response.data;

          // Add the final response to conversation
          const newMessage = {
            id: Date.now(),
            speaker: 'interviewer',
            message: textResponse,
            timestamp: new Date().toLocaleTimeString()
          };

          // Remove thinking message and add final response
          setConversation(prev => {
            const filtered = prev.filter(msg => !msg.isThinking);
            return [...filtered, newMessage];
          });

          // ✅ FIXED: Track events only when interview is done AND feedback is successfully saved
          if (interview_done) {
            console.log('🎯 Interview completed, tracking events...');

            // Track interview completion
            console.log('📊 Tracking participatedInMockInterview...');
            trackEvents.participatedInMockInterview({
              interview_id: interviewId,
              completion_timestamp: new Date().toISOString(),
              completion_method: 'backend_confirmed'
            });

            // ✅ FIXED: Only track feedback generation when feedback is actually saved to database
            if (feedback_saved_successfully) {
              console.log('✅ Feedback successfully saved to database, tracking feedback generation...');
              setTimeout(() => {
                console.log('📊 Tracking mockInterviewFeedbackGenerated...');
                trackEvents.mockInterviewFeedbackGenerated({
                  interview_id: interviewId,
                  generation_timestamp: new Date().toISOString(),
                  generation_method: 'backend_confirmed'
                });
              }, 100); // 100ms delay
            } else {
              console.log('⚠️ Interview completed but feedback not saved yet, skipping feedback generation tracking');
            }
          }

          // ✅ NEW: Play audio for final response (if available)
          if (audio_url) {
            console.log('🔊 Playing final audio response:', audio_url);
            const audio = new Audio(audio_url);

            // ✅ NEW: Track final audio playback state
            setIsAudioPlaying(true);
            setCurrentAudioElement(audio);
            setCanEndInterview(false); // Disable end interview button while final audio plays


            audio.onended = async () => {
              console.log('✅ Final audio playback completed');
              setIsAudioPlaying(false);
              setCurrentAudioElement(null);
              setCanEndInterview(true); // Re-enable end interview button

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

  // ✅ REMOVED: toggleRecording function - replaced with VAD automatic recording

  // ✅ NEW: Add audio conversion function
  const convertToWav = async (audioBlob) => {
    try {
      // Create an audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();

      // Decode the audio
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Convert to WAV format
      const wavBuffer = audioBufferToWav(audioBuffer);

      return new Blob([wavBuffer], { type: 'audio/wav' });
    } catch (error) {
      console.error('❌ Audio conversion failed:', error);
      // Fallback: return original blob if conversion fails
      return audioBlob;
    }
  };

  // ✅ NEW: Audio buffer to WAV conversion with proper header
  const audioBufferToWav = (buffer) => {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;

    // Calculate buffer size correctly
    const bufferSize = 44 + length * numberOfChannels * 2;
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    // Helper function to write strings
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // Write WAV file header (44 bytes)
    writeString(0, 'RIFF');                    // Chunk ID
    view.setUint32(4, bufferSize - 8, true);  // Chunk size (file size - 8)
    writeString(8, 'WAVE');                    // Format
    writeString(12, 'fmt ');                   // Subchunk1 ID
    view.setUint32(16, 16, true);             // Subchunk1 size (16 for PCM)
    view.setUint16(20, 1, true);              // Audio format (1 = PCM)
    view.setUint16(22, numberOfChannels, true); // Number of channels
    view.setUint32(24, sampleRate, true);     // Sample rate
    view.setUint32(28, sampleRate * numberOfChannels * 2, true); // Byte rate
    view.setUint16(32, numberOfChannels * 2, true); // Block align
    view.setUint16(34, 16, true);             // Bits per sample
    writeString(36, 'data');                   // Subchunk2 ID
    view.setUint32(40, length * numberOfChannels * 2, true); // Subchunk2 size

    // Write audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        // Convert float to 16-bit integer
        const sample16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, sample16, true);
        offset += 2;
      }
    }

    return arrayBuffer;
  };

  // ✅ NEW: VAD Functions
  const initializeVAD = async () => {
    // Prevent duplicate initialization with more robust check
    if (isVADInitialized.current || audioContextRef.current || streamRef.current) {
      console.log('⚠️ VAD already initialized, skipping...');
      return;
    }

    try {
      console.log('🎙️ Initializing VAD...');

      // Get audio stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      // Double-check we're still not initialized
      if (isVADInitialized.current) {
        console.log('⚠️ VAD initialized during stream request, cleaning up...');
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      console.log('✅ Audio stream obtained');
      streamRef.current = stream;

      // Create audio context for analysis
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log('✅ Audio context created, state:', audioContext.state);
      audioContextRef.current = audioContext;

      // Resume audio context if suspended (required by some browsers)
      if (audioContext.state === 'suspended') {
        console.log('🔄 Audio context suspended, attempting to resume...');
        await audioContext.resume();
        console.log('✅ Audio context resumed, state:', audioContext.state);
      }

      // Create analyser for audio level monitoring
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      console.log('✅ Analyser created');
      analyserRef.current = analyser;

      // Connect microphone to analyser
        const microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        microphoneRef.current = microphone;
        console.log('✅ Microphone connected to analyser');



      // Mark as initialized and listening using refs (immediate)
      isVADInitialized.current = true;
      isVADListening.current = true;

      // Set React state for UI updates
      setIsListening(true);
      setVadStatus('listening');
      console.log('✅ VAD status set to listening');

      // Start VAD monitoring immediately (using refs)
      startVADMonitoring();
      console.log('✅ VAD monitoring started');

      console.log('✅ VAD initialized successfully - Ready to listen');

    } catch (error) {
      console.error('❌ Failed to initialize VAD:', error);
      console.error('❌ Error details:', error.message);
      setVadStatus('idle');
      setIsListening(false);

      // Clean up on error
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    }
  };

  const startVADMonitoring = () => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
    }

    console.log(`🔄 Starting VAD monitoring with ${VAD_CONFIG.analysisInterval}ms interval`);

    vadIntervalRef.current = setInterval(() => {
      checkVoiceActivity();
    }, VAD_CONFIG.analysisInterval);

    console.log('✅ VAD monitoring interval set');
  };

  // Advanced voice detection using multiple features (inspired by big tech approaches)
  const analyzeVoicePattern = (analyser) => {
    const bufferLength = analyser.frequencyBinCount;
    const frequencyData = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);

    analyser.getByteFrequencyData(frequencyData);
    analyser.getByteTimeDomainData(timeData);

    const sampleRate = audioContextRef.current.sampleRate;
    const binSize = sampleRate / (bufferLength * 2);

    // 1. ENERGY ANALYSIS
    let totalEnergy = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      totalEnergy += frequencyData[i] / 255.0;
    }

    // 2. SPECTRAL CENTROID (brightness of sound)
    let weightedSum = 0;
    let magnitudeSum = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      const frequency = i * binSize;
      const magnitude = frequencyData[i] / 255.0;
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }
    const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;

    // 3. ZERO CROSSING RATE (speech has more zero crossings than noise)
    let zeroCrossings = 0;
    for (let i = 1; i < timeData.length; i++) {
      if ((timeData[i] >= 128) !== (timeData[i-1] >= 128)) {
        zeroCrossings++;
      }
    }
    const zeroCrossingRate = zeroCrossings / timeData.length;

    // 4. SPEECH FREQUENCY RANGE ANALYSIS (300-3400 Hz)
    let speechEnergy = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      const frequency = i * binSize;
      const amplitude = frequencyData[i] / 255.0;

      if (frequency >= VAD_CONFIG.speechFrequencyMin && frequency <= VAD_CONFIG.speechFrequencyMax) {
        speechEnergy += amplitude;
      }
    }
    const speechRatio = totalEnergy > 0 ? speechEnergy / totalEnergy : 0;

    // 5. TEMPORAL ANALYSIS
    const currentSample = {
      speechRatio,
      totalEnergy,
      spectralCentroid,
      zeroCrossingRate,
      timestamp: Date.now()
    };
    audioHistoryRef.current.push(currentSample);

    if (audioHistoryRef.current.length > VAD_CONFIG.voiceActivityWindow) {
      audioHistoryRef.current.shift();
    }

    // 6. MULTI-FEATURE VOICE DETECTION (inspired by Google's approach)
    let voiceConfidence = 0;
    if (audioHistoryRef.current.length >= 3) {
      const recentSamples = audioHistoryRef.current.slice(-3);

      // Calculate averages
      const avgSpeechRatio = recentSamples.reduce((sum, s) => sum + s.speechRatio, 0) / recentSamples.length;
      const avgSpectralCentroid = recentSamples.reduce((sum, s) => sum + s.spectralCentroid, 0) / recentSamples.length;
      const avgZeroCrossingRate = recentSamples.reduce((sum, s) => sum + s.zeroCrossingRate, 0) / recentSamples.length;
      const avgEnergy = recentSamples.reduce((sum, s) => sum + s.totalEnergy, 0) / recentSamples.length;

      // Multi-feature scoring (inspired by Google's WebRTC VAD)
      let score = 0;

      // Speech ratio score (0-0.4)
      if (avgSpeechRatio > 0.4) score += 0.4;
      else if (avgSpeechRatio > 0.2) score += avgSpeechRatio;

      // Spectral centroid score (0-0.3) - speech is brighter than noise
      if (avgSpectralCentroid > 1000 && avgSpectralCentroid < 3000) score += 0.3;
      else if (avgSpectralCentroid > 500) score += 0.15;

      // Zero crossing rate score (0-0.2) - speech has moderate ZCR
      if (avgZeroCrossingRate > 0.1 && avgZeroCrossingRate < 0.4) score += 0.2;
      else if (avgZeroCrossingRate > 0.05) score += 0.1;

      // Energy score (0-0.1) - just enough energy
      if (avgEnergy > 0.1 && avgEnergy < 2.0) score += 0.1;

      voiceConfidence = Math.min(score, 1);
    }

    // 7. ADAPTIVE THRESHOLD (like Google's approach)
    const isLikelyVoice = voiceConfidence > VAD_CONFIG.voiceConfidenceThreshold &&
                         totalEnergy > VAD_CONFIG.voiceThreshold &&
                         speechRatio > 0.2 &&
                         spectralCentroid > 500 &&
                         zeroCrossingRate > 0.05;

    // Debug logging (remove in production)
    if (totalEnergy > 0.01) {
      console.log(`🔍 Multi-Feature VAD: SpeechRatio=${speechRatio.toFixed(3)}, SpectralCentroid=${spectralCentroid.toFixed(0)}Hz, ZCR=${zeroCrossingRate.toFixed(3)}, Energy=${totalEnergy.toFixed(3)}, Confidence=${voiceConfidence.toFixed(3)}, IsVoice=${isLikelyVoice}`);
    }

    return {
      speechRatio,
      totalEnergy,
      spectralCentroid,
      zeroCrossingRate,
      voiceConfidence,
      isLikelyVoice
    };
  };

  const checkVoiceActivity = () => {

    if (!analyserRef.current) {
      console.log('❌ No analyser available');
      return;
    }

    // Use refs for immediate state checking (professional approach)
    if (!isVADInitialized.current) {
      console.log(`❌ VAD not initialized: ${isVADInitialized.current}`);
      return;
    }

    // Use time domain data for audio level visualization
    const timeDataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(timeDataArray);

    // Calculate RMS (Root Mean Square) for audio level visualization
    let sum = 0;
    for (let i = 0; i < timeDataArray.length; i++) {
      const sample = (timeDataArray[i] - 128) / 128; // Convert to -1 to 1 range
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / timeDataArray.length);
    const normalizedLevel = Math.min(rms * 20, 1); // Scale up for better sensitivity

    // Smooth the audio level for visualization
    setAudioLevel(prev => prev * VAD_CONFIG.smoothingFactor + normalizedLevel * (1 - VAD_CONFIG.smoothingFactor));

    // Advanced voice detection using frequency analysis
    const voiceAnalysis = analyzeVoicePattern(analyserRef.current);

    // If we're recording, check for silence but don't start new recording
    if (isVADRecording.current && !isResponseInProgress) {
      console.log(`🔊 Recording - Audio Level: ${normalizedLevel.toFixed(4)}, Voice Confidence: ${voiceAnalysis.voiceConfidence.toFixed(3)}, Speech Ratio: ${voiceAnalysis.speechRatio.toFixed(3)}`);

      // Check for silence to stop recording (use voice analysis for better detection)
      if (!voiceAnalysis.isLikelyVoice || normalizedLevel < VAD_CONFIG.silenceThreshold) {
        if (!silenceTimeoutRef.current) {
          console.log(`🔇 Silence/Noise detected! Starting ${VAD_CONFIG.silenceTimeout}ms timeout... (Level: ${normalizedLevel.toFixed(4)}, Confidence: ${voiceAnalysis.voiceConfidence.toFixed(3)})`);
          silenceTimeoutRef.current = setTimeout(() => {
            console.log('🔇 Silence timeout reached, stopping recording...');
            stopVADRecording();
          }, VAD_CONFIG.silenceTimeout);
        }
      } else {
        // Clear silence timeout if voice is detected again
        if (silenceTimeoutRef.current) {
          console.log(`🎤 Voice detected again, clearing silence timeout... (Level: ${normalizedLevel.toFixed(4)}, Confidence: ${voiceAnalysis.voiceConfidence.toFixed(3)})`);
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
      }
      return;
    }

    // If we're not listening (e.g., processing), don't check
    if (!isVADListening.current) {
      return;
    }

    // Always log for debugging (remove in production)
    console.log(`🔊 Audio Level: ${normalizedLevel.toFixed(4)}, Voice Confidence: ${voiceAnalysis.voiceConfidence.toFixed(3)}, Speech Ratio: ${voiceAnalysis.speechRatio.toFixed(3)}, Status: ${vadStatus}, Recording: ${isRecording}, Listening: ${isVADListening.current}`);

    // Test audio detection (remove in production)
    if (normalizedLevel > 0.001) {
      console.log(`🎵 Audio detected: ${normalizedLevel.toFixed(4)} (Confidence: ${voiceAnalysis.voiceConfidence.toFixed(3)})`);
    }

    // Check for voice activity - START RECORDING (advanced voice detection only)
    if (voiceAnalysis.isLikelyVoice && !isVADRecording.current) {
      console.log(`🎤 Human voice detected! Starting recording... (Level: ${normalizedLevel.toFixed(4)}, Confidence: ${voiceAnalysis.voiceConfidence.toFixed(3)}, Speech Ratio: ${voiceAnalysis.speechRatio.toFixed(3)})`);
      startVADRecording();

      // Clear any existing silence timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
    }
  };

  const startVADRecording = async () => {
    // Prevent multiple recording attempts
    if (isRecording || isAudioPlaying || isLoading || isResponseInProgress) {
      return;
    }

    try {
        console.log('🎙️ Starting recording...');
        isVADRecording.current = true; // Set ref immediately for instant state update
        setIsRecording(true);
        setVadStatus('speaking');
        isVADListening.current = false; // Stop listening while recording
        setCanEndInterview(false);

      // Create MediaRecorder for actual recording
            const mediaRecorder = new MediaRecorder(streamRef.current, {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 128000
            });


      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      console.log('✅ VAD recording started');


    } catch (error) {
      console.error('❌ Failed to start VAD recording:', error);
      isVADRecording.current = false; // Reset ref on error
      setIsRecording(false);
      setVadStatus('listening');
      setCanEndInterview(true);
    }
  };

  const stopVADRecording = async () => {
    if (!isVADRecording.current) return;

    console.log('🛑 Stopping VAD recording...');
    isVADRecording.current = false; // Reset ref immediately
    setIsRecording(false);
    setVadStatus('processing');
    setCanEndInterview(true);
    setIsLoading(true);

    // Keep listening disabled during processing
    isVADListening.current = false;

    // Clear silence timeout
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

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

      // Process the recorded audio (same as before)
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      audioChunksRef.current = [];

      console.log('🎵 VAD audio recording completed, blob size:', audioBlob.size, 'bytes');

      // Send audio to backend for transcription (same pipeline as before)
      await processRecordedAudio(audioBlob);

    } catch (error) {
      console.error('❌ Error stopping VAD recording:', error);
      setIsLoading(false);
      setVadStatus('listening');
    }
  };

  const processRecordedAudio = async (audioBlob) => {
    try {
      console.log('📤 Sending VAD audio to backend for transcription...');

      const wavBlob = await convertToWav(audioBlob);
      const formData = new FormData();
      formData.append('audio', wavBlob, 'recording.wav');

      // Get interview_id from URL
      const urlParams = new URLSearchParams(window.location.search);
      const interviewId = urlParams.get('interview_id');

      if (interviewId) {
        formData.append('interview_id', interviewId);
      }

      const result = await uploadFile('/api/transcribe-audio', formData);

      console.log('📥 Backend response:', result);

      if (result.success) {
        const transcription = result.data.transcription;

        if (transcription && transcription.trim()) {
          // Add candidate's response to conversation
          const newMessage = {
            id: Date.now(),
            speaker: 'candidate',
            message: transcription,
            timestamp: new Date().toLocaleTimeString()
          };

          setConversation(prev => [...prev, newMessage]);
          console.log('✅ Candidate message added');
          setIsLoading(false);

          // Add thinking indicator before backend call
          const thinkingMessage = {
            id: `thinking-${Date.now()}`,
            speaker: 'interviewer',
            message: 'Thinking...',
            timestamp: new Date().toLocaleTimeString(),
            isThinking: true
          };
          setConversation(prev => [...prev, thinkingMessage]);

          // Call Interview Manager API to get the next question/response
          setIsResponseInProgress(true);
          await callInterviewManager(transcription);

        } else {
          // No speech detected
          console.log('⚠️ No speech detected in VAD recording');
          const newMessage = {
            id: Date.now(),
            speaker: 'candidate',
            message: '[No speech detected]',
            timestamp: new Date().toLocaleTimeString()
          };
          setConversation(prev => [...prev, newMessage]);
          setIsLoading(false);
        }
      } else {
        console.error('❌ VAD transcription failed:', result.message);
        const errorMessage = {
          id: Date.now(),
          speaker: 'system',
          message: `Transcription failed: ${result.message || 'Unknown error'}`,
          timestamp: new Date().toLocaleTimeString()
        };
        setConversation(prev => [...prev, errorMessage]);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('❌ Error during VAD transcription:', error);
      const errorMessage = {
        id: Date.now(),
        speaker: 'system',
        message: `Transcription error: ${error.message || 'Unknown error'}`,
        timestamp: new Date().toLocaleTimeString()
      };
      setConversation(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }

  };

  const cleanupVAD = () => {
    console.log('🧹 Cleaning up VAD...');

    // Clear intervals and timeouts
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    // Clean up audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Clean up analyser and microphone
    analyserRef.current = null;
    microphoneRef.current = null;

    // Clean up stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Reset initialization flags
    isVADInitialized.current = false;
    isVADListening.current = false;
    isVADRecording.current = false;
    audioHistoryRef.current = []; // Clear audio history

    setIsListening(false);
    setVadStatus('idle');
    setAudioLevel(0);
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
      className="h-full flex flex-col p-3 sm:p-4 lg:p-6 min-h-0"
      style={{
        backgroundColor: 'var(--color-card)',
        borderLeft: '1px solid var(--color-border)'
      }}
    >
      {/* Header with Title and Buttons */}
      <div className="flex flex-col gap-3 sm:gap-4 mb-3 sm:mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
          <h2
            className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Interview Conversation
          </h2>

          {/* Noise Level Dropdown Menu */}
          <div className = "flex flex-col gap-3 sm:gap-4 mb-3 sm:mb-4">
          <label for='noiseLevelDropdown'>Noise Level:</label>
          <select id='noiseLevelDropdown' name='noiseLevelDropdown'>
              <option value='quiet'>Quiet</option>
              <option value='normal' selected>Normal</option>
              <option value='noisy'>Noisy</option>
          </select>
          </div>

          {/* End Interview Button */}
          <button
            onClick={handleEndInterview}
            disabled={!canEndInterview || isAudioPlaying || isRecording || isLoading || isResponseInProgress}
            className={`w-full sm:w-auto px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 text-xs sm:text-sm md:text-base font-semibold rounded-full transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 whitespace-nowrap ${
              !canEndInterview || isAudioPlaying || isRecording || isLoading || isResponseInProgress
                ? 'bg-[var(--color-error)]/10 border-2 border-[var(--color-error)]/30 text-[var(--color-error)]/70 cursor-not-allowed'
                : 'bg-[var(--color-error)]/10 border-2 border-[var(--color-error)] text-[var(--color-error)] hover:bg-[var(--color-error)] hover:text-white hover:border-[var(--color-error)]'
            }`}
            title={
              !canEndInterview || isAudioPlaying || isRecording || isLoading || isResponseInProgress
                ? (isRecording ? "Wait for recording to finish" :
                   isLoading ? "Wait for response to generate" :
                   isResponseInProgress ? "Response in progress..." : "Wait for audio to finish")
                : "End Interview"
            }
          >
            <span className="hidden sm:inline">
              {!canEndInterview || isAudioPlaying || isRecording || isLoading || isResponseInProgress
                ? (isRecording ? "Recording..." :
                   isAudioPlaying ? "Audio Playing..." :
                   isLoading ? "Generating..." :
                   isResponseInProgress ? "Response in progress..." : "Please Wait...")
                : "End Interview"
              }
            </span>
            <span className="sm:hidden">
              {!canEndInterview || isAudioPlaying || isRecording || isLoading || isResponseInProgress
                ? (isRecording ? "Recording..." :
                   isAudioPlaying ? "Audio Playing..." :
                   isLoading ? "Generating..." :
                   isResponseInProgress ? "Processing..." : "Please Wait...")
                : "End Interview"
              }
            </span>
          </button>
        </div>

        {/* VAD Status Indicator */}
        <div className="flex items-center justify-center gap-3">
          <div className={`w-full px-4 sm:px-6 md:px-8 py-3 sm:py-4 rounded-full flex items-center justify-center gap-2 sm:gap-3 text-white font-semibold transition-all duration-300 shadow-xl ${
            vadStatus === 'idle'
              ? 'bg-gray-400 opacity-60'
              : vadStatus === 'listening'
                ? 'bg-blue-500 animate-pulse'
                : vadStatus === 'speaking'
                  ? 'bg-red-500 animate-pulse'
                  : 'bg-purple-500 animate-pulse'
          }`}>
            <div className="relative">
              <Mic size={18} className="sm:w-5 sm:h-5" />
              {vadStatus === 'listening' && (
                <div className="absolute -inset-1 rounded-full border-2 border-white/30 animate-ping"></div>
              )}
              {vadStatus === 'speaking' && (
                <div className="absolute -inset-1 rounded-full border-2 border-white/50 animate-ping"></div>
              )}
            </div>
            <span className="text-xs sm:text-sm font-medium">
              {vadStatus === 'idle' && 'Initializing...'}
              {vadStatus === 'listening' && 'Listening...'}
              {vadStatus === 'speaking' && 'Speaking...'}
              {vadStatus === 'processing' && 'Processing...'}
            </span>
          </div>
        </div>

        {/* Audio Level Visualization */}
        {vadStatus === 'speaking' && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-full max-w-xs h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-red-500 transition-all duration-100 rounded-full"
                style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
              ></div>
            </div>
            <span className="text-xs text-gray-500 font-mono">
              {Math.round(audioLevel * 100)}%
            </span>
          </div>
        )}

        {/* Debug Controls - Remove in production */}
        {isRecording && (
          <div className="flex items-center justify-center gap-2 text-xs">
            <button
              onClick={() => {
                console.log('🔧 Manual stop recording');
                stopVADRecording();
              }}
              className="px-3 py-1 bg-red-500 text-white rounded text-xs"
            >
              Stop Recording
            </button>
            <span className="text-gray-500">
              Recording... (Manual stop available)
            </span>
          </div>
        )}

      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}  // ✅ NEW: Add ref to messages container
        className="flex-1 overflow-y-auto space-y-3 sm:space-y-4 mb-4 sm:mb-6 pr-1 sm:pr-2 min-h-0"
      >
        <AnimatePresence>
          {conversation.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{
                opacity: 1,
                y: message.isThinking ? [-3, 3] : 0
              }}
              transition={{
                duration: message.isThinking ? 1 : 0.3,
                repeat: message.isThinking ? Infinity : 0,
                ease: "easeInOut",
                repeatType: "reverse"
              }}
              className={`flex ${message.speaker === 'interviewer' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[90%] sm:max-w-[85%] rounded-xl sm:rounded-2xl shadow-lg ${
                  message.isThinking
                    ? 'p-3 sm:p-4 md:p-5 border-2 sm:border-3 border-[var(--color-primary)]'
                    : 'p-3 sm:p-4 md:p-5 border border-[var(--color-border)]'
                } ${
                  message.speaker === 'candidate' ? 'border border-[var(--color-primary)]' : ''
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
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-2 sm:mb-3">
                  <span
                    className={`text-xs font-bold px-2 sm:px-3 py-1 rounded-full tracking-wide ${
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
                <p className="text-xs sm:text-sm md:text-base leading-relaxed font-medium">{message.message}</p>
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
              className="max-w-[90%] sm:max-w-[85%] p-3 sm:p-4 rounded-lg border"
              style={{
                backgroundColor: 'var(--color-primary)',
                borderColor: 'var(--color-primary)',
                color: 'white'
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2">
                <span
                  className="text-xs font-bold px-2 sm:px-3 py-1 rounded-full tracking-wide"
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
                  className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-bounce"
                  style={{ backgroundColor: 'rgba(255,255,255,0.8)' }}
                ></div>
                <div
                  className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-bounce"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.8)',
                    animationDelay: '0.1s'
                  }}
                ></div>
                <div
                  className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-bounce"
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
        className="text-center border-t pt-3 sm:pt-4"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <p
          className="text-xs sm:text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {vadStatus === 'idle' && 'Initializing voice detection...'}
          {vadStatus === 'listening' && 'Speak naturally - recording will start automatically'}
          {vadStatus === 'speaking' && 'Keep speaking - recording will stop when you finish'}
          {vadStatus === 'processing' && 'Processing your response...'}
        </p>
      </div>

      {/* Session Info */}
      <div 
        className="flex items-center justify-between text-xs pt-2 border-t mt-3 sm:mt-4"
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