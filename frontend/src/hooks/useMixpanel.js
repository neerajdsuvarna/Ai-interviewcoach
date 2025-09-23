import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { mixpanelService, trackEvents } from '../services/mixpanel';

export const useMixpanel = () => {
  const { user, isAuthenticated } = useAuth();

  // Auto-identify user when they log in
  useEffect(() => {
    if (isAuthenticated && user) {
      mixpanelService.identify(user.id, {
        email: user.email,
        full_name: user.user_metadata?.full_name,
        created_at: user.created_at,
        email_confirmed_at: user.email_confirmed_at
      });
    } else if (!isAuthenticated && user === null) {
      // Only reset when user is explicitly null (not just undefined during loading)
      // Add a small delay to ensure any pending events are processed
      const resetTimer = setTimeout(() => {
        mixpanelService.reset();
      }, 100);
      
      return () => clearTimeout(resetTimer);
    }
  }, [isAuthenticated, user]);

  return {
    // Direct access to mixpanel service
    mixpanel: mixpanelService,
    
    // Pre-configured event tracking functions
    track: trackEvents,
    
    // Helper function to track with user context
    trackWithUser: (eventName, properties = {}) => {
      const userProperties = user ? {
        user_id: user.id,
        user_email: user.email,
        ...properties
      } : properties;
      
      mixpanelService.track(eventName, userProperties);
    },
    
    // Debounced tracking for high-frequency events
    debouncedTrack: (eventName, properties = {}) => {
      const userProperties = user ? {
        user_id: user.id,
        user_email: user.email,
        ...properties
      } : properties;
      
      mixpanelService.debouncedTrack(eventName, userProperties);
    },
    
    // Get current user info
    getCurrentUser: () => user
  };
};

export default useMixpanel;
