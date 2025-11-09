from flask import Flask, jsonify, request
from flask_cors import CORS
import cv2
import numpy as np
import mediapipe as mp
import os
from datetime import datetime
import requests
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from bson import ObjectId, Binary
import pickle
import time
import threading
import json
from collections import deque
import secrets
from datetime import timedelta

app = Flask(__name__)
CORS(app)

# MongoDB Configuration
MONGO_URI = "mongodb+srv://kartikbansal9152_db_user:TDYGu9eIsZpL6k4b@proj101.gfemks2.mongodb.net/?appName=Proj101"
DB_NAME = "ai_proctor_db"

# Global MongoDB client
mongo_client = None
db = None

# In-memory storage for registered faces only
registered_faces = set()

# In-memory storage for UFM data (for testing without database)
ufm_storage = []

# Simple in-memory session store for teacher tokens (token -> {username, expires_at})
teacher_sessions = {}
TEACHER_SESSION_TTL = timedelta(hours=4)

# Thread-safe queue for streaming audio anomaly events (SSE)
audio_event_queue = deque()
audio_queue_lock = threading.Lock()
MAX_AUDIO_QUEUE = 200

# Load YOLOv5 model
print("Skipping YOLO model loading for testing...")
YOLO_AVAILABLE = False
model = None

# Face Recognition Model (LBPH)
face_recognizer = None
face_labels = {}  # {roll_number: label_id}
label_counter = 0

def get_mongo_client():
    """Create and return MongoDB client"""
    global mongo_client
    try:
        if mongo_client is None:
            print("Establishing MongoDB connection...")
            mongo_client = MongoClient(
                MONGO_URI,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=10000,
                socketTimeoutMS=10000
            )
            # Test connection
            mongo_client.admin.command('ping')
            print(f"✓ Successfully connected to MongoDB")
        return mongo_client
    except ConnectionFailure as e:
        print(f"✗ MongoDB connection failed: {e}")
        return None
def get_db_connection():
    """Create and return MongoDB database connection"""
    global db
    try:
        if db is None:
            mongo_client = get_mongo_client()
            if mongo_client is not None:
                db = mongo_client[DB_NAME]
                print(f"✓ Successfully connected to database: {DB_NAME}")
            else:
                return None
        return db
    except Exception as e:
        print(f"✗ Database connection error: {e}")
        return None


def init_face_recognizer():
    """Initialize or load face recognizer"""
    global face_recognizer, face_labels, label_counter
    try:
        face_recognizer = cv2.face.LBPHFaceRecognizer_create()
        database = get_db_connection()
        if database is not None:
            # Try to load existing model from MongoDB
            model_doc = database.face_models.find_one({'model_type': 'lbph_primary'})
            if model_doc:
                # Load model from binary data
                model_bytes = model_doc['model_data']
                with open('temp_model.yml', 'wb') as f:
                    f.write(model_bytes)
                face_recognizer.read('temp_model.yml')
                os.remove('temp_model.yml')
                
                face_labels = model_doc.get('labels', {})
                label_counter = model_doc.get('label_counter', 0)
                print(f"✓ Loaded existing face recognizer with {len(face_labels)} registered faces")
            else:
                print("ℹ No existing face recognition model found - will train on first registration")
    except Exception as e:
        print(f"Warning: Failed to initialize face recognizer: {e}")
        face_recognizer = cv2.face.LBPHFaceRecognizer_create()

def init_database():
    """Simple database initialization - always return True for now"""
    try:
        # Try to connect to MongoDB
        database = get_db_connection()
        if database is not None:
            print("✓ MongoDB connection successful")
            init_face_recognizer()
            return True
        else:
            print("✗ MongoDB connection failed - continuing without database")
            init_face_recognizer()
            return True  # Allow server to start anyway
    except Exception as e:
        print(f"Database init error: {e} - continuing without database")
        init_face_recognizer()
        return True

@app.route('/log-alert', methods=['POST'])
def log_alert():
    data = request.get_json()
    student_id = data.get('student_id')
    direction = data.get('direction')
    time = data.get('time')
    exam_id = data.get('exam_id', 'exam_2025_ai')  # Default exam_id if not provided
    
    if student_id and direction and time:
        database = get_db_connection()
        if database is not None:
            try:
                alert_doc = {
                    "student_id": student_id,
                    "exam_id": exam_id,  # Store exam_id at top level
                    "direction": direction,
                    "alert_time": datetime.now(),
                    "details": data,
                    "created_at": datetime.now()
                }
                database.alerts.insert_one(alert_doc)
                return jsonify({'status': 'ok'})
            except Exception as e:
                print(f"Database logging error: {e}")
                return jsonify({'status': 'error', 'message': 'Database error'}), 500
        else:
            return jsonify({'status': 'error', 'message': 'Database connection failed'}), 500
    return jsonify({'status': 'error', 'message': 'Missing data'}), 400

