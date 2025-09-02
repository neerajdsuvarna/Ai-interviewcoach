import { supabase } from '../supabaseClient';

/**
 * Checks if the user has any resume-job description pairings
 * and returns the appropriate redirect destination
 * 
 * @returns {Promise<string>} '/dashboard' if user has data, '/upload' if no data
 */
export const getSmartRedirectDestination = async () => {
  try {
    // Get current user session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log('No active session, redirecting to login');
      return '/login';
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    
    // Fetch dashboard data to check if user has any resume-job pairings
    const response = await fetch(`${supabaseUrl}/functions/v1/dashboard`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log('Failed to fetch dashboard data, defaulting to upload page');
      return '/upload';
    }

    const result = await response.json();
    
    if (result.success && result.data && result.data.length > 0) {
      console.log('User has data, redirecting to dashboard');
      return '/dashboard';
    } else {
      console.log('User has no data, redirecting to upload page');
      return '/upload';
    }
  } catch (error) {
    console.error('Error checking user data:', error);
    // Default to upload page on error
    return '/upload';
  }
};

/**
 * Smart redirect function that navigates to the appropriate page
 * based on user's data state
 * 
 * @param {Function} navigate - React Router's navigate function
 */
export const performSmartRedirect = async (navigate) => {
  console.log('🔄 Performing smart redirect...');
  const destination = await getSmartRedirectDestination();
  console.log(`🎯 Smart redirect destination: ${destination}`);
  navigate(destination);
};
