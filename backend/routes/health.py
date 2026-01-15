"""
Health check and monitoring routes.
Provides endpoints for service health checks and database connection testing.
"""
from flask import Blueprint, jsonify
from database import get_db, get_mongo_client, test_connection
from config import Config

# Create blueprint
health_bp = Blueprint('health', __name__)

# In-memory storage for registered faces (for compatibility)
registered_faces = set()

@health_bp.route('/health', methods=['GET'])
def health_check():
    """Basic health check endpoint for Render"""
    return jsonify({
        'status': 'healthy',
        'service': 'NeuroProctor Backend',
        'version': '2.0',
        'environment': Config.FLASK_ENV
    })

@health_bp.route('/test-connection', methods=['GET'])
def test_db_connection():
    """Test MongoDB connection endpoint"""
    result = test_connection()
    
    if result['status'] == 'success':
        return jsonify(result)
    else:
        return jsonify(result), 500

@health_bp.route('/registered-faces', methods=['GET'])
def get_registered_faces():
    """Get list of registered faces (roll numbers)"""
    return jsonify({'registered_faces': list(registered_faces)})
