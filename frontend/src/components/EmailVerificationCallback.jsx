import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useEmailVerification } from '../hooks/useEmailVerification';
import { FiCheckCircle, FiXCircle, FiLoader, FiUpload } from 'react-icons/fi';
import Navbar from './Navbar';

function EmailVerificationCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme } = useTheme();
  const { verificationStatus, verificationMessage, handleEmailVerification } = useEmailVerification();

  useEffect(() => {
    const processVerification = async () => {
      const result = await handleEmailVerification(searchParams);
      if (result.success) {
        // Simple redirect to upload page (like big tech companies)
        setTimeout(() => navigate('/upload'), 2000);
      }
    };

    processVerification();
  }, [searchParams, navigate, handleEmailVerification]);

  const getStatusIcon = () => {
    switch (verificationStatus) {
      case 'pending':
        return <FiLoader className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />;
      case 'success':
        return <FiCheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />;
      case 'error':
        return <FiXCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />;
      default:
        return <FiLoader className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />;
    }
  };

  const getStatusColor = () => {
    switch (verificationStatus) {
      case 'pending':
        return 'text-blue-500';
      case 'success':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-blue-500';
    }
  };

  const getStatusTitle = () => {
    switch (verificationStatus) {
      case 'pending':
        return 'Verifying Email...';
      case 'success':
        return 'Email Verified!';
      case 'error':
        return 'Verification Failed';
      default:
        return 'Verifying Email...';
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-md bg-[var(--color-card)] text-[var(--color-text-primary)] p-8 rounded-2xl shadow-lg border border-[var(--color-border)] text-center">
          {getStatusIcon()}
          
          <h2 className={`text-2xl font-bold mb-4 ${getStatusColor()}`}>
            {getStatusTitle()}
          </h2>
          
          <p className="text-[var(--color-text-secondary)] mb-6">
            {verificationMessage}
          </p>
          
          {verificationStatus === 'pending' && (
            <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
              <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          )}

          {verificationStatus === 'error' && (
            <div className="space-y-4">
              <button
                onClick={() => navigate('/signup')}
                className="w-full py-2 px-4 font-semibold rounded bg-[var(--color-primary)] text-white hover:opacity-90 transition"
              >
                Try Signing Up Again
              </button>
              
              <button
                onClick={() => navigate('/login')}
                className="w-full py-2 px-4 font-semibold rounded border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-input-bg)] transition"
              >
                Go to Login
              </button>
            </div>
          )}

          {verificationStatus === 'success' && (
            <div className="space-y-4">
              <button
                onClick={() => navigate('/upload')}
                className="w-full py-2 px-4 font-semibold rounded bg-[var(--color-primary)] text-white hover:opacity-90 transition flex items-center justify-center gap-2"
              >
                <FiUpload className="w-5 h-5" />
                Go to Upload Page
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default EmailVerificationCallback;