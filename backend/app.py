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
from bson import ObjectId

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

# Load YOLOv5 model
from ultralytics import YOLO

MODEL_PATH = "yolov5n.pt"
MODEL_URL = "https://github.com/ultralytics/yolov5/releases/download/v6.2/yolov5n.pt"

def download_file(url: str, dest: str):
    print(f"Downloading {url} -> {dest}")
    with requests.get(url, stream=True) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

if not os.path.exists(MODEL_PATH):
    try:
        os.makedirs(os.path.dirname(MODEL_PATH) or ".", exist_ok=True)
        download_file(MODEL_URL, MODEL_PATH)
    except Exception as e:
        print("Model download failed:", e)

try:
    model = YOLO(MODEL_PATH)
except Exception as e:
    print("Failed to load local model file, trying by model name:", e)
    model = YOLO("yolov5n")

DEFAULT_IMGSZ = 320
DEFAULT_CONF = 0.25

def get_db_connection():
    """Create and return MongoDB connection"""
    global mongo_client, db
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
            db = mongo_client[DB_NAME]
            print(f"✓ Successfully connected to MongoDB: {DB_NAME}")
        return db
    except ConnectionFailure as e:
        print(f"✗ MongoDB connection failed: {e}")
        return None
    except ServerSelectionTimeoutError as e:
        print(f"✗ MongoDB server selection timeout: {e}")
        return None
    except Exception as e:
        print(f"✗ Unexpected MongoDB error: {e}")
        return None

def init_database():
    """Initialize MongoDB collections and test connection"""
    database = get_db_connection()
    if database is not None:
        try:
            # List existing collections
            collections = database.list_collection_names()
            print(f"Existing collections: {collections}")
            
            # Create collections if they don't exist
            if 'students' not in collections:
                database.create_collection('students')
                print("✓ Created 'students' collection")
                
                # Create sample student for testing
                try:
                    database.students.insert_one({
                        "username": "test_student",
                        "roll_number": "12345",
                        "password": "password123",
                        "created_at": datetime.now()
                    })
                    print("✓ Inserted sample student")
                except Exception as e:
                    print(f"Sample student may already exist: {e}")
            
            if 'alerts' not in collections:
                database.create_collection('alerts')
                print("✓ Created 'alerts' collection")
            
            # Create indexes for better performance
            try:
                database.students.create_index("roll_number", unique=True)
                print("✓ Created index on students.roll_number")
            except Exception as e:
                print(f"Index may already exist: {e}")
                
            try:
                database.alerts.create_index([("student_id", 1), ("alert_time", -1)])
                print("✓ Created index on alerts.student_id and alert_time")
            except Exception as e:
                print(f"Index may already exist: {e}")
            
            # Get collection stats
            student_count = database.students.count_documents({})
            alerts_count = database.alerts.count_documents({})
            
            print(f"\n{'='*50}")
            print(f"MongoDB Database Status:")
            print(f"{'='*50}")
            print(f"Database: {DB_NAME}")
            print(f"Students collection: {student_count} documents")
            print(f"Alerts collection: {alerts_count} documents")
            print(f"{'='*50}\n")
            
            return True
        except Exception as e:
            print(f"✗ Database initialization error: {e}")
            return False
    else:
        print("✗ Failed to connect to MongoDB. Please check your connection string.")
        return False

@app.route('/log-alert', methods=['POST'])
def log_alert():
    data = request.get_json()
    student_id = data.get('student_id')
    direction = data.get('direction')
    time = data.get('time')
    
    if student_id and direction and time:
        database = get_db_connection()
        if database is not None:
            try:
                alert_doc = {
                    "student_id": student_id,
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

# Initialize MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=False, max_num_faces=1)
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

mp_face_detection = mp.solutions.face_detection
face_detection = mp_face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.5)

