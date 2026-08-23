import json
import secrets
from datetime import datetime, timezone
from sqlalchemy import text
from core_backend.database import engine, Base
from core_backend.models import User, PregnancyProfile, EmergencyProfile, EmergencyContact, PCOSMedicalReport

def run_migration():
    print(f"Running database migration using engine {engine.url}...")
    
    # Create all tables if not exist
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        # Check and add columns dynamically
        dialect_name = engine.dialect.name
        print(f"Dialect detected: {dialect_name}")

        columns_to_add = [
            ("subscription_tier", "VARCHAR DEFAULT 'FREE'"),
            ("medical_token", "VARCHAR"),
            ("nfc_card_linked", "BOOLEAN DEFAULT FALSE"),
            ("nfc_last_synced_at", "TIMESTAMP")
        ]

        for col_name, col_def in columns_to_add:
            try:
                if dialect_name == "postgresql":
                    stmt = text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_name} {col_def};")
                else:
                    stmt = text(f"ALTER TABLE users ADD COLUMN {col_name} {col_def};")
                conn.execute(stmt)
                conn.commit()
                print(f"Added column {col_name} successfully.")
            except Exception as e:
                # Column likely already exists
                print(f"Column {col_name} status: {e}")

        # Ensure index on medical_token
        try:
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_medical_token ON users (medical_token);"))
            conn.commit()
        except Exception as e:
            print(f"Index creation status: {e}")

    # Seed test data using SQLAlchemy session
    from core_backend.database import SessionLocal
    db = SessionLocal()
    try:
        free_user = db.query(User).filter(User.email == "free_mother@maternalcare.app").first()
        if not free_user:
            free_user = User(
                id=101,
                email="free_mother@maternalcare.app",
                hashed_password="$2b$12$eImiTXuWVxfM37uY4JANjO5E.y5b3N6L8w1W8W8W8W8W8W8W8W8W8",
                role="mother",
                subscription_tier="FREE",
                medical_token="med_pass_free_test_12345",
                nfc_card_linked=False
            )
            db.add(free_user)

        premium_user = db.query(User).filter(User.email == "premium_mother@maternalcare.app").first()
        if not premium_user:
            premium_user = User(
                id=102,
                email="premium_mother@maternalcare.app",
                hashed_password="$2b$12$eImiTXuWVxfM37uY4JANjO5E.y5b3N6L8w1W8W8W8W8W8W8W8W8W8",
                role="mother",
                subscription_tier="PREMIUM",
                medical_token="med_pass_premium_test_67890",
                nfc_card_linked=True,
                nfc_last_synced_at=datetime.now(timezone.utc)
            )
            db.add(premium_user)

        db.commit()

        # Seed profiles
        if not db.query(PregnancyProfile).filter(PregnancyProfile.user_id == free_user.id).first():
            db.add(PregnancyProfile(user_id=free_user.id, lmp_date=datetime.strptime("2026-01-15", "%Y-%m-%d").date(), ultrasound_due_date=datetime.strptime("2026-10-22", "%Y-%m-%d").date(), current_week=31))
        if not db.query(PregnancyProfile).filter(PregnancyProfile.user_id == premium_user.id).first():
            db.add(PregnancyProfile(user_id=premium_user.id, lmp_date=datetime.strptime("2026-02-01", "%Y-%m-%d").date(), ultrasound_due_date=datetime.strptime("2026-11-08", "%Y-%m-%d").date(), current_week=28))

        if not db.query(EmergencyProfile).filter(EmergencyProfile.user_id == free_user.id).first():
            db.add(EmergencyProfile(user_id=free_user.id, blood_group="O+", allergies="Penicillin, Shellfish", preferred_hospital="City General Maternity Hospital"))
        if not db.query(EmergencyProfile).filter(EmergencyProfile.user_id == premium_user.id).first():
            db.add(EmergencyProfile(user_id=premium_user.id, blood_group="AB-", allergies="Latex, Aspirin", preferred_hospital="St. Jude Women & Children Hospital"))

        if not db.query(EmergencyContact).filter(EmergencyContact.user_id == free_user.id).first():
            db.add(EmergencyContact(user_id=free_user.id, name="David Miller (Spouse)", phone_number="+15550192834", relation="Spouse", is_starred=True))
            db.add(EmergencyContact(user_id=free_user.id, name="Dr. Sarah Jenkins (OB/GYN)", phone_number="+15550192999", relation="Primary Doctor", is_starred=True))

        if not db.query(EmergencyContact).filter(EmergencyContact.user_id == premium_user.id).first():
            db.add(EmergencyContact(user_id=premium_user.id, name="Mark Evans (Husband)", phone_number="+15550187766", relation="Husband", is_starred=True))

        if not db.query(PCOSMedicalReport).filter(PCOSMedicalReport.user_id == free_user.id).first():
            db.add(PCOSMedicalReport(
                user_id=free_user.id,
                report_type="Lab Blood Test",
                extracted_values={
                    "summary": "Gestational Diabetes Screen: Mild elevation in Fasting Glucose (98 mg/dL). Recommended dietary monitoring.",
                    "risk_flags": ["Mild Gestational Diabetes Risk", "PCOS History"],
                    "lab_highlights": {"Fast_Glucose": "98 mg/dL", "TSH": "2.1 mIU/L", "HbA1c": "5.4%"}
                },
                ultrasound_findings={"finding": "No acute distress, normal fetal movement recorded."},
                is_confirmed=True
            ))

        db.commit()
        print("Database migration & seeding finished successfully.")
    finally:
        db.close()

if __name__ == '__main__':
    run_migration()
