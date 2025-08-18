import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../hooks/useTheme';
import { FiCheckCircle, FiXCircle, FiLoader } from 'react-icons/fi';
import Navbar from './Navbar';

function EmailVerificationCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme } = useTheme();
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleEmailVerification = async () => {
      try {
        // Get the access token and refresh token from URL params
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (error) {
          setStatus('error');
          setMessage(errorDescription || 'Email verification failed');
          return;
        }

        if (accessToken && refreshToken) {
          // Set the session
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            setStatus('error');
            setMessage('Failed to set session: ' + sessionError.message);
          } else {
            setStatus('success');
            setMessage('Email verified successfully! Redirecting to dashboard...');
            setTimeout(() => navigate('/dashboard'), 2000);
          }
        } else {
          setStatus('error');
          setMessage('Invalid verification link');
        }
      } catch (err) {
        console.error('Email verification error:', err);
        setStatus('error');
        setMessage('An unexpected error occurred');
      }
    };

    handleEmailVerification();
  }, [searchParams, navigate]);

  const getStatusIcon = () => {
    switch (status) {
      case 'verifying':
        return <FiLoader className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />;
      case 'success':
        return <FiCheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />;
      case 'error':
        return <FiXCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />;
      default:
        return null;
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case 'verifying':
        return 'Verifying Email...';
      case 'success':
        return 'Email Verified!';
      case 'error':
        return 'Verification Failed';
      default:
        return '';
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-md bg-[var(--color-card)] text-[var(--color-text-primary)] p-8 rounded-2xl shadow-lg border border-[var(--color-border)] text-center">
          {getStatusIcon()}
          
          <h2 className="text-2xl font-bold mb-4">
            {getStatusTitle()}
          </h2>
          
          <p className="text-[var(--color-text-secondary)] mb-6">
            {message}
          </p>

          {status === 'error' && (
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

          {status === 'success' && (
            <div className="space-y-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-2 px-4 font-semibold rounded bg-[var(--color-primary)] text-white hover:opacity-90 transition"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default EmailVerificationCallback;