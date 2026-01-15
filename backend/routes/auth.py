"""
Authentication routes for student and teacher login.
Handles login, session management, and token validation.
"""
from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
import secrets
from database import get_db

# Create blueprint
auth_bp = Blueprint('auth', __name__)

# In-memory session store for teacher tokens
teacher_sessions = {}
TEACHER_SESSION_TTL = timedelta(hours=4)

@auth_bp.route('/login', methods=['POST'])
def login():
    """Student login endpoint"""
    data = request.get_json()
    if not data:
        return jsonify({"message": "No JSON data received"}), 400
    
    username = data.get('username')
    rollNumber = data.get('rollNumber')
    password = data.get('password')

    database = get_db()
    if database is not None:
        try:
            # Query MongoDB for matching student
            user = database.students.find_one({
                "username": username,
                "roll_number": rollNumber,
                "password": password
            })
            
            if user:
                return jsonify({"message": "Login successful"})
            else:
                return jsonify({"message": "Invalid credentials"})
        except Exception as e:
            print(f"Database login error: {e}")
            return jsonify({"message": "Database error occurred"}), 500
    else:
        return jsonify({"message": "Database connection failed"}), 500

@auth_bp.route('/teacher/login', methods=['POST'])
def teacher_login():
    """Teacher login endpoint"""
    data = request.get_json()
    if not data:
        return jsonify({"message": "No JSON data received"}), 400
    
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"message": "Username and password are required"}), 400
    
    database = get_db()
    if database is not None:
        try:
            # Query MongoDB for matching teacher with plain text password
            teacher = database.teachers.find_one({
                "username": username,
                "password": password
            })
            
            if teacher:
                # Create a secure random token and store session
                token = secrets.token_urlsafe(32)
                expires_at = datetime.utcnow() + TEACHER_SESSION_TTL
                teacher_sessions[token] = {"username": username, "expires_at": expires_at}

                return jsonify({
                    "message": "Login successful", 
                    "username": username,
                    "role": teacher.get("role", "teacher"),
                    "token": token,
                    "expires_at": expires_at.isoformat()
                })
            else:
                return jsonify({"message": "Invalid credentials"}), 401
        except Exception as e:
            print(f"Database teacher login error: {e}")
            return jsonify({"message": "Database error occurred"}), 500
    else:
        return jsonify({"message": "Database connection failed"}), 500

@auth_bp.route('/teacher/validate', methods=['GET'])
def teacher_validate():
    """Validate teacher session token"""
    token = request.args.get('token') or None
    auth_header = request.headers.get('Authorization')
    if not token and auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ', 1)[1].strip()

    if not token:
        return jsonify({'valid': False, 'message': 'No token provided'}), 401

    session = teacher_sessions.get(token)
    if not session:
        return jsonify({'valid': False, 'message': 'Invalid token'}), 401

    if session['expires_at'] < datetime.utcnow():
        # Expired
        teacher_sessions.pop(token, None)
        return jsonify({'valid': False, 'message': 'Token expired'}), 401

    return jsonify({'valid': True, 'username': session['username']})
