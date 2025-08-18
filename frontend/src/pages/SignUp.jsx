import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { FiEye, FiEyeOff, FiMail } from 'react-icons/fi';
import Navbar from '../components/Navbar';

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

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      setLoading(false);
      return;
    }

    if (!fullName.trim()) {
      setErrorMsg('Full name is required.');
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
          }
        }
      });

      if (error) {
        if (error.status === 400 && error.message.includes('already registered')) {
          setErrorMsg('This email is already in use. Try logging in instead.');
        } else {
          setErrorMsg(error.message);
        }
      } else {
        setShowVerificationMessage(true);
        setSuccessMsg('Account created successfully! Please check your email to verify your account.');
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
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg('Verification email sent again! Please check your inbox.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to resend verification email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (showVerificationMessage) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4 py-8 sm:px-6 lg:px-8">
          <div className="w-full max-w-md bg-[var(--color-card)] text-[var(--color-text-primary)] p-8 rounded-2xl shadow-lg border border-[var(--color-border)] text-center">
            <div className="mb-6">
              <FiMail className="w-16 h-16 text-[var(--color-primary)] mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-[var(--color-primary)] mb-2">
                Verify Your Email
              </h2>
              <p className="text-[var(--color-text-secondary)]">
                We've sent a verification link to:
              </p>
              <p className="font-semibold text-[var(--color-text-primary)] mt-2">
                {email}
              </p>
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
                onClick={() => navigate('/login')}
                className="w-full py-2 px-4 font-semibold rounded border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-input-bg)] transition"
              >
                Go to Login
              </button>
            </div>

            <p className="mt-6 text-sm text-[var(--color-text-secondary)]">
              Didn't receive the email? Check your spam folder or{' '}
              <button
                onClick={handleResendVerification}
                className="text-[var(--color-primary)] hover:underline"
              >
                try again
              </button>
            </p>
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