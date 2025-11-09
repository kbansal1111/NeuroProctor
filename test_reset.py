"""
Quick test script to verify the reset endpoint is working
Run this while the backend server is running
"""
import requests
import json

BASE_URL = "http://localhost:5000"

def test_reset_all():
    """Test resetting all data for an exam"""
    print("\n" + "="*60)
    print("Testing Reset All Data")
    print("="*60)
    
    payload = {"exam_id": "exam_2025_ai"}
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/exam/reset",
            headers={"Content-Type": "application/json"},
            json=payload
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            print("✅ Reset all data successful!")
        else:
            print("❌ Reset all data failed!")
            
    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to backend. Is the server running on port 5000?")
    except Exception as e:
        print(f"❌ Error: {e}")

def test_reset_student():
    """Test resetting data for a specific student"""
    print("\n" + "="*60)
    print("Testing Reset Student Data")
    print("="*60)
    
    payload = {
        "exam_id": "exam_2025_ai",
        "student_id": "test_student_123"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/exam/reset",
            headers={"Content-Type": "application/json"},
            json=payload
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            print("✅ Reset student data successful!")
        else:
            print("❌ Reset student data failed!")
            
    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to backend. Is the server running on port 5000?")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("\n🧪 Testing Reset Endpoint")
    print("Make sure the backend server is running on http://localhost:5000\n")
    
    # Test 1: Reset specific student
    test_reset_student()
    
    # Test 2: Reset all data
    test_reset_all()
    
    print("\n" + "="*60)
    print("✅ All tests completed!")
    print("="*60 + "\n")
