import { supabase } from '../supabaseClient';

/**
 * Check if an email is available for signup
 * @param {string} email - The email to check
 * @returns {Promise<{available: boolean, error?: string}>}
 */
export async function checkEmailAvailability(email) {
  if (!email || typeof email !== 'string') {
    return { available: false, error: 'Email is required' };
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { available: false, error: 'Invalid email format' };
  }

  try {
    // Call the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('check-email', {
      body: { email: email.trim() }
    });

    if (error) {
      console.error('Error checking email availability:', error);
      // Fail open - don't block signups if check fails
      return { available: true, error: null };
    }

    return {
      available: data?.available ?? true,
      error: null
    };
  } catch (err) {
    console.error('Exception checking email availability:', err);
    // Fail open - don't block signups if check fails
    return { available: true, error: null };
  }
}

