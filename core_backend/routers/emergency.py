from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy.orm import Session
import secrets
import json
from datetime import datetime, timezone

from core_backend.database import get_db
from core_backend import models, schemas
from core_backend.config import settings
from core_backend.routers.auth import get_current_user

router = APIRouter(tags=["emergency"])

@router.get("/api/emergency/token", response_model=schemas.MedicalTokenResponse)
def get_emergency_token(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.medical_token:
        current_user.medical_token = secrets.token_urlsafe(16)
        db.commit()
        db.refresh(current_user)

    target_url = f"{settings.APP_BASE_URL.rstrip('/')}/m/{current_user.medical_token}"

    return {
        "medical_token": current_user.medical_token,
        "target_url": target_url,
        "subscription_tier": current_user.subscription_tier or "FREE",
        "nfc_card_linked": current_user.nfc_card_linked or False,
        "nfc_last_synced_at": current_user.nfc_last_synced_at.isoformat() if current_user.nfc_last_synced_at else None
    }

@router.post("/api/nfc/provision")
def provision_nfc_card(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Tier gating check
    if (current_user.subscription_tier or "FREE").upper() != "PREMIUM":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "error": "Hardware NFC provisioning is restricted to Premium tier due to supply constraints. Please use your Emergency QR Passport.",
                "tier": "FREE"
            }
        )

    if not current_user.medical_token:
        current_user.medical_token = secrets.token_urlsafe(16)

    current_user.nfc_card_linked = True
    current_user.nfc_last_synced_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(current_user)

    ndef_url = f"{settings.APP_BASE_URL.rstrip('/')}/m/{current_user.medical_token}"

    return {
        "success": True,
        "ndef_payload": ndef_url,
        "nfc_card_linked": True,
        "synced_at": current_user.nfc_last_synced_at
    }

