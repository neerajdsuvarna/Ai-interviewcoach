import mixpanel from 'mixpanel-browser';

// Initialize Mixpanel
const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;

if (MIXPANEL_TOKEN) {
  mixpanel.init(MIXPANEL_TOKEN, {
    debug: import.meta.env.DEV, // Enable debug mode in development
    track_pageview: false, // We'll handle page views manually
    persistence: 'localStorage',
    api_host: 'https://api.mixpanel.com',
    // CORS and network configuration
    cross_subdomain_cookie: false,
    secure_cookie: false,
    // Add batch configuration to reduce requests
    batch_requests: true,
    batch_size: 50,
    batch_flush_interval_ms: 5000,
    // Add retry configuration
    retry_queue_size: 1000,
    // Add error handling
    ignore_dnt: true,
    // Use JSONP for CORS issues (fallback)
    use_jsonp: true
  });
} else {
  console.warn('Mixpanel token not found. Analytics will be disabled.');
}

// Generate a unique session ID using crypto.randomUUID() for better security and uniqueness
const generateSessionId = () => {
  try {
    // Use crypto.randomUUID() if available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `session_${Date.now()}_${crypto.randomUUID()}`;
    }
    // Fallback for older browsers
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${Math.random().toString(36).substr(2, 9)}`;
  } catch (error) {
    console.warn('Failed to generate secure session ID, using fallback:', error);
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${Math.random().toString(36).substr(2, 9)}`;
  }
};

// Get or create session ID
const getSessionId = () => {
  let sessionId = localStorage.getItem('mixpanel_session_id');
  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem('mixpanel_session_id', sessionId);
  }
  return sessionId;
};

// Get current page URL
const getCurrentPageUrl = () => {
  return window.location.href;
};

// Get user agent
const getUserAgent = () => {
  return navigator.userAgent;
};

// Get current user ID from Mixpanel's identified user
const getCurrentUserId = () => {
  try {
    const distinctId = mixpanel.get_distinct_id();
    // Only return the ID if it's not a device ID (device IDs start with $device:)
    if (distinctId && !distinctId.startsWith('$device:')) {
      return distinctId;
    }
    return null;
  } catch (error) {
    return null;
  }
};

// Helper function to get user ID from auth context (for manual tracking)
export const getUserIdFromAuth = () => {
  try {
    // This will be called from components that have access to auth context
    return null; // Will be overridden by components
  } catch (error) {
    return null;
  }
};

// Debounce utility for high-frequency events
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Validate and sanitize event properties
const validateEventProperties = (properties) => {
  const maxStringLength = 255;
  const maxArrayLength = 100;
  const validated = {};
  
  for (const [key, value] of Object.entries(properties)) {
    try {
      if (value === null || value === undefined) {
        // Skip null/undefined values
        continue;
      }
      
      if (typeof value === 'string') {
        if (value.length > maxStringLength) {
          console.warn(`Property "${key}" exceeds max length (${maxStringLength}), truncating`);
          validated[key] = value.substring(0, maxStringLength);
        } else {
          validated[key] = value;
        }
      } else if (Array.isArray(value)) {
        if (value.length > maxArrayLength) {
          console.warn(`Property "${key}" array exceeds max length (${maxArrayLength}), truncating`);
          validated[key] = value.slice(0, maxArrayLength);
        } else {
          validated[key] = value;
        }
      } else if (typeof value === 'object') {
        // Recursively validate nested objects
        validated[key] = validateEventProperties(value);
      } else {
        // Numbers, booleans, etc. - pass through
        validated[key] = value;
      }
    } catch (error) {
      console.warn(`Error validating property "${key}":`, error);
      // Skip problematic properties
    }
  }
  
  return validated;
};

// Base event properties that will be included with every event
const getBaseProperties = () => {
  const userId = getCurrentUserId();
  return {
    session_id: getSessionId(),
    timestamp: new Date().toISOString(),
    page_url: getCurrentPageUrl(),
    user_agent: getUserAgent(),
    platform: 'web',
    ...(userId && { user_id: userId })
  };
};

