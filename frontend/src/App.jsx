import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Landing from './pages/Landing';
import Signup from './pages/SignUp';
import Login from './pages/Login';
import OAuthCallback from './components/OAuthCallback';
import EmailVerificationCallback from './components/EmailVerificationCallback';
import ProtectedRoute from './components/ProtectedRoute';
import SupportBot from './components/SupportBot';
import { supabase } from './supabaseClient';
import { useMixpanel } from './hooks/useMixpanel';
import './index.css';

// Lazy load heavy components for code splitting
const UploadPage = lazy(() => import('./pages/UploadPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TestPage = lazy(() => import('./pages/TestPage'));
const QuestionsPage = lazy(() => import('./pages/QuestionPage'));
const InterviewPage = lazy(() => import('./pages/InterviewPage'));
const InterviewFeedbackPage = lazy(() => import('./pages/InterviewFeedbackPage'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const FAQPage = lazy(() => import('./pages/FAQPage'));

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
  </div>
);

// TEMPORARY: Make supabase available in console for testing
window.supabase = supabase;

function App() {
  // Initialize Mixpanel user identification
  useMixpanel();
  
  return (
    <>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route path="/auth/callback" element={<EmailVerificationCallback />} />
          <Route 
            path="/upload" 
            element={
              <ProtectedRoute>
                <UploadPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/test" 
            element={
              <ProtectedRoute>
                <TestPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/questions" 
            element={
              <ProtectedRoute>
                <QuestionsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/interview" 
            element={
              <ProtectedRoute>
                <InterviewPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/interview-feedback" 
            element={
              <ProtectedRoute>
                <InterviewFeedbackPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/payment-success" 
            element={
              <ProtectedRoute>
                <PaymentSuccess />
              </ProtectedRoute>
            } 
          />
          <Route path="/faq" element={<FAQPage />} />
        </Routes>
      </Suspense>
      
      {/* Support Bot Widget - Available on all pages */}
      <SupportBot />
    </>
  );
}

export default App;
