from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
import secrets
from typing import Optional, List, Dict, Any

from core_backend.database import get_db
from core_backend.routers.auth import get_current_user
from core_backend import models, schemas

router = APIRouter(prefix="/nfc", tags=["nfc"])


def generate_secure_token() -> str:
    """Generates a cryptographically secure, high-entropy 32-byte URL-safe random token."""
    return secrets.token_urlsafe(32)


@router.post("/cards", response_model=schemas.NFCCardResponse)
def register_nfc_card(
    payload: Optional[schemas.NFCCardCreate] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Generate and register a new NFC Digital Health Card for a patient.
    Stores only a secure random token, never patient PII or medical data.
    """
    target_user_id = current_user.id
    if payload and payload.user_id:
        target_user = db.query(models.User).filter(models.User.id == payload.user_id).first()
        if target_user:
            target_user_id = target_user.id

    card_name = payload.card_name if (payload and payload.card_name) else "MotherCare Digital Health Card"
    secure_token = generate_secure_token()

    nfc_card = models.NFCCard(
        user_id=target_user_id,
        token=secure_token,
        status="active",
        card_name=card_name,
        created_at=datetime.utcnow()
    )
    db.add(nfc_card)
    db.commit()
    db.refresh(nfc_card)
    return nfc_card


@router.get("/cards", response_model=List[schemas.NFCCardResponse])
def get_user_nfc_cards(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Get all NFC cards registered for the logged-in user.
    """
    cards = db.query(models.NFCCard).filter(
        models.NFCCard.user_id == current_user.id
    ).order_by(models.NFCCard.created_at.desc()).all()
    
    # If no cards exist yet, auto-create one for convenience
    if not cards:
        new_card = models.NFCCard(
            user_id=current_user.id,
            token=generate_secure_token(),
            status="active",
            card_name="MotherCare Digital Health Card",
            created_at=datetime.utcnow()
        )
        db.add(new_card)
        db.commit()
        db.refresh(new_card)
        cards = [new_card]

    return cards


@router.get("/resolve/{token}", response_model=schemas.NFCResolveResponse)
def resolve_nfc_token(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Public token validation endpoint.
    Called when an NFC card URL (e.g. /health-card/<token>) is scanned.
    Validates token, verifies card status, updates audit log (last_used_at),
    and retrieves associated patient health profile.
    """
    card = db.query(models.NFCCard).filter(models.NFCCard.token == token).first()

    if not card or card.status != "active":
        return schemas.NFCResolveResponse(
            valid=False,
            status=card.status if card else "invalid",
            token=token,
            message="This MotherCare card is invalid or no longer active.",
            has_records=False,
            records=[]
        )

    # Update last_used_at timestamp
    card.last_used_at = datetime.utcnow()
    db.commit()

    user = db.query(models.User).filter(models.User.id == card.user_id).first()
    if not user:
        return schemas.NFCResolveResponse(
            valid=False,
            status="user_not_found",
            token=token,
            message="Associated patient profile not found.",
            has_records=False,
            records=[]
        )

    # Retrieve patient records
    health_records = db.query(models.HealthRecord).filter(
        models.HealthRecord.user_id == user.id
    ).order_by(models.HealthRecord.created_at.desc()).all()

    # Formulate patient summary
    preg_profile = user.pregnancy_profile
    emerg_profile = user.emergency_profile

    # Determine patient display name safely
    sample_rec = health_records[0] if health_records else None
    patient_name = sample_rec.patient_name if (sample_rec and sample_rec.patient_name) else f"MotherCare Patient #{user.id}"

    patient_info = {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "name": patient_name,
        "card_registered_at": card.created_at.isoformat(),
        "card_last_used_at": card.last_used_at.isoformat() if card.last_used_at else None
    }

    pregnancy_info = None
    if preg_profile:
        pregnancy_info = {
            "current_week": preg_profile.current_week,
            "lmp_date": preg_profile.lmp_date.isoformat() if preg_profile.lmp_date else None,
            "ultrasound_due_date": preg_profile.ultrasound_due_date.isoformat() if preg_profile.ultrasound_due_date else None,
        }

    emergency_info = None
    if emerg_profile:
        emergency_info = {
            "blood_group": emerg_profile.blood_group,
            "allergies": emerg_profile.allergies,
            "preferred_hospital": emerg_profile.preferred_hospital,
            "emergency_contacts": emerg_profile.emergency_contacts or []
        }

    formatted_records = []
    for r in health_records:
        formatted_records.append({
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "category": r.category,
            "status": r.status,
            "risk_level": r.risk_level,
            "gestational_week": r.gestational_week,
            "doctor_notes": r.doctor_notes,
            "recommendations": r.recommendations or [],
            "lab_values": r.lab_values or {},
            "attachment_url": r.attachment_url,
            "attachment_name": r.attachment_name,
            "attachment_type": r.attachment_type,
            "created_at": r.created_at.isoformat()
        })

    return schemas.NFCResolveResponse(
        valid=True,
        status="active",
        token=token,
        patient=patient_info,
        pregnancy_profile=pregnancy_info,
        emergency_profile=emergency_info,
        has_records=len(formatted_records) > 0,
        records=formatted_records,
        message="Active patient record loaded successfully."
    )


@router.post("/cards/{card_id}/revoke", response_model=schemas.NFCCardResponse)
def revoke_nfc_card(
    card_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Revoke a lost or compromised NFC card.
    Prevents any future access using the physical card tag without affecting patient data.
    """
    card = db.query(models.NFCCard).filter(
        models.NFCCard.id == card_id,
        models.NFCCard.user_id == current_user.id
    ).first()

    if not card:
        raise HTTPException(status_code=404, detail="NFC card not found.")

    card.status = "revoked"
    card.revoked_at = datetime.utcnow()
    db.commit()
    db.refresh(card)
    return card


@router.post("/cards/{card_id}/reissue", response_model=schemas.NFCCardResponse)
def reissue_nfc_card(
    card_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Revoke an existing card and generate a fresh NFC card with a new token for the same patient.
    All existing health records remain linked to the patient profile.
    """
    old_card = db.query(models.NFCCard).filter(
        models.NFCCard.id == card_id,
        models.NFCCard.user_id == current_user.id
    ).first()

    if old_card:
        old_card.status = "revoked"
        old_card.revoked_at = datetime.utcnow()

    # Create new replacement card
    new_card = models.NFCCard(
        user_id=current_user.id,
        token=generate_secure_token(),
        status="active",
        card_name="Reissued Digital Health Card",
        created_at=datetime.utcnow()
    )
    db.add(new_card)
    db.commit()
    db.refresh(new_card)
    return new_card


@router.post("/add-record/{token}")
def add_health_record_via_nfc(
    token: str,
    payload: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    Add a health record/report during an active NFC session (Case 2: initializing profile or updating record).
    Validates token and immediately associates data with the patient profile.
    """
    card = db.query(models.NFCCard).filter(models.NFCCard.token == token).first()
    if not card or card.status != "active":
        raise HTTPException(status_code=400, detail="Invalid or inactive NFC token.")

    title = payload.get("title", "New Health Record")
    category = payload.get("category", "General")
    description = payload.get("description", "Record added via MotherCare Digital Health Card")
    gestational_week = payload.get("gestational_week", 24)
    risk_level = payload.get("risk_level", "Low Risk")
    doctor_notes = payload.get("doctor_notes", "")
    lab_values = payload.get("lab_values", {})
    recommendations = payload.get("recommendations", [])

    record = models.HealthRecord(
        user_id=card.user_id,
        title=title,
        description=description,
        category=category,
        status="verified",
        role_visibility="user",
        patient_name="Divya Sharma",
        gestational_week=int(gestational_week) if gestational_week else 24,
        risk_level=risk_level,
        doctor_notes=doctor_notes,
        recommendations=recommendations,
        lab_values=lab_values,
        attachment_url=payload.get("attachment_url"),
        attachment_name=payload.get("attachment_name"),
        attachment_type=payload.get("attachment_type")
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "success": True,
        "message": "Health record added successfully to patient profile.",
        "record_id": record.id
    }
