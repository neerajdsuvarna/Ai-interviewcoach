import { useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export const useHelpJam = () => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  // Production-ready function to set user attributes in HelpJam
  const setUserAttributes = useCallback(async (attributes) => {
    if (window.helpjam && window.helpjam.setUserAttributes) {
      try {
        window.helpjam.setUserAttributes(attributes);
        console.log('HelpJam user attributes updated successfully');
      } catch (error) {
        console.error('Error setting HelpJam attributes:', error);
      }
    } else {
      console.warn('HelpJam not available');
    }
  }, []);

  // Function to get comprehensive user data from Edge Function
  const getUserData = useCallback(async () => {
    if (!user) return null;

    try {
      // Get the current session to get the JWT token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('No session found:', sessionError);
        return null;
      }

      // Call the Edge Function
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/helpjam-user-data`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Edge Function error:', errorData);
        return null;
      }

      const userData = await response.json();
      return userData;
    } catch (error) {
      console.error('Error fetching user data from Edge Function:', error);
      return null;
    }
  }, [user]);

  // Wait for HelpJam to be fully loaded
  const waitForHelpJam = useCallback(() => {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait
      
      const checkHelpJam = () => {
        attempts++;
        
        if (window.helpjam && window.helpjam.setUserAttributes) {
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('HelpJam failed to load within timeout'));
        } else {
          setTimeout(checkHelpJam, 100);
        }
      };
      
      checkHelpJam();
    });
  }, []);

  // Production-ready function to update user attributes
  const updateUserAttributes = useCallback(async () => {
    if (!isAuthenticated || !user) return;

    try {
      // Wait for HelpJam to be ready
      await waitForHelpJam();

      // Get user data from our Edge Function
      const userData = await getUserData();
      
      if (!userData) {
        console.warn('No user data received from Edge Function');
        return;
      }
      
      // Format attributes according to your training article
      const attributes = {
        // Basic Information
        name: userData.name,
        email: userData.email,
        userId: userData.userId,
        isAuthenticated: userData.isAuthenticated,
        currentPage: location.pathname,
        
        // Account Summary
        totalPayments: userData.totalPayments,
        totalInterviews: userData.totalInterviews,
        startedInterviews: userData.startedInterviews,
        endedInterviews: userData.endedInterviews,
        
        // Payment Information
        allPayments: userData.allPayments,
        latestPayment: userData.latestPayment,
        
        // Interview Information
        allInterviews: userData.allInterviews,
        latestInterview: userData.latestInterview,
        currentInterview: userData.currentInterview
      };

      // Set attributes in HelpJam
      await setUserAttributes(attributes);
      
    } catch (error) {
      console.error('Error updating HelpJam user attributes:', error);
    }
  }, [user, isAuthenticated, location.pathname, getUserData, setUserAttributes, waitForHelpJam]);

  // Update user attributes when user changes or page changes
  useEffect(() => {
    updateUserAttributes();
  }, [updateUserAttributes]);

  return { setUserAttributes, updateUserAttributes };
};