// Error handling and fallback mechanism
const handleMixpanelError = (operation, error, fallbackData = null) => {
  console.error(`❌ Mixpanel ${operation} error:`, error);
  
  // Store failed events in localStorage for potential retry
  if (fallbackData) {
    try {
      const failedEvents = JSON.parse(localStorage.getItem('mixpanel_failed_events') || '[]');
      failedEvents.push({
        operation,
        data: fallbackData,
        timestamp: new Date().toISOString(),
        error: error.message || error.toString()
      });
      
      // Keep only last 100 failed events
      if (failedEvents.length > 100) {
        failedEvents.splice(0, failedEvents.length - 100);
      }
      
      localStorage.setItem('mixpanel_failed_events', JSON.stringify(failedEvents));
    } catch (storageError) {
      console.warn('Failed to store Mixpanel error in localStorage:', storageError);
    }
  }
  
  // Check if it's a CORS error
  if (error.message && error.message.includes('CORS')) {
    console.warn('🚨 CORS error detected. This might be due to network restrictions or browser security policies.');
    console.warn('💡 Consider using a proxy or checking network/firewall settings.');
  }
};

// Mixpanel service object
export const mixpanelService = {
  // Initialize user identification
  identify: (userId, userProperties = {}) => {
    if (!MIXPANEL_TOKEN) return;
    
    try {
      mixpanel.identify(userId);
      mixpanel.people.set({
        $first_name: userProperties.first_name || userProperties.full_name,
        $email: userProperties.email,
        $created: new Date().toISOString(),
        ...userProperties
      });
      console.log('✅ Mixpanel user identified:', userId);
    } catch (error) {
      handleMixpanelError('identify', error, { userId, userProperties });
    }
  },

  // Track an event
  track: (eventName, properties = {}) => {
    if (!MIXPANEL_TOKEN) return;
    
    try {
      const eventProperties = {
        ...getBaseProperties(),
        ...properties
      };
      
      // Validate and sanitize properties
      const validatedProperties = validateEventProperties(eventProperties);
      
      mixpanel.track(eventName, validatedProperties);
      console.log('📊 Mixpanel event tracked:', eventName, validatedProperties);
    } catch (error) {
      handleMixpanelError('track', error, { eventName, properties });
    }
  },

  // Track page view
  trackPageView: (pageName, properties = {}) => {
    if (!MIXPANEL_TOKEN) return;
    
    try {
      const eventProperties = {
        ...getBaseProperties(),
        page_name: pageName,
        ...properties
      };
      
      // Validate and sanitize properties
      const validatedProperties = validateEventProperties(eventProperties);
      
      mixpanel.track('Page View', validatedProperties);
      console.log('📄 Mixpanel page view tracked:', pageName, validatedProperties);
    } catch (error) {
      handleMixpanelError('trackPageView', error, { pageName, properties });
    }
  },

  // Set user properties
  setUserProperties: (properties) => {
    if (!MIXPANEL_TOKEN) return;
    
    try {
      mixpanel.people.set(properties);
      console.log('👤 Mixpanel user properties set:', properties);
    } catch (error) {
      handleMixpanelError('setUserProperties', error, { properties });
    }
  },

  // Track timing events (for interview duration, etc.)
  trackTiming: (eventName, duration, properties = {}) => {
    if (!MIXPANEL_TOKEN) return;
    
    try {
      const eventProperties = {
        ...getBaseProperties(),
        duration_seconds: duration,
        duration_minutes: Math.round(duration / 60 * 100) / 100,
        ...properties
      };
      
      // Validate and sanitize properties
      const validatedProperties = validateEventProperties(eventProperties);
      
      mixpanel.track(eventName, validatedProperties);
      console.log('⏱️ Mixpanel timing event tracked:', eventName, validatedProperties);
    } catch (error) {
      handleMixpanelError('trackTiming', error, { eventName, duration, properties });
    }
  },

  // Reset user (for logout)
  reset: () => {
    if (!MIXPANEL_TOKEN) return;
    
    try {
      mixpanel.reset();
      localStorage.removeItem('mixpanel_session_id');
      console.log('🔄 Mixpanel user reset');
    } catch (error) {
      handleMixpanelError('reset', error);
    }
  },

  // Debounced tracking for high-frequency events
  debouncedTrack: debounce((eventName, properties) => {
    if (!MIXPANEL_TOKEN) return;
    
    try {
      const eventProperties = {
        ...getBaseProperties(),
        ...properties
      };
      
      // Validate and sanitize properties
      const validatedProperties = validateEventProperties(eventProperties);
      
      mixpanel.track(eventName, validatedProperties);
      console.log('📊 Mixpanel debounced event tracked:', eventName, validatedProperties);
    } catch (error) {
      handleMixpanelError('debouncedTrack', error, { eventName, properties });
    }
  }, 100), // 100ms debounce

  // Debounced page view tracking
  debouncedTrackPageView: debounce((pageName, properties) => {
    if (!MIXPANEL_TOKEN) return;
    
    try {
      const eventProperties = {
        ...getBaseProperties(),
        page_name: pageName,
        ...properties
      };
      
      // Validate and sanitize properties
      const validatedProperties = validateEventProperties(eventProperties);
      
      mixpanel.track('Page View', validatedProperties);
      console.log('📄 Mixpanel debounced page view tracked:', pageName, validatedProperties);
    } catch (error) {
      handleMixpanelError('debouncedTrackPageView', error, { pageName, properties });
    }
  }, 200), // 200ms debounce for page views

  // Retry failed events
  retryFailedEvents: () => {
    try {
      const failedEvents = JSON.parse(localStorage.getItem('mixpanel_failed_events') || '[]');
      if (failedEvents.length === 0) {
        console.log('📊 No failed Mixpanel events to retry');
        return;
      }

      console.log(`🔄 Retrying ${failedEvents.length} failed Mixpanel events`);
      
      failedEvents.forEach((failedEvent, index) => {
        try {
          switch (failedEvent.operation) {
            case 'track':
              mixpanel.track(failedEvent.data.eventName, failedEvent.data.properties);
              break;
            case 'identify':
              mixpanel.identify(failedEvent.data.userId);
              if (failedEvent.data.userProperties) {
                mixpanel.people.set(failedEvent.data.userProperties);
              }
              break;
            case 'setUserProperties':
              mixpanel.people.set(failedEvent.data.properties);
              break;
            default:
              console.warn(`Unknown operation: ${failedEvent.operation}`);
          }
        } catch (retryError) {
          console.warn(`Failed to retry event ${index}:`, retryError);
        }
      });

      // Clear failed events after retry
      localStorage.removeItem('mixpanel_failed_events');
      console.log('✅ Failed events retry completed');
    } catch (error) {
      console.error('❌ Error retrying failed events:', error);
    }
  },

  // Get failed events count for debugging
  getFailedEventsCount: () => {
    try {
      const failedEvents = JSON.parse(localStorage.getItem('mixpanel_failed_events') || '[]');
      return failedEvents.length;
    } catch (error) {
      return 0;
    }
  },

  // Clear failed events
  clearFailedEvents: () => {
    localStorage.removeItem('mixpanel_failed_events');
    console.log('🗑️ Cleared failed Mixpanel events');
  },

  // Debug utility to check Mixpanel status
  debug: () => {
    const debugInfo = {
      token: MIXPANEL_TOKEN ? 'Present' : 'Missing',
      tokenLength: MIXPANEL_TOKEN ? MIXPANEL_TOKEN.length : 0,
      failedEventsCount: mixpanelService.getFailedEventsCount(),
      sessionId: getSessionId(),
      currentUserId: getCurrentUserId(),
      userAgent: getUserAgent(),
      currentUrl: getCurrentPageUrl(),
      localStorage: {
        mixpanel_session_id: localStorage.getItem('mixpanel_session_id'),
        mixpanel_failed_events: localStorage.getItem('mixpanel_failed_events')
      }
    };
    
    console.log('🔍 Mixpanel Debug Info:', debugInfo);
    return debugInfo;
  },

  // Test Mixpanel connectivity
  testConnectivity: () => {
    console.log('🧪 Testing Mixpanel connectivity...');
    
    try {
      // Test basic tracking
      mixpanel.track('Connectivity Test', {
        test_timestamp: new Date().toISOString(),
        test_source: 'debug_utility'
      });
      console.log('✅ Mixpanel connectivity test sent');
      
      // Check for errors after a short delay
      setTimeout(() => {
        const failedCount = mixpanelService.getFailedEventsCount();
        if (failedCount > 0) {
          console.warn(`⚠️ ${failedCount} events failed after connectivity test`);
        } else {
          console.log('✅ No failed events detected');
        }
      }, 2000);
      
    } catch (error) {
      console.error('❌ Mixpanel connectivity test failed:', error);
      handleMixpanelError('testConnectivity', error);
    }
  }
};

