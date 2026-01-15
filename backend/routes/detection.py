"""
Detection routes for proctoring features.
Handles head pose detection, face registration/verification, object detection, and audio anomaly detection.
"""
from flask import Blueprint, request, jsonify, Response
import cv2
import numpy as np
import mediapipe as mp
import json
import time
from datetime import datetime
from bson import Binary

from database import get_db
from backend_utils.face_utils import (
    get_face_detection, 
    extract_face_roi, 
    check_image_quality,
    preprocess_face_image
)
from backend_utils.object_detection import detect_forbidden_objects, is_yolo_available
from backend_utils.audio_detection import (
    analyze_audio_features, 
    push_audio_event, 
    pop_audio_event
)
from config import Config

# Create blueprint
detection_bp = Blueprint('detection', __name__)

# Initialize MediaPipe Face Mesh for head pose detection
try:
    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(static_image_mode=False, max_num_faces=1)
except Exception as e:
    print(f"Warning: Failed to initialize MediaPipe Face Mesh: {e}")
    mp_face_mesh = None
    face_mesh = None

# 3D model points for head pose estimation
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

# Face recognition globals (will be moved to model later)
face_recognizer = None
face_labels = {}
label_counter = 0
registered_faces = set()

def init_face_recognizer():
    """Initialize LBPH face recognizer"""
    global face_recognizer, face_labels, label_counter
    try:
        face_recognizer = cv2.face.LBPHFaceRecognizer_create(
            radius=2,
            neighbors=8,
            grid_x=8,
            grid_y=8,
            threshold=100.0
        )
        database = get_db()
        if database is not None:
            model_doc = database.face_models.find_one({'model_type': 'lbph_primary'})
            if model_doc:
                model_bytes = model_doc['model_data']
                with open('temp_model.yml', 'wb') as f:
                    f.write(model_bytes)
                face_recognizer.read('temp_model.yml')
                import os
                os.remove('temp_model.yml')
                
                face_labels = model_doc.get('labels', {})
                label_counter = model_doc.get('label_counter', 0)
                print(f"✓ Loaded existing face recognizer with {len(face_labels)} registered faces")
    except Exception as e:
        print(f"Warning: Failed to initialize face recognizer: {e}")
        face_recognizer = cv2.face.LBPHFaceRecognizer_create(
            radius=2, neighbors=8, grid_x=8, grid_y=8, threshold=100.0
        )

def retrain_face_recognizer(database):
    """Retrain face recognizer with all registered faces"""
    global face_recognizer
    try:
        faces_cursor = database.registered_faces.find({})
        faces_list = []
        labels_list = []
        
        for face_doc in faces_cursor:
            image_bytes = face_doc['image_data']
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            face_roi, success = extract_face_roi(img)
            if success and face_roi is not None:
                faces_list.append(face_roi)
                labels_list.append(face_doc['label_id'])
        
        if len(faces_list) > 0:
            face_recognizer.train(faces_list, np.array(labels_list))
            
            face_recognizer.write('temp_model.yml')
            with open('temp_model.yml', 'rb') as f:
                model_bytes = f.read()
            import os
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

# Initialize face recognizer on module load
init_face_recognizer()

@detection_bp.route('/detect-head', methods=['POST'])
def detect_head():
    """Detect head pose and orientation"""
    if face_mesh is None:
        return jsonify({'error': 'Face mesh detection not available'}), 503
    
    file = request.files['image']
    npimg = np.frombuffer(file.read(), np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    h, w = frame.shape[:2]
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb)
    direction, yaw, pitch, roll = "ALERT: No face detected", 0, 0, 0

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

