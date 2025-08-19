import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { FiEye, FiEyeOff, FiMail, FiCheckCircle, FiLoader } from 'react-icons/fi';
import Navbar from '../components/Navbar';
import { isValidEmail, formatErrorMessage, resendVerificationEmail } from '../utils/emailVerificationUtils';
import { useSimpleVerificationStatus } from '../hooks/useSimpleVerificationStatus';

function Signup() {
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);

  // Use the simplified verification status hook (big tech approach)
  const { isChecking, checkVerificationStatus } = useSimpleVerificationStatus(email, showVerificationMessage);

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (!fullName.trim()) {
      setErrorMsg('Full name is required.');
      setLoading(false);
      return;
    }

    if (!isValidEmail(email)) {
      setErrorMsg('Please enter a valid email address.');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim()
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        setErrorMsg(formatErrorMessage(error));
      } else {
        setShowVerificationMessage(true);
        setSuccessMsg('Account created successfully! Please check your email to verify your account and complete the signup process.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Something went wrong. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordVisibilityToggle = () => {
    setPasswordVisible(!passwordVisible);
  };

  const handleResendVerification = async () => {
    setLoading(true);
    setErrorMsg('');
    
    const result = await resendVerificationEmail(email);
    
    if (result.success) {
      setSuccessMsg('Verification email sent again! Please check your inbox.');
    } else {
      setErrorMsg(result.error);
    }
    
    setLoading(false);
  };

  const handleManualCheck = async () => {
    setErrorMsg('');
    const isVerified = await checkVerificationStatus();
    if (isVerified) {
      setSuccessMsg('Email verified successfully! Redirecting to upload page...');
      setTimeout(() => {
        navigate('/upload');
      }, 2000);
    } else {
      setErrorMsg('Email not verified yet. Please check your email and click the verification link.');
    }
  };

  if (showVerificationMessage) {
    const getStatusIcon = () => {
      return isChecking ? (
        <FiLoader className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
      ) : (
        <FiMail className="w-16 h-16 text-[var(--color-primary)] mx-auto mb-4" />
      );
    };

    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4 py-8 sm:px-6 lg:px-8">
          <div className="w-full max-w-md bg-[var(--color-card)] text-[var(--color-text-primary)] p-8 rounded-2xl shadow-lg border border-[var(--color-border)] text-center">
                         <div className="mb-6">
               {getStatusIcon()}
               <h2 className="text-2xl font-bold mb-2 text-[var(--color-primary)]">
                 Check Your Email
               </h2>
               <p className="text-[var(--color-text-secondary)]">
                 We've sent a verification link to:
               </p>
               <p className="font-semibold text-[var(--color-text-primary)] mt-2">
                 {email}
               </p>
               {isChecking && (
                 <p className="text-sm text-blue-500 mt-2">
                   Checking verification status...
                 </p>
               )}
             </div>

            {errorMsg && <p className="text-[var(--color-error)] text-sm mb-4">{errorMsg}</p>}
            {successMsg && <p className="text-green-500 text-sm mb-4">{successMsg}</p>}

                         <div className="space-y-4">
               <button
                 onClick={handleResendVerification}
                 disabled={loading}
                 className={`w-full py-2 px-4 font-semibold rounded text-white transition ${
                   loading
                     ? 'bg-gray-400 cursor-not-allowed'
                     : 'bg-[var(--color-primary)] hover:opacity-90'
                 }`}
               >
                 {loading ? 'Sending...' : 'Resend Verification Email'}
               </button>

               <button
                 onClick={handleManualCheck}
                 disabled={isChecking}
                 className={`w-full py-2 px-4 font-semibold rounded border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition ${
                   isChecking ? 'opacity-50 cursor-not-allowed' : ''
                 }`}
               >
                 {isChecking ? 'Checking...' : 'Check Verification Status'}
               </button>

               <button
                 onClick={() => navigate('/login')}
                 className="w-full py-2 px-4 font-semibold rounded border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-input-bg)] transition"
               >
                 Go to Login
               </button>
             </div>

                         <div className="mt-6 space-y-3">
               <p className="text-sm text-[var(--color-text-secondary)]">
                 Didn't receive the email? Check your spam folder or{' '}
                 <button
                   onClick={handleResendVerification}
                   className="text-[var(--color-primary)] hover:underline"
                 >
                   try again
                 </button>
               </p>
               <p className="text-xs text-[var(--color-text-secondary)]">
                 After verification, you'll be automatically logged in and redirected to the upload page to start using InterviewCoach.
               </p>
             </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-md xl:max-w-md bg-[var(--color-card)] text-[var(--color-text-primary)] p-6 sm:p-8 rounded-2xl shadow-lg border border-[var(--color-border)]">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6 text-[var(--color-primary)]">
            Create an Account
          </h2>

          {errorMsg && <p className="text-[var(--color-error)] text-sm mb-4 text-center">{errorMsg}</p>}
          {successMsg && <p className="text-green-500 text-sm mb-4 text-center">{successMsg}</p>}

          <form onSubmit={handleSignup} className="space-y-5" aria-label="Signup Form">
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-2 rounded-lg bg-[var(--color-input-bg)] text-[var(--color-text-primary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-2 rounded-lg bg-[var(--color-input-bg)] text-[var(--color-text-primary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full px-4 py-2 rounded-lg bg-[var(--color-input-bg)] text-[var(--color-text-primary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition"
                />
                <button
                  type="button"
                  onClick={handlePasswordVisibilityToggle}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
                  aria-label="Toggle password visibility"
                >
                  {passwordVisible ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 font-semibold rounded text-white transition ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-[var(--color-primary)] hover:opacity-90'
              }`}
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>

          {/* Login Link */}
          <p className="mt-6 text-sm text-center text-[var(--color-text-secondary)]">
            Already have an account?{' '}
            <Link to="/login" className="text-[var(--color-primary)] hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

export default Signup;