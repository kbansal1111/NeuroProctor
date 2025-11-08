"""Test MongoDB connection"""
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

MONGO_URI = "mongodb+srv://kartikbansal9152_db_user:TDYGu9eIsZpL6k4b@proj101.gfemks2.mongodb.net/?appName=Proj101"
DB_NAME = "ai_proctor_db"

print("=" * 60)
print("Testing MongoDB Connection")
print("=" * 60)

try:
    print(f"\n1. Connecting to MongoDB...")
    client = MongoClient(
        MONGO_URI,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=10000,
        socketTimeoutMS=10000
    )
    
    print("2. Pinging database...")
    client.admin.command('ping')
    print("   ✓ Ping successful!")
    
    print(f"\n3. Accessing database: {DB_NAME}")
    db = client[DB_NAME]
    
    print("4. Listing collections...")
    collections = db.list_collection_names()
    print(f"   Found collections: {collections}")
    
    print("\n5. Counting documents...")
    if 'students' in collections:
        student_count = db.students.count_documents({})
        print(f"   Students: {student_count}")
        
        # Show one sample student
        sample = db.students.find_one()
        if sample:
            print(f"   Sample student: {sample.get('username')} (Roll: {sample.get('roll_number')})")
    
    if 'alerts' in collections:
        alerts_count = db.alerts.count_documents({})
        print(f"   Alerts: {alerts_count}")
    
    print("\n" + "=" * 60)
    print("✓ MongoDB Connection Test PASSED!")
    print("=" * 60)
    print(f"\nConnection String: {MONGO_URI[:50]}...")
    print(f"Database: {DB_NAME}")
    print(f"Status: CONNECTED")
    print("=" * 60)
    
except ConnectionFailure as e:
    print(f"\n✗ Connection failed: {e}")
except ServerSelectionTimeoutError as e:
    print(f"\n✗ Server selection timeout: {e}")
except Exception as e:
    print(f"\n✗ Unexpected error: {e}")
finally:
    try:
        client.close()
        print("\nConnection closed.")
    except:
        pass
