"""
Face detection and processing utilities using MediaPipe and OpenCV.
Provides face detection, ROI extraction, and image preprocessing.
"""
import cv2
import numpy as np
import mediapipe as mp

# Initialize MediaPipe Face Detection
_face_detection = None
_face_detection_available = False

def init_face_detection():
    """Initialize MediaPipe Face Detection"""
    global _face_detection, _face_detection_available
    
    if _face_detection is not None:
        return _face_detection, _face_detection_available
    
    try:
        mp_face_detection = mp.solutions.face_detection
        _face_detection = mp_face_detection.FaceDetection(
            model_selection=1, 
            min_detection_confidence=0.5
        )
        _face_detection_available = True
        print("✓ MediaPipe Face Detection initialized")
    except Exception as e:
        print(f"✗ Failed to initialize MediaPipe Face Detection: {e}")
        _face_detection = None
        _face_detection_available = False
    
    return _face_detection, _face_detection_available

def preprocess_face_image(gray_face, target_size=(200, 200)):
    """
    Preprocess face image for better recognition accuracy.
    
    Args:
        gray_face: Grayscale face image
        target_size: Target size for resizing (width, height)
    
    Returns:
        Preprocessed face image
    """
    # Resize to target size
    resized = cv2.resize(gray_face, target_size)
    
    # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
    # This normalizes lighting conditions and enhances local contrast
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(resized)
    
    # Apply slight Gaussian blur to reduce noise
    denoised = cv2.GaussianBlur(enhanced, (3, 3), 0)
    
    return denoised

def extract_face_roi(frame, use_multiple_detections=True):
    """
    Extract face ROI with improved accuracy using Haar Cascade.
    
    Args:
        frame: Input BGR image
        use_multiple_detections: Whether to use multiple detection methods
    
    Returns:
        tuple: (face_roi, success_flag)
    """
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Haar Cascade (fast and reliable)
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    )
    face_rects = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,  # More granular search
        minNeighbors=5,   # More strict detection
        minSize=(80, 80)  # Minimum face size
    )
    
    if len(face_rects) > 0:
        # Get largest face
        (x, y, w, h) = max(face_rects, key=lambda r: r[2] * r[3])
        
        # Add padding to include more context (10% padding)
        padding = int(w * 0.1)
        x = max(0, x - padding)
        y = max(0, y - padding)
        w = min(gray.shape[1] - x, w + 2 * padding)
        h = min(gray.shape[0] - y, h + 2 * padding)
        
        face_roi = gray[y:y+h, x:x+w]
        
        # Preprocess the face
        processed_face = preprocess_face_image(face_roi)
        
        return processed_face, True
    
    return None, False

def check_image_quality(gray_image):
    """
    Check image quality (brightness and sharpness).
    
    Args:
        gray_image: Grayscale image
    
    Returns:
        dict: Quality metrics with status and message
    """
    # Check brightness
    brightness = np.mean(gray_image)
    if brightness < 40:
        return {
            'status': 'poor_quality',
            'message': 'Image too dark',
            'brightness': float(brightness)
        }
    elif brightness > 220:
        return {
            'status': 'poor_quality',
            'message': 'Image too bright',
            'brightness': float(brightness)
        }
    
    # Check for blur using Laplacian variance
    laplacian_var = cv2.Laplacian(gray_image, cv2.CV_64F).var()
    if laplacian_var < 100:
        return {
            'status': 'poor_quality',
            'message': 'Image too blurry',
            'sharpness': float(laplacian_var)
        }
    
    return {
        'status': 'good',
        'brightness': float(brightness),
        'sharpness': float(laplacian_var)
    }

def is_face_detection_available():
    """Check if face detection is available"""
    _, available = init_face_detection()
    return available

def get_face_detection():
    """Get face detection instance"""
    detection, _ = init_face_detection()
    return detection
