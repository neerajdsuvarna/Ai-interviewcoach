import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { OperationProvider } from './contexts/OperationContext';
import { validateEnvironment } from '../envValidation';
import { supabase } from './supabaseClient';


// Validate environment variables
if (!validateEnvironment()) {
  throw new Error('Environment validation failed. Please check your .env file.');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <OperationProvider>
          <App />
        </OperationProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);