@detection_bp.route('/register-face', methods=['POST'])
def register_face():
    """Register student face for verification"""
    face_detection = get_face_detection()
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
    
    # Check image quality
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    quality = check_image_quality(gray)
    if quality['status'] == 'poor_quality':
        return jsonify(quality)
    
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    if rgb is None or rgb.size == 0:
        return jsonify({'status': 'no_face'})
    
    results = face_detection.process(rgb)
    if results.detections:
        if len(results.detections) == 1:
            face_roi, success = extract_face_roi(frame)
            if not success or face_roi is None:
                return jsonify({'status': 'no_face'})
            
            registered_faces.add(roll_number)
            
            if roll_number not in face_labels:
                face_labels[roll_number] = label_counter
                label_counter += 1
            
            label_id = face_labels[roll_number]
            
            database = get_db()
            if database is not None:
                try:
                    success, encoded_image = cv2.imencode('.jpg', frame)
                    if success:
                        face_doc = {
                            'roll_number': roll_number,
                            'exam_id': exam_id,
                            'image_data': Binary(encoded_image.tobytes()),
                            'label_id': label_id,
                            'brightness': quality.get('brightness', 0),
                            'sharpness': quality.get('sharpness', 0),
                            'updated_at': datetime.now()
                        }
                        database.registered_faces.update_one(
                            {'roll_number': roll_number, 'exam_id': exam_id},
                            {'$set': face_doc},
                            upsert=True
                        )
                        retrain_face_recognizer(database)
                except Exception as e:
                    print(f"Error storing face image: {e}")
            return jsonify({'status': 'registered'})
        else:
            return jsonify({'status': 'multiple_faces'})
    else:
        return jsonify({'status': 'no_face'})

@detection_bp.route('/verify-face', methods=['POST'])
def verify_face():
    """Verify student face against registered face"""
    face_detection = get_face_detection()
    if face_detection is None or face_recognizer is None:
        return jsonify({'error': 'Face detection/recognition not available'}), 503
    
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
        face_roi, success = extract_face_roi(frame)
        
        if not success or face_roi is None:
            return jsonify({'status': 'no_face'})
        
        if roll_number in face_labels:
            expected_label = face_labels[roll_number]
            predicted_label, confidence = face_recognizer.predict(face_roi)
            
            CONFIDENCE_THRESHOLD = Config.FACE_CONFIDENCE_THRESHOLD
            
            if predicted_label == expected_label and confidence < CONFIDENCE_THRESHOLD:
                return jsonify({
                    'status': 'match',
                    'confidence': float(confidence),
                    'recognized_as': roll_number
                })
            else:
                recognized_roll = next((k for k, v in face_labels.items() if v == predicted_label), 'unknown')
                return jsonify({
                    'status': 'mismatch',
                    'confidence': float(confidence),
                    'expected': roll_number,
                    'recognized_as': recognized_roll,
                    'severity': 'high' if confidence > 80 else 'medium'
                })
        else:
            return jsonify({'status': 'not_registered', 'message': 'Student not registered for face recognition'})

@detection_bp.route('/recognize-face', methods=['POST'])
def recognize_face():
    """Recognize who is in the image without knowing their roll number"""
    face_detection = get_face_detection()
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

@detection_bp.route('/detect-object', methods=['POST'])
def detect_object():
    """Detect forbidden objects using YOLO"""
    if not is_yolo_available():
        return jsonify({
            'status': 'error',
            'message': 'Object detection not available'
        }), 503
    
    try:
        file = request.files['image']
        npimg = np.frombuffer(file.read(), np.uint8)
        frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({
                'status': 'error',
                'message': 'Failed to decode image'
            }), 400
        
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = detect_forbidden_objects(rgb)
        
        if result['status'] == 'forbidden_object':
            # Log to database
            database = get_db()
            if database is not None:
                try:
                    student_id = request.form.get('student_id', 'unknown')
                    exam_id = request.form.get('exam_id', 'exam_2025_ai')
                    
                    alert_doc = {
                        "student_id": student_id,
                        "exam_id": exam_id,
                        "direction": f"ALERT: Forbidden Object - {', '.join(result['objects'])}",
                        "alert_time": datetime.now(),
                        "details": {
                            "type": "forbidden_object",
                            "objects": result['details'],
                            "all_detections": result['all_detections'],
                            "time": datetime.now().isoformat()
                        },
                        "created_at": datetime.now()
                    }
                    database.alerts.insert_one(alert_doc)
                except Exception as e:
                    print(f"Error logging forbidden object alert: {e}")
        
        return jsonify(result)
    
    except Exception as e:
        print(f"Object detection error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'message': f'Detection failed: {str(e)}'
        }), 500

