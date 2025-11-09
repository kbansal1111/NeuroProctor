"""
Setup script to create default teacher accounts in MongoDB
Run this script after setting up your MongoDB connection to create initial teacher accounts.
"""

from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError

# MongoDB Configuration (update with your connection string)
MONGO_URI = "mongodb+srv://kartikbansal9152_db_user:TDYGu9eIsZpL6k4b@proj101.gfemks2.mongodb.net/?appName=Proj101"
DB_NAME = "ai_proctor_db"

def setup_teachers():
    """Create default teacher accounts with plain text passwords"""
    try:
        # Connect to MongoDB
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        db = client[DB_NAME]
        
        # Test connection
        client.admin.command('ping')
        print("✓ Connected to MongoDB successfully")
        
        # Default teacher accounts (plain text passwords)
        teachers = [
            {"username": "admin", "password": "admin123", "role": "admin"},
            {"username": "teacher1", "password": "teacher123", "role": "teacher"},
            {"username": "proctor", "password": "proctor123", "role": "proctor"}
        ]
        
        # Create unique index on username
        try:
            db.teachers.create_index("username", unique=True)
            print("✓ Created unique index on username")
        except Exception as e:
            print(f"Index may already exist: {e}")
        
        # Insert teachers
        inserted_count = 0
        for teacher in teachers:
            try:
                db.teachers.insert_one(teacher.copy())
                print(f"✓ Created teacher account: {teacher['username']} (password: {teacher['password']})")
                inserted_count += 1
            except DuplicateKeyError:
                print(f"⚠ Teacher account '{teacher['username']}' already exists - skipping")
        
        print(f"\n{'='*60}")
        print(f"Setup Complete!")
        print(f"{'='*60}")
        print(f"Total teachers inserted: {inserted_count}")
        print(f"Total teachers in database: {db.teachers.count_documents({})}")
        print(f"\nDefault Teacher Accounts:")
        print(f"  - admin/admin123 (role: admin)")
        print(f"  - teacher1/teacher123 (role: teacher)")
        print(f"  - proctor/proctor123 (role: proctor)")
        print(f"{'='*60}\n")
        
    except Exception as e:
        print(f"✗ Error setting up teachers: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("\n" + "="*60)
    print("Teacher Account Setup - Plain Text Passwords")
    print("="*60 + "\n")
    
    setup_teachers()
