import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useRef } from 'react';

const ProtectedRoute = ({ children }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const hasLoggedAuth = useRef(false);

  // Only log authentication state once per mount
  useEffect(() => {
    if (!loading && !hasLoggedAuth.current) {
      if (isAuthenticated) {
        console.log('User authenticated:', user?.email);
      } else {
        console.log('User not authenticated, redirecting to login');
      }
      hasLoggedAuth.current = true;
    }
  }, [isAuthenticated, loading, user?.email]);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // If no user is logged in, redirect to login page
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If user is logged in, show the protected content
  return children;
};

export default ProtectedRoute;