@detection_bp.route('/detect-audio-anomaly', methods=['POST'])
def detect_audio_anomaly():
    """Detect audio anomalies (speech, loud sounds)"""
    try:
        data = request.get_json(force=True, silent=True)
        if not data:
            return jsonify({'status': 'error', 'message': 'No JSON payload received'}), 400

        student_id = data.get('student_id', 'unknown')
        audio_features = data.get('audio_features', {}) or {}

        # Analyze audio features
        analysis = analyze_audio_features(audio_features)
        
        if analysis['anomaly_detected']:
            # Log to database
            database = get_db()
            alert_payload = {
                "student_id": student_id,
                "direction": f"ALERT: Audio Anomaly - {', '.join(analysis['anomaly_reasons'])}",
                "alert_time": datetime.now(),
                "details": {
                    "type": "audio_anomaly",
                    "volume_level": analysis['volume_level'],
                    "peak_count": analysis['peak_count'],
                    "peak_ratio": analysis['peak_ratio'],
                    "anomaly_reasons": analysis['anomaly_reasons'],
                    "time": datetime.now().isoformat()
                },
                "created_at": datetime.now()
            }

            if database is not None:
                try:
                    database.alerts.insert_one(alert_payload)
                    print(f"Audio anomaly logged for student {student_id}: {analysis['anomaly_reasons']}")
                except Exception as e:
                    print(f"Error logging audio anomaly: {e}")

            # Push event to queue for SSE
            event = {
                'student_id': student_id,
                'status': 'anomaly_detected',
                'volume_level': analysis['volume_level'],
                'peak_count': analysis['peak_count'],
                'peak_ratio': analysis['peak_ratio'],
                'anomaly_reasons': analysis['anomaly_reasons'],
                'timestamp': datetime.now().isoformat()
            }
            push_audio_event(event)

            return jsonify({
                'status': 'anomaly_detected',
                'volume_level': analysis['volume_level'],
                'peak_count': analysis['peak_count'],
                'peak_ratio': analysis['peak_ratio'],
                'anomaly_reasons': analysis['anomaly_reasons'],
                'message': 'Audio anomaly detected'
            })

        # No anomaly - push clear event
        event = {
            'student_id': student_id,
            'status': 'clear',
            'volume_level': analysis['volume_level'],
            'peak_count': analysis['peak_count'],
            'peak_ratio': analysis['peak_ratio'],
            'timestamp': datetime.now().isoformat()
        }
        push_audio_event(event)

        return jsonify({
            'status': 'clear',
            'volume_level': analysis['volume_level'],
            'peak_count': analysis['peak_count'],
            'peak_ratio': analysis['peak_ratio'],
            'message': 'No audio anomaly detected'
        })

    except Exception as e:
        print(f"Audio anomaly detection error: {e}")
        return jsonify({
            'status': 'error',
            'message': f'Audio detection failed: {str(e)}'
        }), 500

@detection_bp.route('/stream-audio-anomaly')
def stream_audio_anomaly():
    """Server-Sent Events endpoint for real-time audio anomaly streaming"""
    def event_stream():
        try:
            while True:
                event = pop_audio_event()
                if event:
                    try:
                        yield f"data: {json.dumps(event)}\n\n"
                    except Exception as e:
                        print(f"Error serializing audio event: {e}")
                else:
                    time.sleep(0.4)
        except GeneratorExit:
            return

    return Response(event_stream(), mimetype='text/event-stream')