@app.route('/register-face', methods=['POST'])
def register_face():
    roll_number = request.form['roll_number']
    file = request.files['image']
    npimg = np.frombuffer(file.read(), np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    if frame is None:
        return jsonify({'status': 'no_face'})
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    if rgb is None or rgb.size == 0:
        return jsonify({'status': 'no_face'})
    results = face_detection.process(rgb)
    if results.detections:
        if len(results.detections) == 1:
            registered_faces.add(roll_number)
            return jsonify({'status': 'registered'})
        else:
            return jsonify({'status': 'multiple_faces'})
    else:
        return jsonify({'status': 'no_face'})

@app.route('/verify-face', methods=['POST'])
def verify_face():
    roll_number = request.form['roll_number']
    file = request.files['image']
    npimg = np.frombuffer(file.read(), np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = face_detection.process(rgb)
    if not results.detections:
        return jsonify({'status': 'no_face'})
    elif len(results.detections) > 1:
        return jsonify({'status': 'multiple_faces'})
    else:
        if roll_number in registered_faces:
            return jsonify({'status': 'match'})
        else:
            return jsonify({'status': 'mismatch'})

@app.route('/detect-object', methods=['POST'])
def detect_object():
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
        data = request.get_json()
        student_id = data.get('student_id')
        audio_features = data.get('audio_features', {})
        
        volume_level = audio_features.get('volume_level', 0)
        frequency_data = audio_features.get('frequency_data', [])
        duration = audio_features.get('duration', 0)
        
        VOLUME_THRESHOLD = 0.18
        SPEECH_PEAK_THRESHOLD = 0.45
        MIN_SPEECH_PEAKS = 6
        HIGH_VOLUME_THRESHOLD = 0.40
        VERY_HIGH_VOLUME = 0.55
        
        anomaly_detected = False
        anomaly_type = []
        
        speech_peaks = [f for f in frequency_data if f > SPEECH_PEAK_THRESHOLD]
        peak_count = len(speech_peaks)
        total_peaks = len(frequency_data)
        
        peak_ratio = peak_count / total_peaks if total_peaks > 0 else 0
        
        if volume_level > 0.03:
            print(f"Audio - Student: {student_id}, Vol: {volume_level:.3f}, Speech Peaks: {peak_count}/{total_peaks}, Ratio: {peak_ratio:.2f}")
        
        if volume_level > VERY_HIGH_VOLUME:
            anomaly_detected = True
            anomaly_type.append(f"Very loud sound detected (Vol: {volume_level:.2f})")
            print(f"  ⚠️ ALERT: Very loud - Volume: {volume_level:.3f}")
        elif volume_level > HIGH_VOLUME_THRESHOLD and peak_count >= MIN_SPEECH_PEAKS:
            anomaly_detected = True
            anomaly_type.append(f"Clear speech detected (Vol: {volume_level:.2f}, {peak_count} peaks)")
            print(f"  ⚠️ ALERT: Clear speech - Volume: {volume_level:.3f}, Peaks: {peak_count}")
        elif volume_level > VOLUME_THRESHOLD and peak_count >= MIN_SPEECH_PEAKS + 4 and peak_ratio > 0.15:
            anomaly_detected = True
            anomaly_type.append(f"Speech pattern detected ({peak_count} voice patterns)")
            print(f"  ⚠️ ALERT: Speech pattern - Volume: {volume_level:.3f}, Peaks: {peak_count}, Ratio: {peak_ratio:.2f}")
        elif volume_level > VOLUME_THRESHOLD * 2 and peak_count >= MIN_SPEECH_PEAKS + 2:
            anomaly_detected = True
            anomaly_type.append(f"Voice activity detected")
            print(f"  ⚠️ ALERT: Voice activity - Volume: {volume_level:.3f}, Peaks: {peak_count}")
        
        if anomaly_detected:
            database = get_db_connection()
            if database is not None:
                try:
                    alert_doc = {
                        "student_id": student_id,
                        "direction": f"ALERT: Audio Anomaly - {', '.join(anomaly_type)}",
                        "alert_time": datetime.now(),
                        "details": {
                            "type": "audio_anomaly",
                            "volume_level": volume_level,
                            "duration": duration,
                            "peak_count": peak_count,
                            "peak_ratio": peak_ratio,
                            "anomalies": anomaly_type,
                            "time": datetime.now().isoformat()
                        },
                        "created_at": datetime.now()
                    }
                    database.alerts.insert_one(alert_doc)
                    print(f"Audio anomaly logged for student {student_id}: {anomaly_type}")
                except Exception as e:
                    print(f"Error logging audio anomaly: {e}")
            
            return jsonify({
                'status': 'anomaly_detected',
                'anomalies': anomaly_type,
                'volume_level': volume_level,
                'peak_count': peak_count,
                'message': 'Audio anomaly detected'
            })
        else:
            return jsonify({
                'status': 'clear',
                'volume_level': volume_level,
                'peak_count': peak_count,
                'message': 'No audio anomaly detected'
            })
            
    except Exception as e:
        print(f"Audio anomaly detection error: {e}")
        return jsonify({
            'status': 'error',
            'message': f'Audio detection failed: {str(e)}'
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
