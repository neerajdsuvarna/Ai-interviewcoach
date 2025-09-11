import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';

const HelpJamDebug = () => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const [helpJamStatus, setHelpJamStatus] = useState('Checking...');
  const [userAttributes, setUserAttributes] = useState(null);

  useEffect(() => {
    const checkHelpJam = () => {
      if (window.helpjam && window.helpjam.setUserAttributes) {
        setHelpJamStatus('✅ HelpJam is ready');
        
        // Test setting attributes
        const testAttributes = {
          userId: user?.id || 'guest',
          email: user?.email || 'not-logged-in',
          fullName: user?.user_metadata?.full_name || 'Guest User',
          currentPage: location.pathname,
          testTime: new Date().toISOString()
        };
        
        window.helpjam.setUserAttributes(testAttributes);
        setUserAttributes(testAttributes);
        console.log('🧪 Test attributes set:', testAttributes);
      } else {
        setHelpJamStatus('❌ HelpJam not ready');
        setTimeout(checkHelpJam, 1000);
      }
    };

    checkHelpJam();
  }, [user, location.pathname]);

  if (process.env.NODE_ENV === 'production') {
    return null; // Don't show in production
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '100px',
      right: '20px',
      background: '#f0f0f0',
      border: '1px solid #ccc',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      maxWidth: '300px',
      zIndex: 9999
    }}>
      <h4>HelpJam Debug</h4>
      <p><strong>Status:</strong> {helpJamStatus}</p>
      <p><strong>User:</strong> {isAuthenticated ? user?.email : 'Not logged in'}</p>
      <p><strong>Page:</strong> {location.pathname}</p>
      {userAttributes && (
        <div>
          <p><strong>Attributes sent:</strong></p>
          <pre style={{ fontSize: '10px', overflow: 'auto' }}>
            {JSON.stringify(userAttributes, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default HelpJamDebug;
