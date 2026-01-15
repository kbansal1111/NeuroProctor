"""
Configuration management for NeuroProctor backend.
Loads environment variables and provides application configuration.
"""
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    """Application configuration class"""
    
    # Flask Configuration
    FLASK_ENV = os.getenv('FLASK_ENV', 'development')
    DEBUG = FLASK_ENV == 'development'
    PORT = int(os.getenv('PORT', 5000))
    HOST = os.getenv('HOST', '0.0.0.0')
    
    # MongoDB Configuration
    MONGODB_URI = os.getenv('MONGODB_URI')
    if not MONGODB_URI:
        raise ValueError("MONGODB_URI environment variable is required. Please set it in your .env file.")
    DB_NAME = os.getenv('DB_NAME', 'ai_proctor_db')
    
    # MongoDB Connection Settings (Production-ready)
    MONGO_SERVER_SELECTION_TIMEOUT = int(os.getenv('MONGO_SERVER_SELECTION_TIMEOUT', 15000))
    MONGO_CONNECT_TIMEOUT = int(os.getenv('MONGO_CONNECT_TIMEOUT', 15000))
    MONGO_SOCKET_TIMEOUT = int(os.getenv('MONGO_SOCKET_TIMEOUT', 15000))
    MONGO_MAX_POOL_SIZE = int(os.getenv('MONGO_MAX_POOL_SIZE', 10))
    
    # CORS Configuration
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', f'{FRONTEND_URL},https://neuro-proctor-gjw8.vercel.app').split(',')
    
    # YOLO Model Configuration
    YOLO_MODEL_PATH = os.getenv('YOLO_MODEL_PATH', 'yolov5n.pt')
    YOLO_CONFIDENCE = float(os.getenv('YOLO_CONFIDENCE', 0.4))
    YOLO_IOU = float(os.getenv('YOLO_IOU', 0.45))
    YOLO_MAX_DETECTIONS = int(os.getenv('YOLO_MAX_DETECTIONS', 10))
    
    # Face Recognition Configuration
    FACE_CONFIDENCE_THRESHOLD = int(os.getenv('FACE_CONFIDENCE_THRESHOLD', 60))
    
    # Teacher Session Configuration
    TEACHER_SESSION_TTL_HOURS = int(os.getenv('TEACHER_SESSION_TTL_HOURS', 4))
    
    # Audio Detection Configuration
    AUDIO_QUEUE_MAX_SIZE = int(os.getenv('AUDIO_QUEUE_MAX_SIZE', 200))
    
    @staticmethod
    def validate():
        """Validate required configuration variables"""
        required_vars = ['MONGODB_URI']
        missing = [var for var in required_vars if not os.getenv(var) and not hasattr(Config, var)]
        
        if missing:
            print(f"⚠️  Warning: Missing environment variables: {', '.join(missing)}")
            print("   Using default values. Set these in .env file for production.")
        
        return True
    
    @staticmethod
    def print_config():
        """Print current configuration (for debugging)"""
        print("\n" + "="*60)
        print("NeuroProctor Backend Configuration")
        print("="*60)
        print(f"Environment: {Config.FLASK_ENV}")
        print(f"Debug Mode: {Config.DEBUG}")
        print(f"Host: {Config.HOST}:{Config.PORT}")
        print(f"Database: {Config.DB_NAME}")
        print(f"Frontend URL: {Config.FRONTEND_URL}")
        print(f"YOLO Model: {Config.YOLO_MODEL_PATH}")
        print("="*60 + "\n")

# Validate configuration on import
Config.validate()
