"""
MongoDB database connection management.
Provides singleton MongoDB client with retry logic and health checks.
"""
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from config import Config

# Global MongoDB client and database instances
_mongo_client = None
_db = None

def get_mongo_client():
    """
    Get or create MongoDB client with production-ready settings.
    Uses singleton pattern to reuse connection.
    
    Returns:
        MongoClient: MongoDB client instance or None if connection fails
    """
    global _mongo_client
    
    try:
        if _mongo_client is None:
            print("Establishing MongoDB connection...")
            _mongo_client = MongoClient(
                Config.MONGODB_URI,
                serverSelectionTimeoutMS=Config.MONGO_SERVER_SELECTION_TIMEOUT,
                connectTimeoutMS=Config.MONGO_CONNECT_TIMEOUT,
                socketTimeoutMS=Config.MONGO_SOCKET_TIMEOUT,
                maxPoolSize=Config.MONGO_MAX_POOL_SIZE,
                retryWrites=True,
                w='majority'
            )
            # Test connection
            _mongo_client.admin.command('ping')
            print(f"✓ Successfully connected to MongoDB")
        
        return _mongo_client
    
    except ConnectionFailure as e:
        print(f"✗ MongoDB connection failed: {e}")
        return None
    except ServerSelectionTimeoutError as e:
        print(f"✗ MongoDB server selection timeout: {e}")
        return None
    except Exception as e:
        print(f"✗ Unexpected MongoDB error: {e}")
        return None

def get_db():
    """
    Get or create database connection.
    
    Returns:
        Database: MongoDB database instance or None if connection fails
    """
    global _db
    
    try:
        if _db is None:
            client = get_mongo_client()
            if client is not None:
                _db = client[Config.DB_NAME]
                print(f"✓ Connected to database: {Config.DB_NAME}")
            else:
                return None
        
        return _db
    
    except Exception as e:
        print(f"✗ Database connection error: {e}")
        return None

def test_connection():
    """
    Test MongoDB connection and return status.
    
    Returns:
        dict: Connection status with details
    """
    try:
        client = get_mongo_client()
        if client is None:
            return {
                'status': 'error',
                'message': 'Failed to get MongoDB client'
            }
        
        # Ping the database
        client.admin.command('ping')
        
        db = get_db()
        if db is None:
            return {
                'status': 'error',
                'message': 'Failed to get database'
            }
        
        # Get collection counts
        student_count = db.students.count_documents({})
        alerts_count = db.alerts.count_documents({})
        
        return {
            'status': 'success',
            'message': 'MongoDB connection successful',
            'database': Config.DB_NAME,
            'students_count': student_count,
            'alerts_count': alerts_count,
            'collections': db.list_collection_names()
        }
    
    except Exception as e:
        return {
            'status': 'error',
            'message': f'Database test failed: {str(e)}'
        }

def close_connection():
    """Close MongoDB connection (for cleanup)"""
    global _mongo_client, _db
    
    if _mongo_client is not None:
        _mongo_client.close()
        _mongo_client = None
        _db = None
        print("✓ MongoDB connection closed")
