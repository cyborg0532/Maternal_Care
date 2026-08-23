import sys
import os
from fastapi.testclient import TestClient

# Ensure root folder is in pythonpath
sys.path.insert(0, os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from core_backend.main import app
from core_backend.routers.auth import create_access_token
from core_backend.database import SessionLocal
from core_backend.models import User

client = TestClient(app)

def test_emergency_passport_flow():
    print("\n--- RUNNING EMERGENCY PASSPORT AUTOMATED TESTS ---")
    db = SessionLocal()
    
    # 1. Get Free & Premium test users from DB
    free_user = db.query(User).filter(User.email == "free_mother@maternalcare.app").first()
    premium_user = db.query(User).filter(User.email == "premium_mother@maternalcare.app").first()

    assert free_user is not None, "Free test user not found in DB"
    assert premium_user is not None, "Premium test user not found in DB"

    print(f"Loaded Free User ID {free_user.id}, Token: {free_user.medical_token}")
    print(f"Loaded Premium User ID {premium_user.id}, Token: {premium_user.medical_token}")

    # Ensure free_user tier is FREE initially
    free_user.subscription_tier = "FREE"
    free_user.nfc_card_linked = False
    db.commit()

    free_jwt = create_access_token(data={"sub": str(free_user.id)})
    premium_jwt = create_access_token(data={"sub": str(premium_user.id)})

    headers_free = {"Authorization": f"Bearer {free_jwt}"}
    headers_premium = {"Authorization": f"Bearer {premium_jwt}"}

    # TEST 1: GET /api/emergency/token (Free User)
    print("\n[TEST 1] Testing GET /api/emergency/token (Free User)...")
    res1 = client.get("/api/emergency/token", headers=headers_free)
    assert res1.status_code == 200, f"Expected 200, got {res1.status_code}"
    data1 = res1.json()
    assert "medical_token" in data1
    assert data1["subscription_tier"] == "FREE"
    assert "maternalcare.app/m/" in data1["target_url"]
    print("✓ Passed! Response:", data1)

    # TEST 2: POST /api/nfc/provision (Free User -> Rejection 403)
    print("\n[TEST 2] Testing POST /api/nfc/provision (Free User -> 403 Forbidden)...")
    res2 = client.post("/api/nfc/provision", headers=headers_free)
    assert res2.status_code == 403, f"Expected 403 Forbidden, got {res2.status_code}"
    data2 = res2.json()
    assert data2["tier"] == "FREE"
    assert "Hardware NFC provisioning is restricted to Premium tier" in data2["error"]
    print("✓ Passed! Received exact 403 payload:", data2)

    # TEST 3: POST /api/user/subscription (Upgrade Free User to PREMIUM)
    print("\n[TEST 3] Testing POST /api/user/subscription (Upgrade to PREMIUM)...")
    res3 = client.post("/api/user/subscription", json={"subscription_tier": "PREMIUM"}, headers=headers_free)
    assert res3.status_code == 200
    assert res3.json()["subscription_tier"] == "PREMIUM"
    print("✓ Passed! User upgraded to PREMIUM.")

    # TEST 4: POST /api/nfc/provision (Now Premium User -> Provisioning Success)
    print("\n[TEST 4] Testing POST /api/nfc/provision (Premium User -> Provisioning Success)...")
    res4 = client.post("/api/nfc/provision", headers=headers_free)
    assert res4.status_code == 200, f"Expected 200, got {res4.status_code}"
    data4 = res4.json()
    assert data4["success"] is True
    assert data4["nfc_card_linked"] is True
    assert "maternalcare.app/m/" in data4["ndef_payload"]
    print("✓ Passed! Received NDEF payload:", data4)

    # Reset user back to FREE for remaining tests
    client.post("/api/user/subscription", json={"subscription_tier": "FREE"}, headers=headers_free)

    # TEST 5: GET /api/public/medical-passport/{token} (Public JSON API)
    med_token = free_user.medical_token
    print(f"\n[TEST 5] Testing Public Passport JSON Endpoint for token '{med_token}'...")
    res5 = client.get(f"/api/public/medical-passport/{med_token}")
    assert res5.status_code == 200, f"Expected 200, got {res5.status_code}"
    data5 = res5.json()
    assert "mother_name" in data5
    assert "blood_group" in data5
    assert len(data5["emergency_contacts"]) > 0
    assert "tel:" in data5["emergency_contacts"][0]["tel_link"]
    print("✓ Passed! Public medical data:", data5)

    # TEST 6: GET /m/{token} (Public Emergency HTML View)
    print(f"\n[TEST 6] Testing Public Emergency HTML Web View for token '{med_token}'...")
    res6 = client.get(f"/m/{med_token}")
    assert res6.status_code == 200, f"Expected 200, got {res6.status_code}"
    assert "EMERGENCY MEDICAL PASSPORT" in res6.text
    assert "CALL NOW" in res6.text
    print("✓ Passed! HTML route rendered successfully.")

    db.close()
    print("\n=== ALL EMERGENCY PASSPORT BACKEND TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    test_emergency_passport_flow()
