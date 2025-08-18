import os
import requests
from functools import wraps
from flask import request, jsonify
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join("common", ".env"))

# Supabase Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

def verify_supabase_token(f):
    """
    Decorator to verify Supabase JWT tokens in Flask routes.
    Adds the user data to request.user if authentication is successful.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Handle OPTIONS requests without authentication
        if request.method == 'OPTIONS':
            return f(*args, **kwargs)
        
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "No valid authorization header"}), 401
        
        token = auth_header.split(' ')[1]
        
        try:
            # Verify JWT token with Supabase
            response = requests.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": SUPABASE_ANON_KEY
                }
            )
            
            if response.status_code != 200:
                return jsonify({"error": "Invalid token"}), 401
            
            user_data = response.json()
            request.user = user_data
            return f(*args, **kwargs)
            
        except Exception as e:
            print(f"Token verification error: {e}")
            return jsonify({"error": "Token verification failed"}), 401
    
    return decorated_function

def optional_auth(f):
    """
    Optional authentication decorator.
    Adds user data to request.user if token is provided, otherwise continues without auth.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Handle OPTIONS requests without authentication
        if request.method == 'OPTIONS':
            return f(*args, **kwargs)
        
        auth_header = request.headers.get('Authorization')
        
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            
            try:
                # Verify JWT token with Supabase
                response = requests.get(
                    f"{SUPABASE_URL}/auth/v1/user",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "apikey": SUPABASE_ANON_KEY
                    }
                )
                
                if response.status_code == 200:
                    user_data = response.json()
                    request.user = user_data
                else:
                    request.user = None
                    
            except Exception as e:
                print(f"Token verification error: {e}")
                request.user = None
        else:
            request.user = None
        
        return f(*args, **kwargs)
    
    return decorated_function