// Event tracking functions for specific InterviewCoach events
export const trackEvents = {
  // Landing page visit
  landingPageVisit: () => {
    mixpanelService.track('Landing Page Visit', {
      event_category: 'navigation',
      event_action: 'page_visit',
      page_name: 'Landing Page'
    });
  },

  // User sign up
  signUp: (userProperties) => {
    mixpanelService.track('Sign Up', {
      event_category: 'authentication',
      event_action: 'user_registration',
      signup_method: 'email',
      ...userProperties
    });
  },

  // Email verified
  emailVerified: (userProperties) => {
    mixpanelService.track('Email Verified', {
      event_category: 'authentication',
      event_action: 'email_verification',
      ...userProperties
    });
  },

  // User sign in
  signIn: (userProperties) => {
    mixpanelService.track('Sign In', {
      event_category: 'authentication',
      event_action: 'user_login',
      login_method: 'email',
      ...userProperties
    });
  },

  // User sign out
  signOut: (userProperties) => {
    mixpanelService.track('Sign Out', {
      event_category: 'authentication',
      event_action: 'user_logout',
      ...userProperties
    });
  },

  // Payment page visit
  paymentPage: (properties) => {
    mixpanelService.track('Payment Page Visit', {
      event_category: 'payment',
      event_action: 'payment_page_visit',
      page_name: 'Payment Page',
      ...properties
    });
  },

  // Payment completed
  paymentCompleted: (properties) => {
    mixpanelService.track('Payment Completed', {
      event_category: 'payment',
      event_action: 'payment_success',
      ...properties
    });
  },

  // Payment failure
  paymentFailure: (properties) => {
    mixpanelService.track('Payment Failure', {
      event_category: 'payment',
      event_action: 'payment_failed',
      ...properties
    });
  },

  // Resume uploaded
  resumeUploaded: (properties) => {
    mixpanelService.track('Resume Uploaded', {
      event_category: 'content',
      event_action: 'file_upload',
      file_type: 'resume',
      ...properties
    });
  },

  // Job description saved (during question generation)
  jobDescriptionSaved: (properties) => {
    mixpanelService.track('Job Description Saved', {
      event_category: 'content',
      event_action: 'job_description_save',
      ...properties
    });
  },

  // Questions generated
  questionsGenerated: (properties) => {
    mixpanelService.track('Questions Generated', {
      event_category: 'content',
      event_action: 'question_generation',
      ...properties
    });
  },

  // Questions regenerated
  questionsRegenerated: (properties) => {
    mixpanelService.track('Questions Regenerated', {
      event_category: 'content',
      event_action: 'question_regeneration',
      ...properties
    });
  },

  // Mock interview scheduled
  mockInterviewScheduled: (properties) => {
    mixpanelService.track('Mock Interview Scheduled', {
      event_category: 'interview',
      event_action: 'interview_scheduled',
      ...properties
    });
  },

  // Participated in mock interview
  participatedInMockInterview: (properties) => {
    console.log('🎯 participatedInMockInterview called with properties:', properties);
    mixpanelService.track('Interview Completed', {
      event_category: 'interview',
      event_action: 'interview_completed',
      ...properties
    });
    console.log('✅ participatedInMockInterview event sent to Mixpanel');
  },

  // Mock interview feedback generated
  mockInterviewFeedbackGenerated: (properties) => {
    console.log('🎯 mockInterviewFeedbackGenerated called with properties:', properties);
    mixpanelService.track('Interview Feedback Generated', {
      event_category: 'feedback',
      event_action: 'feedback_generation',
      ...properties
    });
    console.log('✅ mockInterviewFeedbackGenerated event sent to Mixpanel');
  },

  // Questions accessed
  questionsAccessed: (properties) => {
    mixpanelService.track('Questions Accessed', {
      event_category: 'content',
      event_action: 'questions_viewed',
      page_name: 'Questions Page',
      ...properties
    });
  },

  // Interview feedback accessed
  interviewFeedbackAccessed: (properties) => {
    mixpanelService.track('Interview Feedback Accessed', {
      event_category: 'feedback',
      event_action: 'feedback_viewed',
      page_name: 'Interview Feedback Page',
      ...properties
    });
  },

  // Rescheduled mock interview
  rescheduledMockInterview: (properties) => {
    mixpanelService.track('Retake Mock Interview', {
      event_category: 'interview',
      event_action: 'interview_rescheduled',
      ...properties
    });
  },

  // High-frequency events (use debounced tracking)
  
  // Page scroll tracking (for scroll depth analysis)
  pageScroll: (properties) => {
    mixpanelService.debouncedTrack('Page Scroll', {
      event_category: 'engagement',
      event_action: 'scroll',
      ...properties
    });
  },

  // Mouse movement tracking (for engagement analysis)
  mouseMovement: (properties) => {
    mixpanelService.debouncedTrack('Mouse Movement', {
      event_category: 'engagement',
      event_action: 'mouse_move',
      ...properties
    });
  },

  // Button hover tracking (for UI interaction analysis)
  buttonHover: (properties) => {
    mixpanelService.debouncedTrack('Button Hover', {
      event_category: 'engagement',
      event_action: 'button_hover',
      ...properties
    });
  },

  // Form field interaction tracking
  formFieldInteraction: (properties) => {
    mixpanelService.debouncedTrack('Form Field Interaction', {
      event_category: 'engagement',
      event_action: 'form_interaction',
      ...properties
    });
  }
};

export default mixpanelService;
