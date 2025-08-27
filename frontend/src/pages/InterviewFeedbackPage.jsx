import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  CheckCircle, 
  TrendingUp, 
  Clock, 
  Star,
  ArrowLeft,
  Download,
  Share2,
  BookOpen,
  Target,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import Navbar from '@/components/Navbar';
import FeedbackLoading from '@/components/interview/FeedbackLoading';
import { supabase } from '@/supabaseClient';

function InterviewFeedbackPage() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const interviewId = searchParams.get('interview_id');
  
  const [showLoading, setShowLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [feedbackData, setFeedbackData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Fetch feedback data from the database
  const fetchFeedbackData = async () => {
    if (!interviewId) {
      setError('Interview ID is required');
      setShowLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // Fetch feedback data using the interview_id via Supabase Edge Function
      const response = await fetch(`${supabaseUrl}/functions/v1/interview-feedback?interview_id=${interviewId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch feedback: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data && result.data.length > 0) {
        // Get the first feedback record for this interview
        setFeedbackData(result.data[0]);
      } else {
        setError('No feedback data found for this interview');
      }
    } catch (err) {
      console.error('Error fetching feedback data:', err);
      setError(err.message || 'Failed to load interview feedback');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Start fetching data immediately
    fetchFeedbackData();
    
    // Simulate realistic loading progress
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          // Add a small delay after reaching 100% for better UX
          setTimeout(() => {
            setShowLoading(false);
          }, 500);
          return 100;
        }
        // Slow down progress as it approaches 100%
        const increment = prev < 80 ? 2 : prev < 95 ? 1 : 0.5;
        return Math.min(prev + increment, 100);
      });
    }, 100);

    return () => clearInterval(progressInterval);
  }, [interviewId]);

  const getOverallRating = () => {
    // This would be calculated based on the actual interview evaluation
    // For now, returning a placeholder rating
    // In the future, this could be calculated from the feedback data
    return 7.5; // Out of 10
  };

  const getRatingColor = (rating) => {
    if (rating >= 8) return 'text-green-500';
    if (rating >= 6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getRatingLabel = (rating) => {
    if (rating >= 8) return 'Excellent';
    if (rating >= 6) return 'Good';
    if (rating >= 4) return 'Average';
    return 'Needs Improvement';
  };

  // Show loading screen
  if (showLoading) {
    return (
      <>
        <Navbar />
        <FeedbackLoading 
          progress={loadingProgress}
          onProgressComplete={() => {
            // This will be called when progress reaches 100%
            // The actual transition is handled by the useEffect above
          }}
        />
      </>
    );
  }

  // Show error state
  if (error) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text-primary)] px-3 sm:px-4 py-6 sm:py-8 md:py-12 lg:py-16">
          <div className="w-full max-w-6xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-red-500" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Error Loading Feedback</h1>
              <p className="text-[var(--color-text-secondary)] mb-6">{error}</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 rounded-lg font-medium transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
                  style={{ 
                    backgroundColor: 'var(--color-primary)',
                    color: 'white'
                  }}
                >
                  Try Again
                </button>
                <button
                  onClick={() => navigate('/profile')}
                  className="px-6 py-3 rounded-lg font-medium transition-all duration-300 border hover:scale-105 active:scale-95"
                  style={{ 
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                    backgroundColor: 'var(--color-card)'
                  }}
                >
                  Back to Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Show loading state while fetching data
  if (isLoading || !feedbackData) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text-primary)] px-3 sm:px-4 py-6 sm:py-8 md:py-12 lg:py-16">
          <div className="w-full max-w-6xl mx-auto">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-[var(--color-text-secondary)]">Loading interview feedback...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text-primary)] px-3 sm:px-4 py-6 sm:py-8 md:py-12 lg:py-16">
        <div className="w-full max-w-6xl mx-auto">
          {/* Centered Header Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center mb-8 sm:mb-10"
          >
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-[var(--color-primary)] mb-3 sm:mb-4">
              Interview Feedback
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-[var(--color-text-secondary)] max-w-2xl mx-auto leading-relaxed px-2 mb-6">
              Your comprehensive performance analysis and personalized recommendations
            </p>
            
            {/* Back Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="flex items-center justify-center gap-4"
            >
              
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors hover:scale-105 active:scale-95">
                  <Download size={18} style={{ color: 'var(--color-text-primary)' }} />
                </button>
                <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors hover:scale-105 active:scale-95">
                  <Share2 size={18} style={{ color: 'var(--color-text-primary)' }} />
                </button>
              </div>
            </motion.div>
          </motion.div>

          {/* Content Container */}
          <div className="space-y-8">
            {/* Overall Score Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div 
                className="rounded-2xl p-6 shadow-lg border"
                style={{ 
                  backgroundColor: 'var(--color-card)',
                  borderColor: 'var(--color-border)' 
                }}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 
                    className="text-xl font-bold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Overall Performance
                  </h2>
                  <div className="flex items-center gap-2">
                    <Star size={20} className="text-yellow-500" />
                    <span 
                      className={`text-2xl font-bold ${getRatingColor(getOverallRating())}`}
                    >
                      {getOverallRating()}/10
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle size={24} className="text-green-500" />
                    </div>
                    <h3 
                      className="font-semibold mb-1"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {getRatingLabel(getOverallRating())}
                    </h3>
                    <p 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Overall Rating
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-3">
                      <Clock size={24} className="text-blue-500" />
                    </div>
                    <h3 
                      className="font-semibold mb-1"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      25 min
                    </h3>
                    <p 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Interview Duration
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center mx-auto mb-3">
                      <MessageSquare size={24} className="text-purple-500" />
                    </div>
                    <h3 
                      className="font-semibold mb-1"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      12
                    </h3>
                    <p 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Questions Answered
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Key Strengths */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <div 
                  className="rounded-2xl p-6 shadow-lg border h-full"
                  style={{ 
                    backgroundColor: 'var(--color-card)',
                    borderColor: 'var(--color-border)' 
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                      <TrendingUp size={20} className="text-green-500" />
                    </div>
                    <h3 
                      className="text-lg font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Key Strengths
                    </h3>
                  </div>
                  
                  <div className="space-y-3">
                    <p style={{ color: 'var(--color-text-primary)' }}>
                      {feedbackData.key_strengths || 'No key strengths data available.'}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Areas for Improvement */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div 
                  className="rounded-2xl p-6 shadow-lg border h-full"
                  style={{ 
                    backgroundColor: 'var(--color-card)',
                    borderColor: 'var(--color-border)' 
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                      <Target size={20} className="text-orange-500" />
                    </div>
                    <h3 
                      className="text-lg font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Areas for Improvement
                    </h3>
                  </div>
                  
                  <div className="space-y-3">
                    <p style={{ color: 'var(--color-text-primary)' }}>
                      {feedbackData.improvement_areas || 'No improvement areas data available.'}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div 
                className="rounded-2xl p-6 shadow-lg border"
                style={{ 
                  backgroundColor: 'var(--color-card)',
                  borderColor: 'var(--color-border)' 
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                    <BookOpen size={20} className="text-blue-500" />
                  </div>
                  <h3 
                    className="text-lg font-bold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Overall Summary
                  </h3>
                </div>
                
                <div className="prose max-w-none">
                  <p style={{ color: 'var(--color-text-primary)' }}>
                    {feedbackData.summary || 'No summary data available.'}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <button
                onClick={() => navigate('/interview')}
                className="px-6 py-3 rounded-lg font-medium transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
                style={{ 
                  backgroundColor: 'var(--color-primary)',
                  color: 'white'
                }}
              >
                Practice Another Interview
              </button>
              
              <button
                onClick={() => navigate('/profile')}
                className="px-6 py-3 rounded-lg font-medium transition-all duration-300 border hover:scale-105 active:scale-95"
                style={{ 
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                  backgroundColor: 'var(--color-card)'
                }}
              >
                View All Interviews
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
}

export default InterviewFeedbackPage;
