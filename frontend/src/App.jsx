import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Signup from './pages/SignUp';
import Login from './pages/Login';
import OAuthCallback from './components/OAuthCallback';
import UploadPage from './pages/UploadPage';
import ProfilePage from './pages/ProfilePage';
import ProtectedRoute from './components/ProtectedRoute';
import TestPage from './pages/TestPage';
import QuestionsPage from './pages/QuestionPage';
import InterviewPage from './pages/InterviewPage';
import InterviewFeedbackPage from './pages/InterviewFeedbackPage';
import PaymentStatus from './pages/PaymentsStatus';
// import AuthDebug from './components/AuthDebug'; // Add this temporarily
import './index.css';
import EmailVerificationCallback from './components/EmailVerificationCallback';

// Add this route

function App() {
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
      </Routes>
    </>
  );
}

export default App;