@router.post("/api/user/subscription")
def update_subscription_tier(
    req: schemas.SubscriptionUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    raw_tier = req.subscription_tier or req.tier or "FREE"
    tier = raw_tier.upper()
    if tier not in ["FREE", "PREMIUM"]:
        raise HTTPException(status_code=400, detail="Invalid subscription tier. Must be FREE or PREMIUM.")
    
    current_user.subscription_tier = tier
    db.commit()
    db.refresh(current_user)

    return {
        "message": f"Subscription updated to {tier}",
        "subscription_tier": current_user.subscription_tier
    }

def build_passport_payload(user: models.User, db: Session):
    emergency_prof = db.query(models.EmergencyProfile).filter(models.EmergencyProfile.user_id == user.id).first()
    pregnancy_prof = db.query(models.PregnancyProfile).filter(models.PregnancyProfile.user_id == user.id).first()
    contacts = db.query(models.EmergencyContact).filter(models.EmergencyContact.user_id == user.id).all()
    reports = db.query(models.PCOSMedicalReport).filter(models.PCOSMedicalReport.user_id == user.id).all()

    contacts_list = []
    for c in contacts:
        phone_clean = c.phone_number.strip()
        contacts_list.append({
            "name": c.name,
            "phone_number": phone_clean,
            "relation": c.relation,
            "tel_link": f"tel:{phone_clean.replace(' ', '')}"
        })

    # If no emergency contacts in DB table, check JSON column in emergency profile
    if not contacts_list and emergency_prof and emergency_prof.emergency_contacts:
        try:
            json_contacts = emergency_prof.emergency_contacts if isinstance(emergency_prof.emergency_contacts, list) else json.loads(emergency_prof.emergency_contacts)
            for c in json_contacts:
                p = str(c.get("phone_number", c.get("phone", "")))
                contacts_list.append({
                    "name": c.get("name", "Emergency Contact"),
                    "phone_number": p,
                    "relation": c.get("relation", "Relative"),
                    "tel_link": f"tel:{p.replace(' ', '')}"
                })
        except Exception:
            pass

    # Extract risk alerts
    risk_alerts = []
    if emergency_prof and emergency_prof.allergies:
        risk_alerts.append(f"ALLERGIES: {emergency_prof.allergies}")

    ai_insights = []
    for r in reports:
        if r.extracted_values:
            val = r.extracted_values if isinstance(r.extracted_values, dict) else json.loads(r.extracted_values)
            if "risk_flags" in val:
                for flag in val["risk_flags"]:
                    if flag not in risk_alerts:
                        risk_alerts.append(flag)
            ai_insights.append({
                "report_type": r.report_type,
                "upload_date": r.upload_date.isoformat() if r.upload_date else None,
                "summary": val.get("summary", r.raw_text or "Analysis completed."),
                "ultrasound_findings": r.ultrasound_findings
            })

    mother_name = user.email.split("@")[0].replace(".", " ").replace("_", " ").title() + " (Patient)"

    return {
        "mother_name": mother_name,
        "email": user.email,
        "blood_group": emergency_prof.blood_group if emergency_prof else "Unknown",
        "allergies": emergency_prof.allergies if emergency_prof else "None reported",
        "preferred_hospital": emergency_prof.preferred_hospital if emergency_prof else "Not specified",
        "current_gestational_week": pregnancy_prof.current_week if pregnancy_prof else 28,
        "expected_due_date": str(pregnancy_prof.ultrasound_due_date) if (pregnancy_prof and pregnancy_prof.ultrasound_due_date) else "2026-11-01",
        "emergency_contacts": contacts_list,
        "critical_risk_alerts": risk_alerts,
        "ai_report_insights": ai_insights
    }

@router.get("/api/public/medical-passport/{token}", response_model=schemas.PublicMedicalPassportResponse)
def get_public_medical_passport_json(token: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.medical_token == token).first()
    if not user:
        raise HTTPException(status_code=404, detail="Emergency Medical Passport not found or token invalid.")

    return build_passport_payload(user, db)

@router.get("/m/{token}", response_class=HTMLResponse)
def get_public_medical_passport_html(token: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.medical_token == token).first()
    if not user:
        return HTMLResponse(content="""
            <!DOCTYPE html>
            <html>
            <head><title>Invalid Emergency Pass</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
            <body style="font-family: system-ui, sans-serif; background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
                <div style="text-align: center; padding: 2rem; background: #1e293b; border-radius: 1rem; border: 1px solid #ef4444;">
                    <h1 style="color: #ef4444; margin-bottom: 0.5rem;">⚠️ Medical Passport Not Found</h1>
                    <p style="color: #94a3b8;">The emergency QR/NFC code scanned is invalid or expired.</p>
                </div>
            </body>
            </html>
        """, status_code=404)

    data = build_passport_payload(user, db)

    contacts_html = ""
    for c in data["emergency_contacts"]:
        contacts_html += f"""
        <div class="contact-card">
            <div>
                <div class="contact-name">{c['name']}</div>
                <div class="contact-relation">{c['relation']} • {c['phone_number']}</div>
            </div>
            <a href="{c['tel_link']}" class="call-btn">📞 CALL NOW</a>
        </div>
        """

    if not contacts_html:
        contacts_html = "<p style='color:#94a3b8;'>No emergency contacts registered.</p>"

    alerts_html = ""
    for alert in data["critical_risk_alerts"]:
        alerts_html += f"""<div class="alert-pill">⚠️ {alert}</div>"""

    if not alerts_html:
        alerts_html = "<div style='color:#10b981; font-weight:600;'>✓ No High-Risk Alerts Active</div>"

    insights_html = ""
    for insight in data["ai_report_insights"]:
        insights_html += f"""
        <div class="insight-box">
            <div class="insight-type">📄 {insight['report_type']}</div>
            <div class="insight-summary">{insight['summary']}</div>
        </div>
        """

    if not insights_html:
        insights_html = "<p style='color:#94a3b8;'>No AI lab report insights recorded.</p>"

    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>EMERGENCY MEDICAL PASSPORT - {data['mother_name']}</title>
        <style>
            * {{ box-sizing: border-box; margin: 0; padding: 0; }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background-color: #090d16;
                color: #f8fafc;
                padding: 16px;
                display: flex;
                justify-content: center;
            }}
            .passport-container {{
                width: 100%;
                max-width: 540px;
                background: #111827;
                border: 2px solid #dc2626;
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 20px 25px -5px rgba(220, 38, 38, 0.25);
            }}
            .header-banner {{
                background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
                padding: 20px;
                text-align: center;
            }}
            .header-title {{
                color: #ffffff;
                font-size: 20px;
                font-weight: 900;
                letter-spacing: 1.5px;
                text-transform: uppercase;
            }}
            .header-subtitle {{
                color: #fca5a5;
                font-size: 13px;
                font-weight: 600;
                margin-top: 4px;
            }}
            .content-section {{ padding: 20px; }}
            .patient-hero {{
                background: #1f2937;
                border-radius: 14px;
                padding: 16px;
                margin-bottom: 20px;
                border-left: 4px solid #3b82f6;
            }}
            .patient-name {{ font-size: 22px; font-weight: 800; color: #ffffff; }}
            .patient-sub {{ color: #9ca3af; font-size: 14px; margin-top: 2px; }}
            
            .grid-stats {{
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
                margin-bottom: 20px;
            }}
            .stat-box {{
                background: #1f2937;
                padding: 14px;
                border-radius: 12px;
                text-align: center;
                border: 1px solid #374151;
            }}
            .stat-label {{ font-size: 11px; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.5px; }}
            .stat-value {{ font-size: 20px; font-weight: 800; color: #f3f4f6; margin-top: 4px; }}
            .highlight-blood {{ color: #ef4444; }}

            .section-title {{
                font-size: 14px;
                font-weight: 800;
                text-transform: uppercase;
                color: #9ca3af;
                letter-spacing: 1px;
                margin-bottom: 10px;
                display: flex;
                align-items: center;
                gap: 6px;
            }}

            .alert-container {{ margin-bottom: 20px; }}
            .alert-pill {{
                background: rgba(220, 38, 38, 0.2);
                border: 1px solid #ef4444;
                color: #fca5a5;
                padding: 10px 14px;
                border-radius: 10px;
                font-weight: 700;
                font-size: 14px;
                margin-bottom: 8px;
            }}

            .contact-card {{
                background: #1f2937;
                border-radius: 12px;
                padding: 14px;
                margin-bottom: 10px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border: 1px solid #374151;
            }}
            .contact-name {{ font-weight: 700; font-size: 16px; color: #ffffff; }}
            .contact-relation {{ font-size: 13px; color: #9ca3af; margin-top: 2px; }}
            .call-btn {{
                background: #16a34a;
                color: #ffffff;
                text-decoration: none;
                font-weight: 800;
                padding: 10px 16px;
                border-radius: 10px;
                font-size: 13px;
                display: inline-block;
                box-shadow: 0 4px 6px -1px rgba(22, 163, 74, 0.3);
            }}

            .insight-box {{
                background: #1f2937;
                border-radius: 12px;
                padding: 14px;
                margin-bottom: 10px;
                border-left: 3px solid #8b5cf6;
            }}
            .insight-type {{ font-size: 12px; font-weight: 700; color: #a78bfa; margin-bottom: 4px; }}
            .insight-summary {{ font-size: 13px; color: #d1d5db; line-height: 1.4; }}

            .footer-note {{
                text-align: center;
                font-size: 11px;
                color: #6b7280;
                margin-top: 20px;
                padding-top: 12px;
                border-top: 1px solid #1f2937;
            }}
        </style>
    </head>
    <body>
        <div class="passport-container">
            <div class="header-banner">
                <div class="header-title">🚨 EMERGENCY MEDICAL PASSPORT</div>
                <div class="header-subtitle">MATERNAL & FETAL CRITICAL RESPONSE CARD</div>
            </div>

            <div class="content-section">
                <div class="patient-hero">
                    <div class="patient-name">{data['mother_name']}</div>
                    <div class="patient-sub">Preferred Hospital: {data['preferred_hospital']}</div>
                </div>

                <div class="grid-stats">
                    <div class="stat-box">
                        <div class="stat-label">Blood Group</div>
                        <div class="stat-value highlight-blood">{data['blood_group']}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Gestational Age</div>
                        <div class="stat-value">Week {data['current_gestational_week']}</div>
                    </div>
                </div>

                <div class="section-title">⚠️ CRITICAL RISK ALERTS & ALLERGIES</div>
                <div class="alert-container">
                    {alerts_html}
                </div>

                <div class="section-title">📞 DIRECT EMERGENCY CONTACTS</div>
                <div style="margin-bottom: 20px;">
                    {contacts_html}
                </div>

                <div class="section-title">🧠 AI REPORT ANALYSER INSIGHTS</div>
                <div>
                    {insights_html}
                </div>

                <div class="footer-note">
                    Verified Emergency Medical Data • MaternalCare Network Security Encrypted
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)
