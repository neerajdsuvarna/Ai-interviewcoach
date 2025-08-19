import { supabase } from '../supabaseClient';

/**
 * Validates if the current URL contains verification parameters
 */
export const hasVerificationParams = (searchParams) => {
  const accessToken = searchParams.get('access_token');
  const refreshToken = searchParams.get('refresh_token');
  const error = searchParams.get('error');
  const type = searchParams.get('type');
  
  return !!(accessToken || refreshToken || error || type);
};

/**
 * Extracts verification tokens from URL hash (fallback method)
 */
export const extractTokensFromHash = () => {
  const hash = window.location.hash;
  if (!hash) return null;
  
  try {
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    
    return accessToken && refreshToken ? { accessToken, refreshToken } : null;
  } catch (error) {
    console.error('Error extracting tokens from hash:', error);
    return null;
  }
};

/**
 * Validates email format
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Formats error messages for better user experience
 */
export const formatErrorMessage = (error) => {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.message) {
    // Handle common Supabase auth errors
    const message = error.message.toLowerCase();
    
    if (message.includes('invalid email')) {
      return 'Please enter a valid email address.';
    }
    if (message.includes('password')) {
      return 'Password requirements not met. Please try again.';
    }
    if (message.includes('already registered')) {
      return 'This email is already registered. Please try logging in instead.';
    }
    if (message.includes('email not confirmed')) {
      return 'Please check your email and click the verification link.';
    }
    if (message.includes('expired')) {
      return 'The verification link has expired. Please request a new one.';
    }
    
    return error.message;
  }
  
  return 'An unexpected error occurred. Please try again.';
};

/**
 * Checks if user session is valid and email is confirmed
 */
export const isUserVerified = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Session check error:', error);
      return false;
    }
    
    if (!session || !session.user) {
      return false;
    }
    
    // Check if email is confirmed
    return !!session.user.email_confirmed_at;
  } catch (error) {
    console.error('Error checking user verification:', error);
    return false;
  }
};

/**
 * Sends a resend verification email with proper error handling
 */
export const resendVerificationEmail = async (email) => {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Resend verification error:', error);
    return { 
      success: false, 
      error: formatErrorMessage(error) 
    };
  }
};
