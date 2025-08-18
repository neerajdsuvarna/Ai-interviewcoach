export function validateEnvironment() {
    const requiredVars = [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'VITE_API_BASE_URL'
    ];
  
    const missing = requiredVars.filter(varName => !import.meta.env[varName]);
  
    if (missing.length > 0) {
      console.error('Missing required environment variables:', missing);
      console.error('Please check your .env file and ensure all variables are set.');
      return false;
    }
  
    return true;
  }