@app.route('/alerts', methods=['GET'])
def get_alerts():
    database = get_db_connection()
    if database is not None:
        try:
            # Fetch all alerts, sorted by alert_time descending
            alerts_cursor = database.alerts.find().sort("alert_time", -1)
            
            alerts = []
            for alert in alerts_cursor:
                alerts.append({
                    'student_id': alert.get('student_id'),
                    'direction': alert.get('direction'),
                    'alert_time': alert.get('alert_time').isoformat() if alert.get('alert_time') else None,
                    'details': alert.get('details', {})
                })
            
            return jsonify(alerts)
        except Exception as e:
            print(f"Database fetch error: {e}")
            return jsonify({'error': 'Database error'}), 500
    else:
        return jsonify({'error': 'Database connection failed'}), 500

@app.route('/registered-faces', methods=['GET'])
def get_registered_faces():
    return jsonify({'registered_faces': list(registered_faces)})

@app.route('/test-connection', methods=['GET'])
def test_connection():
    """Test MongoDB connection endpoint"""
    database = get_db_connection()
    if database is not None:
        try:
            # Get the mongo client to ping
            mongo_client = get_mongo_client()
            if mongo_client is None:
                return jsonify({
                    'status': 'error',
                    'message': 'Failed to get MongoDB client'
                }), 500

            # Ping the database
            mongo_client.admin.command('ping')
            student_count = database.students.count_documents({})
            alerts_count = database.alerts.count_documents({})
            
            return jsonify({
                'status': 'success',
                'message': 'MongoDB connection successful',
                'database': DB_NAME,
                'students_count': student_count,
                'alerts_count': alerts_count,
                'collections': database.list_collection_names()
            })
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': f'Database test failed: {str(e)}'
            }), 500
    else:
        return jsonify({
            'status': 'error',
            'message': 'Database connection failed'
        }), 500

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify({"message": "No JSON data received"}), 400
    
    username = data.get('username')
    rollNumber = data.get('rollNumber')
    password = data.get('password')

    database = get_db_connection()
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

@app.route('/teacher/login', methods=['POST'])
def teacher_login():
    data = request.get_json()
    if not data:
        return jsonify({"message": "No JSON data received"}), 400
    
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"message": "Username and password are required"}), 400
    
    database = get_db_connection()
    if database is not None:
        try:
            # Query MongoDB for matching teacher with plain text password
            teacher = database.teachers.find_one({
                "username": username,
                "password": password
            })
            
            if teacher:
                # create a secure random token and store session
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


@app.route('/teacher/validate', methods=['GET'])
def teacher_validate():
    """Validate teacher session token. Clients should send ?token=<token> or Authorization: Bearer <token>"""
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
        # expired
        teacher_sessions.pop(token, None)
        return jsonify({'valid': False, 'message': 'Token expired'}), 401

    return jsonify({'valid': True, 'username': session['username']})

# Initialize MediaPipe Face Mesh
try:
    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(static_image_mode=False, max_num_faces=1)
except Exception as e:
    print(f"Warning: Failed to initialize MediaPipe Face Mesh: {e}")
    mp_face_mesh = None
    face_mesh = None
model_points = np.array([
    (0.0, 0.0, 0.0),
    (0.0, -330.0, -65.0),
    (-225.0, 170.0, -135.0),
    (225.0, 170.0, -135.0),
    (-150.0, -150.0, -125.0),
    (150.0, -150.0, -125.0)
], dtype=np.float64)
landmark_ids = [1, 152, 263, 33, 287, 57]
YAW_THRESHOLD, PITCH_THRESHOLD, ROLL_THRESHOLD = 30, 20, 30

@app.route('/detect-head', methods=['POST'])
def detect_head():
    if face_mesh is None:
        return jsonify({'error': 'Face mesh detection not available'}), 503
    
    file = request.files['image']
    npimg = np.frombuffer(file.read(), np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    h, w = frame.shape[:2]
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb)
    direction, yaw, pitch, roll = "No face detected", 0, 0, 0

    if results.multi_face_landmarks:
        face_landmarks = results.multi_face_landmarks[0]
        image_points = []
        for idx in landmark_ids:
            pt = face_landmarks.landmark[idx]
            x, y = int(pt.x * w), int(pt.y * h)
            image_points.append((x, y))
        image_points = np.array(image_points, dtype=np.float64)
        focal_length = w
        center = (w / 2, h / 2)
        camera_matrix = np.array([
            [focal_length, 0, center[0]],
            [0, focal_length, center[1]],
            [0, 0, 1]
        ], dtype=np.float64)
        dist_coeffs = np.zeros((4, 1))
        success, rotation_vector, translation_vector = cv2.solvePnP(
            model_points, image_points, camera_matrix, dist_coeffs)
        rmat, _ = cv2.Rodrigues(rotation_vector)
        angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
        pitch, yaw, roll = angles
        direction = "Looking Forward"
        if yaw > YAW_THRESHOLD:
            direction = "ALERT: Looking Right"
        elif yaw < -YAW_THRESHOLD:
            direction = "ALERT: Looking Left"
        elif pitch > PITCH_THRESHOLD:
            direction = "ALERT: Looking Down"
        elif pitch < -PITCH_THRESHOLD:
            direction = "ALERT: Looking Up"
        elif abs(roll) > ROLL_THRESHOLD:
            direction = "ALERT: Tilting Head"

    return jsonify({'direction': direction, 'yaw': float(yaw), 'pitch': float(pitch), 'roll': float(roll)})

try:
    mp_face_detection = mp.solutions.face_detection
    face_detection = mp_face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.5)
