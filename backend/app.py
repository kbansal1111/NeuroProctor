"""
NeuroProctor Backend - Main Application
Modular Flask application with route blueprints and centralized configuration.

This is the refactored version of the original 1505-line monolithic app.py.
All routes have been organized into blueprints for better maintainability.
"""
from flask import Flask
from flask_cors import CORS
from config import Config
from database import get_db

# Import route blueprints
from routes.auth import auth_bp
from routes.health import health_bp
from routes.detection import detection_bp
from routes.alerts import alerts_bp

# Import utilities for initialization
from backend_utils.object_detection import load_yolo_model
from backend_utils.face_utils import init_face_detection

def create_app():
    """
    Application factory pattern.
    Creates and configures the Flask application.
    """
    app = Flask(__name__)
    
    # Configure CORS for production
    CORS(app, origins=Config.ALLOWED_ORIGINS, supports_credentials=True)
    
    # Print configuration in debug mode
    if Config.DEBUG:
        Config.print_config()
    
    # Initialize database connection
    print("\nInitializing database connection...")
    db = get_db()
    if db is not None:
        print("✓ Database initialized successfully")
    else:
        print("⚠️  Database initialization failed - some features may not work")
    
    # Initialize ML models
    print("\nInitializing ML models...")
    load_yolo_model()  # YOLO for object detection
    init_face_detection()  # MediaPipe for face detection
    print("✓ ML models initialized")
    
    # Register route blueprints
    print("\nRegistering route blueprints...")
    app.register_blueprint(auth_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(detection_bp)
    app.register_blueprint(alerts_bp)
    print("✓ All route blueprints registered")
    
    return app

# Create the Flask application
app = create_app()

if __name__ == "__main__":
    print("\n" + "="*60)
    print("NeuroProctor Backend - Modular Architecture v2.0")
    print("="*60)
    print(f"Environment: {Config.FLASK_ENV}")
    print(f"Host: {Config.HOST}:{Config.PORT}")
    print(f"Frontend: {Config.FRONTEND_URL}")
    print("="*60 + "\n")
    
    # Run server
    app.run(
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG,
        use_reloader=False  # Disable reloader to prevent MediaPipe import errors
    )