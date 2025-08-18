# Flask User Signup, Login, and Profile Upload System  

##  Project Overview  
This is a Flask-based web application that allows users to:  
- **Sign up** with a username, email, and password (with password confirmation).  
- **Log in** securely using bcrypt password hashing.  
- **Upload and manage profile data**, including an image, a video, age, and relation details.  
- **View and remove uploaded files** with Bootstrap-enhanced UI.  
- **Securely handle authentication** using Flask-Login.  

---

##  Technologies Used  
- **Flask** - Web framework  
- **Flask-SQLAlchemy** - ORM for database handling  
- **Flask-Login** - User authentication  
- **Flask-Bcrypt** - Secure password hashing  
- **SQLite** - Database for storing user data  

---

##  Installation & Setup  

### 1. Create a Virtual Environment (Recommended)  
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies  
```bash
pip install -r requirements.txt
```

### 3. Generate a Secret Key  
Flask requires a **SECRET_KEY** to manage sessions securely.  
To generate a secure random key, run the following command:  
```python
import secrets
print(secrets.token_hex(16))  # Generates a 32-character hex key
```
Copy the generated key and add it to `app.py`:  
```python
app.config['SECRET_KEY'] = 'your_generated_secret_key'
```

### 4. Run the Flask Application  
```bash
python app.py
```
By default, the app runs on `http://127.0.0.1:5000/`.  

---

##  Folder Structure  
```
/flask_ui
│── /static
│   ├── /uploads  # Stores uploaded images & videos
│   ├── styles.css  # Custom styles
│── /templates
│   ├── signup.html  # Signup page
│   ├── login.html  # Login page
│   ├── profile.html  # User profile page
│── models.py  # Database models
│── app.py  # Main Flask app
│── requirements.txt  # Dependencies
│── README.md  # Documentation
```

---

##  User Authentication  
- Uses **bcrypt** to securely store passwords.  
- `Flask-Login` manages sessions and authentication.  
- Users **must log in** before accessing their profile.  

### Signup Route (`/`)  
- Users register with a username, email, and password.  
- **Password confirmation** ensures input correctness.  
- If an email is already registered, an error message appears.  

### Login Route (`/login`)  
- Users can log in using their **email and password**.  
- If credentials are invalid, an error message appears.  
- After successful login, users are redirected to their profile.  

### Logout Route (`/logout`)  
- Logs out the user and redirects to the login page.  

---

##  Profile Management (`/profile`)  
- **Users can upload**:  
  - Profile image  
  - Profile video  
  - Age  
  - Relation details  
- **Preview uploaded files** before submission.  
- **Remove uploaded files** if needed.  
- Uses `secure_filename()` to prevent filename conflicts.  

###  File Handling  
- Uploaded files are stored in `/static/uploads/`.  
- Only the **filename** is saved in the database, not the actual file.  
- If a file is deleted from `/static/uploads/`, it is also **removed from the database** to prevent broken links.  
