"""
YOLO-based object detection utilities for detecting forbidden objects.
Handles model loading, caching, and object detection logic.
"""
import torch
import os
from config import Config

# Global YOLO model instance
_yolo_model = None
_yolo_available = False

def load_yolo_model():
    """
    Load YOLOv5 model with fallback handling.
    Uses singleton pattern to load model only once.
    
    Returns:
        tuple: (model, is_available) - Model instance and availability flag
    """
    global _yolo_model, _yolo_available
    
    if _yolo_model is not None:
        return _yolo_model, _yolo_available
    
    print("Loading YOLO model for object detection...")
    
    try:
        model_path = Config.YOLO_MODEL_PATH
        
        # Try to load custom trained model first, fallback to pretrained
        if os.path.exists(model_path):
            _yolo_model = torch.hub.load('ultralytics/yolov5', 'custom', 
                                        path=model_path, force_reload=False)
            print(f"✓ Loaded custom YOLOv5 model from {model_path}")
        else:
            # Fallback to pretrained model (will auto-download)
            _yolo_model = torch.hub.load('ultralytics/yolov5', 'yolov5n', 
                                        pretrained=True, force_reload=False)
            print("✓ Loaded pretrained YOLOv5n model")
        
        # Configure model settings
        _yolo_model.conf = Config.YOLO_CONFIDENCE
        _yolo_model.iou = Config.YOLO_IOU
        _yolo_model.max_det = Config.YOLO_MAX_DETECTIONS
        
        _yolo_available = True
        print("✓ YOLO model loaded successfully for cell phone/laptop detection")
        
    except Exception as e:
        print(f"✗ Failed to load YOLO model: {e}")
        print("  Cell phone/laptop detection will not be available")
        _yolo_available = False
        _yolo_model = None
    
    return _yolo_model, _yolo_available

def detect_forbidden_objects(image_rgb):
    """
    Detect forbidden objects (cell phones, laptops, books) in an image.
    
    Args:
        image_rgb: RGB image array (numpy array)
    
    Returns:
        dict: Detection results with status and detected objects
    """
    model, available = load_yolo_model()
    
    if not available or model is None:
        return {
            'status': 'error',
            'message': 'Object detection not available'
        }
    
    try:
        # Run YOLO detection
        results = model(image_rgb, size=640)
        
        # Extract detection results
        detections = results.pandas().xyxy[0]
        
        # Define forbidden objects (COCO dataset class names)
        forbidden_objects = {
            'cell phone': 67,
            'laptop': 63,
            'book': 73
        }
        
        detected_forbidden = []
        all_detections = []
        
        for _, detection in detections.iterrows():
            class_name = detection['name']
            confidence = detection['confidence']
            
            # Store all detections with confidence > 0.3
            if confidence > 0.3:
                all_detections.append({
                    'name': class_name,
                    'confidence': float(confidence)
                })
            
            # Check if it's a forbidden object with good confidence
            if class_name in forbidden_objects and confidence > 0.4:
                detected_forbidden.append({
                    'name': class_name,
                    'confidence': float(confidence)
                })
                print(f"⚠️  FORBIDDEN OBJECT DETECTED: {class_name} (confidence: {confidence:.2f})")
        
        if detected_forbidden:
            return {
                'status': 'forbidden_object',
                'objects': [d['name'] for d in detected_forbidden],
                'details': detected_forbidden,
                'all_detections': all_detections
            }
        else:
            return {
                'status': 'clear',
                'all_detections': all_detections
            }
    
    except Exception as e:
        print(f"Object detection error: {e}")
        return {
            'status': 'error',
            'message': f'Detection failed: {str(e)}'
        }

def is_yolo_available():
    """Check if YOLO model is available"""
    _, available = load_yolo_model()
    return available