except Exception as e:
    print(f"Warning: Failed to initialize MediaPipe Face Detection: {e}")
    mp_face_detection = None
    face_detection = None

@app.route('/register-face', methods=['POST'])
def register_face():
    if face_detection is None:
        return jsonify({'error': 'Face detection not available'}), 503
    
    global face_labels, label_counter
    
    roll_number = request.form['roll_number']
    exam_id = request.form.get('exam_id', 'exam_2025_ai')
    file = request.files['image']
    npimg = np.frombuffer(file.read(), np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    if frame is None:
        return jsonify({'status': 'no_face'})
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    if rgb is None or rgb.size == 0:
        return jsonify({'status': 'no_face'})
    results = face_detection.process(rgb)
    if results.detections:
        if len(results.detections) == 1:
            registered_faces.add(roll_number)
            
            # Assign label ID for this student
            if roll_number not in face_labels:
                face_labels[roll_number] = label_counter
                label_counter += 1
            
            label_id = face_labels[roll_number]
            
            database = get_db_connection()
            if database is not None:
                try:
                    success, encoded_image = cv2.imencode('.jpg', frame)
                    if success:
                        # Store image and face descriptor
                        face_doc = {
                            'roll_number': roll_number,
                            'exam_id': exam_id,
                            'image_data': Binary(encoded_image.tobytes()),
                            'label_id': label_id,
                            'updated_at': datetime.now()
                        }
                        database.registered_faces.update_one(
                            {'roll_number': roll_number, 'exam_id': exam_id},
                            {'$set': face_doc},
                            upsert=True
                        )
                        
                        # Retrain recognizer with all stored faces
                        retrain_face_recognizer(database)
                        
                except Exception as e:
                    print(f"Error storing face image: {e}")
            return jsonify({'status': 'registered'})
        else:
            return jsonify({'status': 'multiple_faces'})
    else:
        return jsonify({'status': 'no_face'})

def retrain_face_recognizer(database):
    """Retrain face recognizer with all registered faces from MongoDB"""
    global face_recognizer
    try:
        # Fetch all registered faces
        faces_cursor = database.registered_faces.find({})
        faces_list = []
        labels_list = []
        
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        for face_doc in faces_cursor:
            image_bytes = face_doc['image_data']
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Detect face region
            face_rects = face_cascade.detectMultiScale(gray, 1.3, 5)
            if len(face_rects) > 0:
                (x, y, w, h) = face_rects[0]
                face_roi = gray[y:y+h, x:x+w]
                face_roi = cv2.resize(face_roi, (200, 200))
                faces_list.append(face_roi)
                labels_list.append(face_doc['label_id'])
        
        if len(faces_list) > 0:
            # Train recognizer
            face_recognizer.train(faces_list, np.array(labels_list))
            
            # Save model to MongoDB
            face_recognizer.write('temp_model.yml')
            with open('temp_model.yml', 'rb') as f:
                model_bytes = f.read()
            os.remove('temp_model.yml')
            
            database.face_models.update_one(
                {'model_type': 'lbph_primary'},
                {'$set': {
                    'model_data': model_bytes,
                    'labels': face_labels,
                    'label_counter': label_counter,
                    'updated_at': datetime.now()
                }},
                upsert=True
            )
            print(f"✓ Retrained face recognizer with {len(faces_list)} faces")
    except Exception as e:
        print(f"Error retraining face recognizer: {e}")

@app.route('/verify-face', methods=['POST'])
def verify_face():
    if face_detection is None or face_recognizer is None:
        return jsonify({'error': 'Face detection/recognition not available'}), 503
    
    roll_number = request.form['roll_number']
    file = request.files['image']
    npimg = np.frombuffer(file.read(), np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # First check with MediaPipe for face detection
    results = face_detection.process(rgb)
    if not results.detections:
        return jsonify({'status': 'no_face'})
    elif len(results.detections) > 1:
        return jsonify({'status': 'multiple_faces'})
    else:
        # Use OpenCV Haar Cascade for face ROI extraction
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        face_rects = face_cascade.detectMultiScale(gray, 1.3, 5)
        
        if len(face_rects) == 0:
            return jsonify({'status': 'no_face'})
        
        # Get largest face
        (x, y, w, h) = max(face_rects, key=lambda r: r[2] * r[3])
        face_roi = gray[y:y+h, x:x+w]
        face_roi = cv2.resize(face_roi, (200, 200))
        
        # Recognize face using LBPH
        if roll_number in face_labels:
            expected_label = face_labels[roll_number]
            predicted_label, confidence = face_recognizer.predict(face_roi)
            
            # Lower confidence = better match (distance metric)
            if predicted_label == expected_label and confidence < 70:
                return jsonify({
                    'status': 'match',
                    'confidence': float(confidence),
                    'recognized_as': roll_number
                })
            else:
                # Find who was recognized
                recognized_roll = next((k for k, v in face_labels.items() if v == predicted_label), 'unknown')
                return jsonify({
                    'status': 'mismatch',
                    'confidence': float(confidence),
                    'expected': roll_number,
                    'recognized_as': recognized_roll
                })
        else:
            return jsonify({'status': 'not_registered', 'message': 'Student not registered for face recognition'})

@app.route('/recognize-face', methods=['POST'])
def recognize_face():
    """New endpoint: Recognize who is in the image without knowing their roll number"""
    if face_detection is None or face_recognizer is None:
        return jsonify({'error': 'Face detection/recognition not available'}), 503
    
    file = request.files['image']
    npimg = np.frombuffer(file.read(), np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    results = face_detection.process(rgb)
    if not results.detections:
        return jsonify({'status': 'no_face'})
    
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    face_rects = face_cascade.detectMultiScale(gray, 1.3, 5)
    
    if len(face_rects) == 0:
        return jsonify({'status': 'no_face'})
    
    recognized_faces = []
    for (x, y, w, h) in face_rects:
        face_roi = gray[y:y+h, x:x+w]
        face_roi = cv2.resize(face_roi, (200, 200))
        
        predicted_label, confidence = face_recognizer.predict(face_roi)
        
        if confidence < 70:
            recognized_roll = next((k for k, v in face_labels.items() if v == predicted_label), 'unknown')
            recognized_faces.append({
                'roll_number': recognized_roll,
                'confidence': float(confidence),
                'bbox': {'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h)}
            })
        else:
            recognized_faces.append({
                'roll_number': 'unknown',
                'confidence': float(confidence),
                'bbox': {'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h)}
            })
    
    return jsonify({
        'status': 'success',
        'faces_detected': len(recognized_faces),
        'faces': recognized_faces
    })

@app.route('/detect-object', methods=['POST'])
def detect_object():
    if not YOLO_AVAILABLE:
        return jsonify({'status': 'error', 'message': 'Object detection not available'}), 503
    
    file = request.files['image']
    npimg = np.frombuffer(file.read(), np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    results = model(rgb, imgsz=DEFAULT_IMGSZ, conf=DEFAULT_CONF)
    if isinstance(results, list):
        res = results[0]
    else:
        res = results

    data = []
    try:
        boxes = getattr(res, "boxes", None)
        names = getattr(model, "names", {})
        if boxes is not None and len(boxes) > 0:
            xyxy = boxes.xyxy.cpu().numpy() if hasattr(boxes.xyxy, "cpu") else np.array(boxes.xyxy)
            confs = boxes.conf.cpu().numpy() if hasattr(boxes.conf, "cpu") else np.array(boxes.conf)
            cls = boxes.cls.cpu().numpy() if hasattr(boxes.cls, "cpu") else np.array(boxes.cls)
            for b, c, cl in zip(xyxy, confs, cls):
                x1, y1, x2, y2 = [float(x) for x in b]
                name = names.get(int(cl), str(int(cl)))
                conf = float(c)
                if conf > 0.5:
                    data.append({'name': name, 'confidence': conf})
    except Exception as e:
        print(f"Object detection parsing error: {e}")

    labels = [d['name'] for d in data]
    forbidden = {'cell phone', 'laptop'}
    detected = [label for label in labels if label in forbidden]

    if detected:
        return jsonify({'status': 'forbidden_object', 'objects': detected})
    else:
        return jsonify({'status': 'clear'})

@app.route('/detect-audio-anomaly', methods=['POST'])
def detect_audio_anomaly():
    try:
        data = request.get_json(force=True, silent=True)
        if not data:
            return jsonify({'status': 'error', 'message': 'No JSON payload received'}), 400

        student_id = data.get('student_id', 'unknown')
        audio_features = data.get('audio_features', {}) or {}

        # Safely extract features with defaults and types
        try:
            volume_level = float(audio_features.get('volume_level', 0) or 0)
        except Exception:
            volume_level = 0.0

        frequency_data = audio_features.get('frequency_data', []) or []
        # normalize to list of floats
        try:
            frequency_data = [float(x) for x in frequency_data]
        except Exception:
            frequency_data = []

        try:
            duration = float(audio_features.get('duration', 0) or 0)
        except Exception:
            duration = 0.0

        # Tunable thresholds
        VOLUME_THRESHOLD = 0.18
        SPEECH_PEAK_THRESHOLD = 0.45
        MIN_SPEECH_PEAKS = 4
        HIGH_VOLUME_THRESHOLD = 0.40
        VERY_HIGH_VOLUME = 0.55
        # Percent thresholds (user-requested)
        LOW_VOLUME_PERCENT = 5.0  # below 5% -> anomaly
        HIGH_VOLUME_PERCENT = 35.0  # above 35% -> anomaly

        anomaly_detected = False
        anomaly_reasons = []

        total_peaks = len(frequency_data)
        speech_peaks = [f for f in frequency_data if f > SPEECH_PEAK_THRESHOLD]
        peak_count = len(speech_peaks)
        peak_ratio = (peak_count / total_peaks) if total_peaks > 0 else 0.0

        # Debug log for incoming audio features
        if volume_level > 0.0 or total_peaks > 0:
            print(f"Audio - Student: {student_id}, Vol: {volume_level:.3f}, Peaks: {peak_count}/{total_peaks}, Ratio: {peak_ratio:.2f}, Dur: {duration}")

        # Convert to percent for user-friendly thresholds
        vol_pct = volume_level * 100.0

        # Primary checks (priority order)
        # User-requested: treat very low or very high voice level as anomaly
        if vol_pct < LOW_VOLUME_PERCENT:
            anomaly_detected = True
            anomaly_reasons.append(f"low_volume:{vol_pct:.1f}%")
        elif vol_pct > HIGH_VOLUME_PERCENT:
            anomaly_detected = True
            anomaly_reasons.append(f"high_volume:{vol_pct:.1f}%")
        elif volume_level >= VERY_HIGH_VOLUME:
            anomaly_detected = True
            anomaly_reasons.append(f"very_high_volume:{volume_level:.2f}")
        elif volume_level >= HIGH_VOLUME_THRESHOLD and (peak_count >= MIN_SPEECH_PEAKS or peak_ratio >= 0.10):
            anomaly_detected = True
            anomaly_reasons.append(f"clear_speech:{volume_level:.2f}:{peak_count}")
        elif peak_count >= (MIN_SPEECH_PEAKS + 2) and peak_ratio > 0.12:
            anomaly_detected = True
            anomaly_reasons.append(f"speech_pattern:{peak_count}:{peak_ratio:.2f}")
        elif volume_level >= VOLUME_THRESHOLD * 2 and peak_count >= (MIN_SPEECH_PEAKS - 1):
            # catch shorter but loud bursts
            anomaly_detected = True
            anomaly_reasons.append(f"short_loud:{volume_level:.2f}")

        # If anomaly detected, log to DB (if available) and return structured response
        if anomaly_detected:
            database = get_db_connection()
            alert_payload = {
                "student_id": student_id,
                "direction": f"ALERT: Audio Anomaly - {', '.join(anomaly_reasons)}",
                "alert_time": datetime.now(),
                "details": {
                    "type": "audio_anomaly",
                    "volume_level": volume_level,
                    "duration": duration,
                    "peak_count": peak_count,
                    "peak_ratio": peak_ratio,
                    "frequency_summary": {
                        "total_peaks": total_peaks,
                        "speech_peaks": peak_count
                    },
                    "anomaly_reasons": anomaly_reasons,
                    "time": datetime.now().isoformat()
                },
                "created_at": datetime.now()
            }

            if database is not None:
                try:
                    database.alerts.insert_one(alert_payload)
                    print(f"Audio anomaly logged for student {student_id}: {anomaly_reasons}")
                except Exception as e:
                    print(f"Error logging audio anomaly: {e}")

            # push event to audio_event_queue for real-time streaming clients
            try:
                event = {
                    'student_id': student_id,
                    'status': 'anomaly_detected',
                    'volume_level': volume_level,
                    'peak_count': peak_count,
                    'peak_ratio': peak_ratio,
                    'anomaly_reasons': anomaly_reasons,
                    'timestamp': datetime.now().isoformat()
                }
                with audio_queue_lock:
                    audio_event_queue.append(event)
                    # cap queue
                    while len(audio_event_queue) > MAX_AUDIO_QUEUE:
                        audio_event_queue.popleft()
            except Exception as e:
                print(f"Error pushing audio event to queue: {e}")

            return jsonify({
                'status': 'anomaly_detected',
                'volume_level': volume_level,
                'peak_count': peak_count,
                'peak_ratio': peak_ratio,
                'anomaly_reasons': anomaly_reasons,
                'message': 'Audio anomaly detected'
            })

        # No anomaly
        # push clear event for real-time UI (low-volume / no anomaly)
        try:
            event = {
                'student_id': student_id,
                'status': 'clear',
                'volume_level': volume_level,
                'peak_count': peak_count,
                'peak_ratio': peak_ratio,
                'timestamp': datetime.now().isoformat()
            }
            with audio_queue_lock:
                audio_event_queue.append(event)
                while len(audio_event_queue) > MAX_AUDIO_QUEUE:
                    audio_event_queue.popleft()
        except Exception as e:
            print(f"Error pushing clear audio event to queue: {e}")

        return jsonify({
            'status': 'clear',
            'volume_level': volume_level,
            'peak_count': peak_count,
            'peak_ratio': peak_ratio,
            'message': 'No audio anomaly detected'
        })

    except Exception as e:
        print(f"Audio anomaly detection error: {e}")
        return jsonify({
            'status': 'error',
            'message': f'Audio detection failed: {str(e)}'
        }), 500


@app.route('/stream-audio-anomaly')
def stream_audio_anomaly():
    """Simple Server-Sent Events endpoint to stream audio detection events in real-time.
    Clients can connect with EventSource in the browser to receive JSON events.
    """
    def event_stream():
        # Long-running generator that yields events when available
        try:
            while True:
                event = None
                with audio_queue_lock:
                    if audio_event_queue:
                        event = audio_event_queue.popleft()
                if event:
                    try:
                        yield f"data: {json.dumps(event)}\n\n"
                    except Exception as e:
                        print(f"Error serializing audio event: {e}")
                else:
                    # no event - sleep briefly to avoid busy loop
                    time.sleep(0.4)
        except GeneratorExit:
            # client disconnected
            return

    return app.response_class(event_stream(), mimetype='text/event-stream')

@app.route('/api/exam/alert', methods=['POST'])
def record_exam_alert():
    """
    Record generic keyboard/interaction alerts during exam
    No specific key data is stored - only alert type and timestamp
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'No JSON data received'
            }), 400
        
        student_id = data.get('student_id')
        exam_id = data.get('exam_id')
        alert_type = data.get('alert_type')  # e.g., 'keyboard_shortcut', 'key_press', 'character_input'
        timestamp = data.get('timestamp')
        message = data.get('message', '')
        
        if not all([student_id, exam_id, alert_type]):
            return jsonify({
                'status': 'error',
                'message': 'Missing required fields'
            }), 400
        
        database = get_db_connection()
        if database is not None:
            try:
                alert_doc = {
                    "student_id": student_id,
                    "exam_id": exam_id,
                    "alert_type": alert_type,
                    "message": message,
                    "timestamp": timestamp,
                    "created_at": datetime.now()
                }
                database.exam_alerts.insert_one(alert_doc)
                
                return jsonify({
                    'status': 'success',
                    'message': 'Alert recorded'
                })
            except Exception as e:
                print(f"Error recording exam alert: {e}")
                return jsonify({
                    'status': 'error',
                    'message': f'Database error: {str(e)}'
                }), 500
        else:
            return jsonify({
                'status': 'error',
                'message': 'Database connection failed'
            }), 500
            
    except Exception as e:
        print(f"Error in record_exam_alert: {e}")
        return jsonify({
            'status': 'error',
            'message': f'Server error: {str(e)}'
        }), 500

@app.route('/api/exam/terminate', methods=['POST'])
def record_exam_termination():
    """
    Record exam termination event (e.g., tab switch)
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'No JSON data received'
            }), 400
        
        student_id = data.get('student_id')
        exam_id = data.get('exam_id')
        reason = data.get('reason')  # e.g., 'tab_switch', 'window_blur'
        timestamp = data.get('timestamp')
        
        if not all([student_id, exam_id, reason]):
            return jsonify({
                'status': 'error',
                'message': 'Missing required fields'
            }), 400
        
        database = get_db_connection()
        if database is not None:
            try:
                termination_doc = {
                    "student_id": student_id,
                    "exam_id": exam_id,
                    "reason": reason,
                    "timestamp": timestamp,
                    "created_at": datetime.now()
                }
                database.exam_terminations.insert_one(termination_doc)
                
                # Also log as a critical alert
                alert_doc = {
                    "student_id": student_id,
                    "direction": f"EXAM TERMINATED: {reason}",
                    "alert_time": datetime.now(),
                    "details": {
                        "type": "exam_termination",
                        "reason": reason,
                        "exam_id": exam_id,
                        "time": datetime.now().isoformat()
                    },
                    "created_at": datetime.now()
                }
                database.alerts.insert_one(alert_doc)
                
                print(f"Exam terminated for student {student_id}: {reason}")
                
                return jsonify({
                    'status': 'success',
                    'message': 'Termination recorded'
                })
            except Exception as e:
                print(f"Error recording exam termination: {e}")
                return jsonify({
                    'status': 'error',
                    'message': f'Database error: {str(e)}'
                }), 500
        else:
            return jsonify({
                'status': 'error',
                'message': 'Database connection failed'
            }), 500
            
    except Exception as e:
        print(f"Error in record_exam_termination: {e}")
        return jsonify({
            'status': 'error',
            'message': f'Server error: {str(e)}'
        }), 500


@app.route('/api/exam/reset', methods=['POST'])
def reset_exam_data():
    """Reset alerts and unfair-means (UFM) data for a given exam_id and optionally a specific student.
    This clears DB records if available, otherwise clears in-memory storage.
    Also clears the audio event queue to avoid showing stale events when an exam restarts.
    Payload: { 
        "exam_id": "exam_2025_ai",
        "student_id": "12345" (optional - if provided, only resets data for this student)
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'status': 'error', 'message': 'No JSON payload received'}), 400

        exam_id = data.get('exam_id')
        student_id = data.get('student_id')  # Optional - for student-specific reset
        legacy_cleanup = bool(data.get('include_legacy', True))
        
        if not exam_id:
            return jsonify({'status': 'error', 'message': 'Missing exam_id'}), 400

        database = get_db_connection()
        removed = {}
        errors = []  # Track any deletion errors

        if database is not None:
            try:
                def with_legacy_support(base_filter):
                    if not legacy_cleanup or 'exam_id' not in base_filter:
                        return base_filter
                    alt = dict(base_filter)
                    alt.pop('exam_id', None)
                    variants = [base_filter]
                    for legacy_value in ({'$exists': False}, '', None):
                        legacy_clause = dict(alt)
                        legacy_clause['exam_id'] = legacy_value
                        variants.append(legacy_clause)
                    return {'$or': variants}

                # Build query filters
                ufm_filter = {'exam_id': exam_id}
                exam_alerts_filter = {'exam_id': exam_id}
                generic_alerts_filter = {'exam_id': exam_id}
                faces_filter = {'exam_id': exam_id}
                
                if student_id:
                    ufm_filter['student_id'] = student_id
                    exam_alerts_filter['student_id'] = student_id
                    generic_alerts_filter['student_id'] = student_id
                    faces_filter['roll_number'] = student_id
                
                # Remove UFM entries
                try:
                    if 'unfair_means' in database.list_collection_names():
                        res_ufm = database.unfair_means.delete_many(with_legacy_support(ufm_filter))
                        removed['ufm_removed'] = res_ufm.deleted_count
                        print(f"Removed {res_ufm.deleted_count} UFM records with filter: {ufm_filter} (legacy={legacy_cleanup})")
                    else:
                        removed['ufm_removed'] = 0
                        print("UFM collection not found, skipped.")
                except Exception as e:
                    errors.append(f"UFM deletion error: {str(e)}")
                    removed['ufm_removed'] = 0
                    print(f"Error deleting UFM: {e}")

                # Remove exam alerts and related records
                try:
                    if 'exam_alerts' in database.list_collection_names():
                        res_ea = database.exam_alerts.delete_many(with_legacy_support(exam_alerts_filter))
                        removed['exam_alerts_removed'] = res_ea.deleted_count
                        print(f"Removed {res_ea.deleted_count} exam_alerts records with filter: {exam_alerts_filter} (legacy={legacy_cleanup})")
                    else:
                        removed['exam_alerts_removed'] = 0
                except Exception as e:
                    errors.append(f"Exam alerts deletion error: {str(e)}")
                    removed['exam_alerts_removed'] = 0
                    print(f"Error deleting exam_alerts: {e}")

                try:
                    if 'exam_terminations' in database.list_collection_names():
                        res_et = database.exam_terminations.delete_many(with_legacy_support(exam_alerts_filter))
                        removed['exam_terminations_removed'] = res_et.deleted_count
                        print(f"Removed {res_et.deleted_count} exam_terminations records with filter: {exam_alerts_filter} (legacy={legacy_cleanup})")
                    else:
                        removed['exam_terminations_removed'] = 0
                except Exception as e:
                    errors.append(f"Exam terminations deletion error: {str(e)}")
                    removed['exam_terminations_removed'] = 0
                    print(f"Error deleting exam_terminations: {e}")

                # Remove alerts from generic alerts collection
                try:
                    if 'alerts' in database.list_collection_names():
                        res_alerts = database.alerts.delete_many(with_legacy_support(generic_alerts_filter))
                        removed['alerts_removed'] = res_alerts.deleted_count
                        print(f"Removed {res_alerts.deleted_count} alerts records with filter: {generic_alerts_filter} (legacy={legacy_cleanup})")
                    else:
                        removed['alerts_removed'] = 0
                except Exception as e:
                    errors.append(f"Alerts deletion error: {str(e)}")
                    removed['alerts_removed'] = 0
                    print(f"Error deleting alerts: {e}")

                # Remove registered faces
                try:
                    if 'registered_faces' in database.list_collection_names():
                        res_faces = database.registered_faces.delete_many(with_legacy_support(faces_filter))
                        removed['registered_faces_removed'] = res_faces.deleted_count
                        print(f"Removed {res_faces.deleted_count} registered_faces with filter: {faces_filter} (legacy={legacy_cleanup})")
                    else:
                        removed['registered_faces_removed'] = 0
                except Exception as e:
                    errors.append(f"Registered faces deletion error: {str(e)}")
                    removed['registered_faces_removed'] = 0
                    print(f"Error deleting registered_faces: {e}")

            except Exception as e:
                print(f"Error clearing DB exam data: {e}")
                return jsonify({'status': 'error', 'message': f'Database error: {str(e)}'}), 500
        else:
            # In-memory fallback: clear ufm_storage and simulate other clears
            before_ufm = len(ufm_storage)
            if student_id:
                ufm_storage[:] = [u for u in ufm_storage if not (u.get('exam_id') == exam_id and u.get('student_id') == student_id)]
            else:
                ufm_storage[:] = [u for u in ufm_storage if u.get('exam_id') != exam_id]
            after_ufm = len(ufm_storage)
            removed['ufm_removed'] = before_ufm - after_ufm
            # Simulate clearing other data types (no actual storage, just for consistency)
            removed['exam_alerts_removed'] = 0  # Placeholder
            removed['exam_terminations_removed'] = 0  # Placeholder
            removed['alerts_removed'] = 0  # Placeholder
            removed['registered_faces_removed'] = 0  # Placeholder

        # Clear audio event queue
        try:
            with audio_queue_lock:
                audio_event_queue.clear()
            removed['audio_queue_cleared'] = True
        except Exception as e:
            print(f"Error clearing audio_event_queue: {e}")
            removed['audio_queue_cleared'] = False
            errors.append(f"Audio queue clear error: {str(e)}")

        # If there were errors, return error status; otherwise success
        if errors:
            return jsonify({
                'status': 'error',
                'message': 'Reset partially failed',
                'removed': removed,
                'errors': errors,
                'summary': f"Attempted reset for exam {exam_id}; check logs for details."
            }), 500

        # Quick summary for faster reporting
        total_removed = sum(removed.get(k, 0) for k in removed if k != 'audio_queue_cleared')
        summary = f"Reset exam {exam_id}: {total_removed} records removed, audio queue cleared."
        if legacy_cleanup:
            summary += " Legacy records without exam_id were included."
        return jsonify({'status': 'success', 'removed': removed, 'summary': summary})
    except Exception as e:
        print(f"Error in reset_exam_data: {e}")
        return jsonify({'status': 'error', 'message': f'Server error: {str(e)}'}), 500

@app.route('/api/ufm', methods=['POST'])
def mark_unfair_means():
    """
    Mark a student for unfair means (UFM)
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'No JSON data received'
            }), 400
        
        student_id = data.get('student_id')
        exam_id = data.get('exam_id')
        reason = data.get('reason', 'Marked for unfair means by proctor')
        proctor_id = data.get('proctor_id', 'system')
        
        if not all([student_id, exam_id]):
            return jsonify({
                'status': 'error',
                'message': 'Missing required fields: student_id and exam_id'
            }), 400
        
        database = get_db_connection()
        if database is not None:
            try:
                # Check if UFM collection exists, create if not
                if 'unfair_means' not in database.list_collection_names():
                    database.create_collection('unfair_means')
                
                # Check if student is already marked for UFM in this exam
                existing_ufm = database.unfair_means.find_one({
                    "student_id": student_id,
                    "exam_id": exam_id
                })
                
                if existing_ufm:
                    return jsonify({
                        'status': 'error',
                        'message': 'Student already marked for unfair means in this exam'
                    }), 409
                
                # Mark student for unfair means
                ufm_doc = {
                    "student_id": student_id,
                    "exam_id": exam_id,
                    "reason": reason,
                    "proctor_id": proctor_id,
                    "marked_at": datetime.now(),
                    "status": "marked",
                    "created_at": datetime.now()
                }
                database.unfair_means.insert_one(ufm_doc)
                
                # Also log as a critical alert
                alert_doc = {
                    "student_id": student_id,
                    "direction": f"UNFAIR MEANS: {reason}",
                    "alert_time": datetime.now(),
                    "details": {
                        "type": "unfair_means",
                        "reason": reason,
                        "proctor_id": proctor_id,
                        "exam_id": exam_id,
                        "time": datetime.now().isoformat()
                    },
                    "created_at": datetime.now()
                }
                database.alerts.insert_one(alert_doc)
                
                print(f"Student {student_id} marked for unfair means: {reason}")
                
                return jsonify({
                    'status': 'success',
                    'message': 'Student marked for unfair means',
                    'student_id': student_id,
                    'exam_id': exam_id
                })
            except Exception as e:
                print(f"Error marking student for unfair means: {e}")
                return jsonify({
                    'status': 'error',
                    'message': f'Database error: {str(e)}'
                }), 500
        else:
            # Use in-memory storage for testing
            # Check if student is already marked
            existing_ufm = next((ufm for ufm in ufm_storage if ufm['student_id'] == student_id and ufm['exam_id'] == exam_id), None)
            if existing_ufm:
                return jsonify({
                    'status': 'error',
                    'message': 'Student already marked for unfair means in this exam'
                }), 409
            
            # Mark student for unfair means
            ufm_doc = {
                "student_id": student_id,
                "exam_id": exam_id,
                "reason": reason,
                "proctor_id": proctor_id,
                "marked_at": datetime.now().isoformat(),
                "status": "marked",
                "created_at": datetime.now().isoformat()
            }
            ufm_storage.append(ufm_doc)
            
            print(f"Student {student_id} marked for unfair means (in-memory): {reason}")
            
            return jsonify({
                'status': 'success',
                'message': 'Student marked for unfair means',
                'student_id': student_id,
                'exam_id': exam_id
            })
            
    except Exception as e:
        print(f"Error in mark_unfair_means: {e}")
        return jsonify({
            'status': 'error',
            'message': f'Server error: {str(e)}'
        }), 500

@app.route('/api/ufm/<exam_id>', methods=['GET'])
def get_ufm_students(exam_id):
    """
    Get all students marked for unfair means in a specific exam
    """
    try:
        database = get_db_connection()
        if database is not None:
            try:
                ufm_students = list(database.unfair_means.find(
                    {"exam_id": exam_id},
                    {"_id": 0}
                ).sort("marked_at", -1))
                
                return jsonify({
                    'status': 'success',
                    'ufm_students': ufm_students
                })
            except Exception as e:
                print(f"Error fetching UFM students: {e}")
                return jsonify({
                    'status': 'error',
                    'message': f'Database error: {str(e)}'
                }), 500
        else:
            # Use in-memory storage for testing
            ufm_students = [ufm for ufm in ufm_storage if ufm['exam_id'] == exam_id]
            # Sort by marked_at in descending order (most recent first)
            ufm_students.sort(key=lambda x: x.get('marked_at', ''), reverse=True)
            
            return jsonify({
                'status': 'success',
                'ufm_students': ufm_students
            })
            
    except Exception as e:
        print(f"Error in get_ufm_students: {e}")
        return jsonify({
            'status': 'error',
            'message': f'Server error: {str(e)}'
        }), 500

if __name__ == "__main__":
    print("\n" + "="*60)
    print("AI Proctor Backend - MongoDB Edition")
    print("="*60 + "\n")
    
    if init_database():
        print("\n✓ Server starting with MongoDB connection...\n")
        # Disable auto-reloader to fix MediaPipe import error on reload
        app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
    else:
        print("\n✗ Failed to initialize database. Please check connection.")
        print("Server starting anyway (some features may not work)...\n")
        app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
