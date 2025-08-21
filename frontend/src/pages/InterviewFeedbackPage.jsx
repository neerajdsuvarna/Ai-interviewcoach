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
  MessageSquare
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import Navbar from '@/components/Navbar';
import FeedbackLoading from '@/components/interview/FeedbackLoading';

function InterviewFeedbackPage() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const interviewId = searchParams.get('interview_id');
  
  const [showLoading, setShowLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Mock feedback data - in a real app this would come from the interview evaluation
  const mockFeedback = {
    key_strengths: "Excellent technical knowledge demonstrated throughout the interview. Strong problem-solving skills and clear communication. Good understanding of the role requirements.",
    improvement_areas: "Could provide more specific examples from past experiences. Consider elaborating on technical challenges faced. Practice more concise responses to complex questions.",
    summary: "Overall, you demonstrated solid technical knowledge and good communication skills. Your responses showed confidence and understanding of the role. With some refinement in providing specific examples and more concise answers, you would be an excellent candidate for this position."
  };

  useEffect(() => {
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
  }, []);

  const getOverallRating = () => {
    // This would be calculated based on the actual interview evaluation
    // For now, returning a placeholder rating
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
                      {mockFeedback.key_strengths}
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
                      {mockFeedback.improvement_areas}
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
                    {mockFeedback.summary}
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
