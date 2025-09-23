import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Signup from './pages/SignUp';
import Login from './pages/Login';
import OAuthCallback from './components/OAuthCallback';
import UploadPage from './pages/UploadPage';
import ProfilePage from './pages/ProfilePage';
import DashboardPage from './pages/DashboardPage';
import ProtectedRoute from './components/ProtectedRoute';
import TestPage from './pages/TestPage';
import QuestionsPage from './pages/QuestionPage';
import InterviewPage from './pages/InterviewPage';
import InterviewFeedbackPage from './pages/InterviewFeedbackPage';
import PaymentStatus from './pages/PaymentsStatus';
import FAQPage from './pages/FAQPage';
// import AuthDebug from './components/AuthDebug'; // Add this temporarily
import './index.css';
import EmailVerificationCallback from './components/EmailVerificationCallback';

import SupportBot from './components/SupportBot'; // Add this import
import { supabase } from './supabaseClient'

import { useMixpanel } from './hooks/useMixpanel';


// TEMPORARY: Make supabase available in console for testing
window.supabase = supabase

function App() {
  // Initialize Mixpanel user identification
  useMixpanel();
  
  return (
    <>
      {/* <AuthDebug /> Add this temporarily for debugging */}
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
          path="/payment-status" 
          element={
            <ProtectedRoute>
              <PaymentStatus />
            </ProtectedRoute>
          } 
        />
        <Route path="/faq" element={<FAQPage />} />
      </Routes>
      
      {/* Support Bot Widget - Available on all pages */}
      <SupportBot />
    </>
  );
}

export default App;
