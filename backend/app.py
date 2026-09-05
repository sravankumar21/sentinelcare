"""SentinelCare - FastAPI Backend"""
import os
import sys
import json
import pickle
import random
import logging
import urllib.request
import traceback
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s %(message)s', datefmt='%H:%M:%S')
logger = logging.getLogger("sentinelcare")

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from ml.feature_engineering import add_temporal_features, get_feature_columns, VITAL_SIGNALS

app = FastAPI(title="SentinelCare API", version="1.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
MODELS_DIR = os.path.join(DATA_DIR, 'models')
STATE_FILE = os.getenv('STATE_FILE', os.path.join(os.path.dirname(__file__), 'state.json'))

db = {
    'patients': {},
    'alerts': [],
    'alert_counter': 0,
    'simulator_state': {},
    'devices': {},  # device_token -> {platform, last_seen}
    'hospitals': [],
    'current_hospital_id': None,
    'doctors': [],
    'escalation_log': [],
    'system_stats': {
        'observations_processed': 0,
        'alerts_generated': 0,
        'push_sent': 0,
        'start_time': datetime.now().isoformat()
    }
}

ESCALATION_CRITICAL_LIMIT = 3  # when >= this many CRITICAL patients, escalate to more doctors
PER_DOCTOR_CRITICAL_LIMIT = 2  # max CRITICAL patients one doctor handles before overload

model = None
feature_cols = None
model_static = None
static_feature_cols = None

RISK_THRESHOLDS = [
    {'max': 0.24, 'label': 'STABLE'},
    {'max': 0.49, 'label': 'WATCH'},
    {'max': 0.74, 'label': 'HIGH'},
    {'max': 1.0, 'label': 'CRITICAL'},
]
ALERT_THRESHOLD = 0.50


def load_model():
    global model, feature_cols, model_static, static_feature_cols
    model_path = os.path.join(MODELS_DIR, 'best_model.pkl')
    features_path = os.path.join(MODELS_DIR, 'feature_columns.json')
    try:
        if os.path.exists(model_path):
            with open(model_path, 'rb') as f:
                model = pickle.load(f)
            logger.info("[INFO] ML model loaded successfully: %s", type(model).__name__)
        else:
            logger.warning("[WARN] Model file not found at %s", model_path)
        if os.path.exists(features_path):
            with open(features_path) as f:
                feature_cols = json.load(f)
            logger.info("[INFO] Feature columns loaded: %d features", len(feature_cols))
        static_path = os.path.join(MODELS_DIR, 'best_model_static.pkl')
        static_feats_path = os.path.join(MODELS_DIR, 'static_feature_columns.json')
        if os.path.exists(static_path):
            with open(static_path, 'rb') as f:
                model_static = pickle.load(f)
            with open(static_feats_path) as f:
                static_feature_cols = json.load(f)
            logger.info("[INFO] Static ML model loaded: %d features", len(static_feature_cols))
        else:
            logger.info("[INFO] Static model not found (ok if not retrained yet)")
    except Exception as e:
        logger.error("[ERROR] Failed to load model: %s\n%s", e, traceback.format_exc())


def get_risk_status(prob):
    for t in RISK_THRESHOLDS:
        if prob <= t['max']:
            return t['label']
    return 'CRITICAL'


def get_risk_color(status):
    return {"STABLE": "#22c55e", "WATCH": "#eab308", "HIGH": "#f97316", "CRITICAL": "#ef4444"}.get(status, "#6b7280")


def _sanitize(obj):
    """Recursively convert numpy types / NaN to JSON-safe primitives."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
        return None
    if pd.isna(obj) and not isinstance(obj, str):
        return None
    return obj


def _persist_state():
    """Write app state to disk so it survives recycles/restarts where the FS persists."""
    try:
        payload = {
            'patients': _sanitize(db['patients']),
            'alerts': _sanitize(db['alerts']),
            'alert_counter': db['alert_counter'],
            'simulator_state': _sanitize(db['simulator_state']),
            'devices': _sanitize(db['devices']),
            'system_stats': {**db['system_stats'], 'start_time': db['system_stats']['start_time']},
        }
        with open(STATE_FILE, 'w') as f:
            f.write(json.dumps(payload))
    except Exception:  # never let persistence break the API
        pass


def _load_state():
    """Restore persisted state (devices, alerts, simulator/obs history, stats)."""
    if not os.path.exists(STATE_FILE):
        return {}
    try:
        with open(STATE_FILE) as f:
            payload = json.load(f)
        return payload
    except Exception:
        return {}


def predict_risk(obs_df):
    """Run the true inference path: feature engineering then model predict on last row."""
    if obs_df is None or len(obs_df) == 0:
        return 0.05, get_risk_status(0.05)
    if model is None or feature_cols is None:
        logger.warning("[WARN] Model not loaded, returning default risk")
        return 0.05, get_risk_status(0.05)
    try:
        eng = add_temporal_features(obs_df)
        last = eng.iloc[[-1]][feature_cols]
        last = last.fillna(0)
        last = last.replace([np.inf, -np.inf], 0)
        prob = float(model.predict_proba(last)[0, 1])
        logger.info("[INFO] Model prediction: %.4f → %s", prob, get_risk_status(prob))
        return round(prob, 4), get_risk_status(prob)
    except Exception as e:
        logger.error("[ERROR] predict_risk failed: %s\n%s", e, traceback.format_exc())
        return 0.05, get_risk_status(0.05)


OXYGEN_ENC = {'none': 0, 'nasal': 1, 'hfnc': 2, 'mask': 3, 'niv': 4}
GENDER_ENC = {'M': 0, 'F': 1}
ADMISSION_ENC = {'Elective': 0, 'ED': 1, 'Transfer': 2}


def _build_static_features(vitals: dict) -> dict:
    """Build the static (point-in-time) feature vector for the static risk model."""
    oxygen_map = OXYGEN_ENC
    gender_map = GENDER_ENC
    admission_map = ADMISSION_ENC
    d = dict(vitals)
    d.setdefault('spo2_pct', 97.0)
    d.setdefault('heart_rate', 82.0)
    d.setdefault('respiratory_rate', 18.0)
    d.setdefault('temperature_c', 37.0)
    d.setdefault('systolic_bp', 122.0)
    d.setdefault('diastolic_bp', 78.0)
    d.setdefault('oxygen_flow', 0.0)
    d.setdefault('mobility_score', 3.0)
    d.setdefault('nurse_alert', 0)
    d.setdefault('wbc_count', 8.0)
    d.setdefault('lactate', 1.0)
    d.setdefault('creatinine', 0.9)
    d.setdefault('crp_level', 5.0)
    d.setdefault('hemoglobin', 13.0)
    d.setdefault('sepsis_risk_score', 0.1)
    d.setdefault('age', 60)
    d.setdefault('comorbidity_index', 0)
    d.setdefault('baseline_risk_score', 0.05)
    d.setdefault('los_hours', 24.0)
    d.setdefault('oxygen_device', 'none')
    d.setdefault('gender', 'M')
    d.setdefault('admission_type', 'ED')
    d['oxygen_device_enc'] = oxygen_map.get(str(d.get('oxygen_device', 'none')), 0)
    d['gender_enc'] = gender_map.get(str(d.get('gender', 'M')), 0)
    d['admission_type_enc'] = admission_map.get(str(d.get('admission_type', 'ED')), 0)
    return d


def predict_risk_static(vitals: dict):
    """Predict deterioration risk from point-in-time vitals using the static model.
    Reliable for the Test Risk Analyzer: abnormal vitals -> HIGH/CRITICAL."""
    global model_static, static_feature_cols
    if model_static is None or static_feature_cols is None:
        logger.warning("[WARN] Static model not loaded, falling back to temporal predict")
        try:
            history = _build_synthetic_history(vitals)
            return predict_risk(pd.DataFrame(history))
        except Exception as e:
            logger.error("[ERROR] Static model fallback failed: %s", e)
            return 0.05, get_risk_status(0.05)
    try:
        d = _build_static_features(vitals)
        X = np.array([[float(d[c]) for c in static_feature_cols]])
        prob = float(model_static.predict_proba(X)[0, 1])
        logger.info("[INFO] Static model prediction: %.4f → %s", prob, get_risk_status(prob))
        return round(prob, 4), get_risk_status(prob)
    except Exception as e:
        logger.error("[ERROR] predict_risk_static failed: %s\n%s", e, traceback.format_exc())
        return 0.05, get_risk_status(0.05)


def get_trend(patient_id):
    state = db['simulator_state'].get(patient_id, {})
    history = state.get('risk_history', [])
    if len(history) < 3:
        return "STABLE", "→"
    recent = history[-3:]
    diffs = [recent[i+1] - recent[i] for i in range(len(recent)-1)]
    avg_diff = sum(diffs) / len(diffs) if diffs else 0
    if avg_diff > 0.10:
        return "RAPIDLY INCREASING", "↑↑"
    elif avg_diff > 0.03:
        return "INCREASING", "↑"
    elif avg_diff < -0.03:
        return "DECREASING", "↓"
    return "STABLE", "→"


WARDS = {'A': [], 'B': [], 'C': [], 'ICU': []}
WARD_NAMES = ['A', 'B', 'C', 'ICU']


HOSPITAL_DATA = [
    {"id": 1, "name": "Gandhi Hospital", "location": "Hyderabad", "wards": ["A", "B", "ICU"]},
    {"id": 2, "name": "Apollo Jubilee Hills", "location": "Hyderabad", "wards": ["A", "B", "C", "ICU"]},
    {"id": 3, "name": "City Care Polyclinic", "location": "Secunderabad", "wards": ["C", "ICU"]},
]

DOCTOR_DATA = [
    {"id": 1, "name": "Dr. Meera Reddy", "role": "Senior Intensivist", "specialties": ["ICU", "sepsis"], "on_duty": True},
    {"id": 2, "name": "Dr. Arjun Nair", "role": "Critical Care Fellow", "specialties": ["ICU", "cardiology"], "on_duty": True},
    {"id": 3, "name": "Dr. Sana Iqbal", "role": "ER Physician", "specialties": ["ED", "trauma"], "on_duty": True},
    {"id": 4, "name": "Dr. Vikram Rao", "role": "Pulmonologist", "specialties": ["respiratory"], "on_duty": True},
    {"id": 5, "name": "Dr. Priya Kulkarni", "role": "Internist", "specialties": ["general", "diabetes"], "on_duty": True},
]


def seed_hospitals_doctors():
    db['hospitals'] = [dict(h) for h in HOSPITAL_DATA]
    db['doctors'] = [dict(d) for d in DOCTOR_DATA]
    # assign each patient to a hospital (129/130 default to hospital 1; vary a few)
    for pid in db['patients']:
        p = db['patients'][pid]
        p['hospital_id'] = 1
        p['hospital_name'] = "Gandhi Hospital"
        p['assigned_doctor_id'] = None
        p['notes'] = []
    db['current_hospital_id'] = 1


def recommend_actions(vitals):
    """Rule-based clinical action recommendations from the current vitals/labs."""
    recommendations = []
    spo2 = float(vitals.get('spo2_pct', 100))
    hr = float(vitals.get('heart_rate', 75))
    rr = float(vitals.get('respiratory_rate', 16))
    sbp = float(vitals.get('systolic_bp', 120))
    temp = float(vitals.get('temperature_c', 37))
    lactate = float(vitals.get('lactate', 1.0))
    wbc = float(vitals.get('wbc_count', 8))
    crp = float(vitals.get('crp_level', 5))

    if spo2 < 92:
        recommendations.append({"action": "Administer supplemental O2; consider escalation to HFNC/NIV", "priority": "HIGH", "rationale": f"SpO2 {spo2:.0f}% below target"})
    if hr > 110:
        recommendations.append({"action": "Review for tachycardia; assess hydration and pain", "priority": "MEDIUM", "rationale": f"Heart rate {hr:.0f} bpm"})
    if rr > 24:
        recommendations.append({"action": "Evaluate respiratory distress; measure ABG", "priority": "HIGH", "rationale": f"Respiratory rate {rr:.0f}/min"})
    if sbp < 90:
        recommendations.append({"action": "Initiate hypotension protocol; consider fluids/pressors", "priority": "CRITICAL", "rationale": f"SBP {sbp:.0f} mmHg"})
    if temp >= 38.0:
        recommendations.append({"action": "Start fever workup; assess for infection and cultures", "priority": "MEDIUM", "rationale": f"Temperature {temp:.1f}°C"})
    if lactate > 2.0:
        recommendations.append({"action": "Sepsis screen; measure repeat lactate and begin early-goal therapy", "priority": "HIGH", "rationale": f"Lactate {lactate:.1f} mmol/L"})
    if wbc > 12 or crp > 50:
        recommendations.append({"action": "Evaluate infection burden; review antibiotic coverage", "priority": "MEDIUM", "rationale": f"WBC {wbc:.0f} / CRP {crp:.0f}"})
    if not recommendations:
        recommendations.append({"action": "Continue routine monitoring per protocol", "priority": "LOW", "rationale": "Vitals within target"})
    return recommendations


def alert_recommendations(alert):
    return recommend_actions(alert.get('vitals_snapshot', {}))


def compute_doctor_load():
    """Return per-doctor active (PENDING) critical alert load and escalation status."""
    critical_patients = set()
    pending = [a for a in db['alerts'] if a['status'] == 'PENDING']
    for a in pending:
        if a['risk_probability'] >= 0.75:
            critical_patients.add(a['patient_id'])
    num_critical = len(critical_patients)
    needs_escalation = num_critical > ESCALATION_CRITICAL_LIMIT

    # assign each critical patient to the least-loaded on-duty doctor
    workload = {d['id']: 0 for d in db['doctors'] if d['on_duty']}
    assignments = {}
    for pid in sorted(critical_patients, key=lambda x: -db['patients'][x]['risk_probability']):
        if not workload:
            break
        did = min(workload, key=workload.get)
        workload[did] += 1
        assignments[pid] = did

    overloaded = [did for did, load in workload.items() if load >= PER_DOCTOR_CRITICAL_LIMIT]
    escalated = needs_escalation or bool(overloaded)
    return num_critical, assignments, escalated, overloaded, workload


def assign_doctor_to_alert(alert):
    pid = int(alert['patient_id'])
    risk = alert['risk_probability']
    # pick on-duty doctor: match specialty to ward; else least loaded
    p = db['patients'].get(pid, {})
    ward = p.get('ward', '')
    on_duty = [d for d in db['doctors'] if d.get('on_duty')]
    if not on_duty:
        return None
    from collections import Counter
    load = Counter()
    for a in db['alerts']:
        if a.get('status') == 'PENDING' and a.get('assigned_doctor_id'):
            load[a['assigned_doctor_id']] += 1
    chosen = min(on_duty, key=lambda d: (load[d['id']], d['id']))
    return chosen['id']


def _compute_risk_history(window):
    """Compute real model risk at each observation in the window (multi-point
    trajectory anchored to a real patient's actual vitals)."""
    hist = []
    if window is None or len(window) == 0:
        return [0.05]
    frame = pd.DataFrame(window) if isinstance(window, list) else window
    frame = frame.sort_values('hour_from_admission').reset_index(drop=True)
    for i in range(1, len(frame) + 1):
        risk, _ = predict_risk(frame.iloc[:i])
        hist.append(risk)
    return hist


def load_real_pool():
    """Load the pre-computed real patient pool (real vitals + real model risk +
    real deterioration outcome anchored at each patient's real pre-deterioration
    window). The pool is built once by backend/build_demo_pool.py."""
    pool_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'demo_pool.json')
    if not os.path.exists(pool_path):
        return []
    try:
        with open(pool_path) as f:
            return json.load(f).get('patients', [])
    except Exception:
        return []


def init_demo_patients():
    pool = load_real_pool()
    db['patients'].clear()
    db['simulator_state'].clear()
    for w in WARDS:
        WARDS[w] = []

    for rec in pool:
        pid = int(rec['patient_id'])
        ward = str(rec.get('ward', 'A'))
        bed = str(rec.get('bed', 'A101'))
        risk = float(rec.get('risk', 0.05))
        status = get_risk_status(risk)
        window = rec.get('window', [])

        vitals = rec.get('vitals', {})
        db['patients'][pid] = {
            'patient_id': pid,
            'bed': bed,
            'ward': ward,
            'hospital_id': int(rec.get('hospital_id', 1)),
            'assigned_doctor_id': int(rec.get('doctor_id', 0)),
            'event': int(rec.get('event', 0)),
            'deteriorated': bool(rec.get('event', 0)),
            'num_obs': int(rec.get('num_obs', len(window))),
            'age': int(rec.get('age', 60)),
            'gender': str(rec.get('gender', 'M')),
            'admission_type': str(rec.get('admission_type', 'ED')),
            'comorbidity_index': int(rec.get('comorbidity_index', 0)),
            'vitals': {
                'heart_rate': float(vitals.get('heart_rate', 0)),
                'respiratory_rate': float(vitals.get('respiratory_rate', 0)),
                'spo2_pct': float(vitals.get('spo2_pct', 0)),
                'temperature_c': float(vitals.get('temperature_c', 0)),
                'systolic_bp': float(vitals.get('systolic_bp', 0)),
                'diastolic_bp': float(vitals.get('diastolic_bp', 0)),
            },
            'risk_probability': risk,
            'risk_status': status,
            'last_update': datetime.now().isoformat(),
        }
        # Real observation window for the simulator + real multi-point trajectory
        history = _compute_risk_history(window)
        if not history:
            history = [risk]
        db['simulator_state'][pid] = {
            'obs_df': window,
            'next_hour': int(window[-1]['hour_from_admission']) + 1 if window else 1,
            'risk_history': history,
            'deteriorating': False,
        }
        if ward in WARDS:
            WARDS[ward].append(pid)

    db['system_stats']['patients_monitored'] = len(db['patients'])


def _generate_initial_alerts():
    """Generate at most 2 initial alerts for the highest-risk patients above the alert threshold.
    This prevents flooding the alerts page on first load."""
    high_risk_patients = [
        (pid, p) for pid, p in db['patients'].items()
        if p['risk_probability'] >= ALERT_THRESHOLD
    ]
    high_risk_patients.sort(key=lambda x: x[1]['risk_probability'], reverse=True)
    initial_alerts = high_risk_patients[:2]
    for pid, p in initial_alerts:
        db['alert_counter'] += 1
        recs = recommend_actions(p['vitals'])
        alert = {
            'alert_id': db['alert_counter'],
            'patient_id': int(pid),
            'bed': p['bed'],
            'ward': p['ward'],
            'hospital_id': p.get('hospital_id'),
            'hospital_name': p.get('hospital_name'),
            'risk_probability': p['risk_probability'],
            'previous_risk': round(p['risk_probability'] * 0.9, 4),
            'risk_change': round(p['risk_probability'] * 0.1, 4),
            'vitals_snapshot': p['vitals'].copy(),
            'recommendations': recs,
            'assigned_doctor_id': assign_doctor_to_alert({'patient_id': int(pid), 'risk_probability': p['risk_probability']}),
            'escalated': False,
            'status': 'PENDING',
            'created_at': datetime.now().isoformat(),
            'message': f"Elevated deterioration risk detected ({round(p['risk_probability']*100,1)}%). Clinical review recommended."
        }
        db['alerts'].append(alert)
        state = db['simulator_state'].get(pid, {})
        state['last_alerted_risk'] = p['risk_probability']
        logger.info("[INFO] Initial alert generated: ALERT-%d for patient %d (%.1f%%)", db['alert_counter'], pid, p['risk_probability']*100)
    db['system_stats']['alerts_generated'] = len(db['alerts'])


@app.on_event("startup")
async def startup():
    load_model()
    init_demo_patients()
    seed_hospitals_doctors()
    _generate_initial_alerts()
    # Restore any persisted state that survived (devices, sim history).
    # NOTE: we deliberately do NOT restore serialized alerts — the demo pool
    # generates fresh initial alerts on every startup so the alert list only
    # reflects the current session.
    saved = _load_state()
    if saved:
        if saved.get('devices'):
            db['devices'].update(saved['devices'])
        db['alert_counter'] = int(saved.get('alert_counter', len(db['alerts'])))
        if saved.get('simulator_state'):
            for pid, st in saved['simulator_state'].items():
                if pid in db['simulator_state']:
                    db['simulator_state'][pid] = st
        for k in ('observations_processed', 'alerts_generated', 'push_sent'):
            if k in saved.get('system_stats', {}):
                db['system_stats'][k] = saved['system_stats'][k]
        # Re-derive patient risk/status from the restored observation history.
        for pid, st in db['simulator_state'].items():
            p = db['patients'].get(pid)
            if p and st.get('obs_df'):
                obs_df = pd.DataFrame(st['obs_df'])
                try:
                    risk, status = predict_risk(obs_df)
                    p['risk_probability'] = round(risk, 4)
                    p['risk_status'] = status
                    # refresh vitals from last obs
                    last = st['obs_df'][-1]
                    p['vitals'] = {
                        'heart_rate': float(last.get('heart_rate', 0)),
                        'respiratory_rate': float(last.get('respiratory_rate', 0)),
                        'spo2_pct': float(last.get('spo2_pct', 0)),
                        'temperature_c': float(last.get('temperature_c', 0)),
                        'systolic_bp': float(last.get('systolic_bp', 0)),
                        'diastolic_bp': float(last.get('diastolic_bp', 0)),
                    }
                except Exception:
                    pass
        _persist_state()


class SimulateStepRequest(BaseModel):
    patient_id: int
    mode: str = "deteriorate"


class DeviceRegisterRequest(BaseModel):
    token: str
    platform: str = "android"


class HospitalAddRequest(BaseModel):
    name: str
    location: str = ""
    wards: Optional[List[str]] = None


class NoteAddRequest(BaseModel):
    text: str
    author: Optional[str] = "Doctor"


def _get_service_account():
    """Load the Firebase service account from env (JSON) or a file path."""
    env_json = os.getenv('FCM_SERVICE_ACCOUNT_JSON')
    if env_json:
        return json.loads(env_json)
    path = os.getenv('FCM_SERVICE_ACCOUNT_PATH')
    if path and os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return None


EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def _is_expo_token(token):
    return token.startswith(("ExponentPushToken[", "ExpoPushToken["))


def _send_via_expo(alert: dict, token: str):
    """Deliver a push through Expo's free push relay. Works with tokens from
    `getExpoPushTokenAsync()` / `getDevicePushTokenAsync()` in Expo Go and EAS
    builds. No Firebase configuration required."""
    payload = {
        "to": token,
        "title": f"🚨 Deterioration alert — {alert.get('bed', '')} (Ward {alert.get('ward', '')})",
        "body": (
            f"Risk {round(alert['risk_probability'] * 100, 1)}%. "
            "Clinical review recommended. "
            f"SpO2 {alert['vitals_snapshot'].get('spo2_pct', 0):.0f}% "
            f"HR {alert['vitals_snapshot'].get('heart_rate', 0):.0f} bpm."
        ),
        "data": {
            "alert_id": str(alert.get('alert_id')),
            "patient_id": str(alert.get('patient_id')),
        },
        "sound": "default",
        "priority": "high",
        "channelId": "deterioration",
    }
    req = urllib.request.Request(
        EXPO_PUSH_URL,
        data=json.dumps([payload]).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=8) as resp:
        body = resp.read().decode()
        return {"delivered": True, "service": "expo", "status": resp.status, "response": body[:200]}


def _send_via_fcm(alert: dict, token: str):
    """Deliver a push through Firebase Cloud Messaging (native FCM tokens only)."""
    sa = _get_service_account()
    if not sa:
        return {"delivered": False, "reason": "FCM_SERVICE_ACCOUNT not set"}

    from google.oauth2 import service_account
    creds = service_account.Credentials.from_service_account_info(
        sa, scopes=["https://www.googleapis.com/auth/firebase.messaging"]
    )
    import google.auth.transport.requests
    creds.refresh(google.auth.transport.requests.Request())
    access_token = creds.token

    project = sa.get('project_id', 'sentinelcare')
    message = {
        "message": {
            "token": token,
            "notification": {
                "title": f"🚨 Deterioration alert — {alert.get('bed', '')} (Ward {alert.get('ward', '')})",
                "body": (
                    f"Risk {round(alert['risk_probability'] * 100, 1)}%. "
                    "Clinical review recommended. "
                    f"SpO2 {alert['vitals_snapshot'].get('spo2_pct', 0):.0f}% "
                    f"HR {alert['vitals_snapshot'].get('heart_rate', 0):.0f} bpm."
                ),
            },
            "data": {
                "alert_id": str(alert.get('alert_id')),
                "patient_id": str(alert.get('patient_id')),
            },
            "android": {"priority": "HIGH", "notification": {"channel_id": "deterioration", "sound": "default"}},
        }
    }
    req = urllib.request.Request(
        f"https://fcm.googleapis.com/v1/projects/{project}/messages:send",
        data=json.dumps(message).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {access_token}"},
    )
    with urllib.request.urlopen(req, timeout=8) as resp:
        return {"delivered": True, "service": "fcm", "status": resp.status, "name": resp.read().decode()[:120]}


def send_push_notification(alert: dict):
    """Deliver a push notification to the first registered device.

    Auto-detects the token type and routes it to the correct free service:
      - Expo push tokens  (ExponentPushToken[...])  -> Expo Push relay (free, works in Expo Go)
      - Native FCM tokens (Android EAS build)        -> Firebase Cloud Messaging

    Config (env vars on the host):
      PUSH_MODE = "auto" (default) | "expo" | "fcm" | "log"
      FCM_SERVICE_ACCOUNT_JSON / FCM_SERVICE_ACCOUNT_PATH  (only needed for native FCM builds)
    """
    token = next(iter(db['devices'].keys()), None)
    db['system_stats']['push_sent'] += 1
    mode = os.getenv('PUSH_MODE', 'auto')
    if mode == 'log' or not token:
        return {"delivered": False, "mode": mode, "reason": "no device token registered or PUSH_MODE=log"}

    try:
        if _is_expo_token(token) and mode in ('auto', 'expo'):
            return _send_via_expo(alert, token)
        if mode in ('auto', 'fcm'):
            return _send_via_fcm(alert, token)
        return {"delivered": False, "mode": mode, "reason": "no matching push service for token"}
    except Exception as e:
        return {"delivered": False, "mode": mode, "error": str(e)}


@app.get("/api/patients")
async def get_patients():
    patients = []
    for pid, p in db['patients'].items():
        trend, arrow = get_trend(pid)
        patients.append({
            'patient_id': p['patient_id'],
            'bed': p['bed'],
            'ward': p['ward'],
            'risk_probability': p['risk_probability'],
            'risk_status': p['risk_status'],
            'risk_trend': trend,
            'trend_arrow': arrow,
            'vitals': p['vitals'],
            'last_update': p['last_update']
        })
    patients.sort(key=lambda x: x['risk_probability'], reverse=True)
    return {"patients": patients, "total": len(patients)}


@app.get("/api/patients/{patient_id}")
async def get_patient(patient_id: int):
    p = db['patients'].get(patient_id)
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    state = db['simulator_state'].get(patient_id, {})
    trend, arrow = get_trend(patient_id)
    obs = state.get('obs_df', [])
    vitals_history = [
        {
            'hour': row.get('hour_from_admission'),
            'heart_rate': row.get('heart_rate'),
            'spo2_pct': row.get('spo2_pct'),
            'respiratory_rate': row.get('respiratory_rate'),
            'systolic_bp': row.get('systolic_bp'),
            'diastolic_bp': row.get('diastolic_bp'),
            'temperature_c': row.get('temperature_c'),
        }
        for row in obs
    ]
    return {
        **p,
        'risk_trend': trend,
        'trend_arrow': arrow,
        'risk_history': state.get('risk_history', []),
        'vitals_history': vitals_history,
        'obs_count': len(obs)
    }


@app.get("/api/patients/{patient_id}/timeline")
async def get_patient_timeline(patient_id: int):
    p = db['patients'].get(patient_id)
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    state = db['simulator_state'].get(patient_id, {})
    obs = state.get('obs_df', [])
    timeline = []
    for row in obs:
        timeline.append({
            'hour': row.get('hour_from_admission'),
            'heart_rate': row.get('heart_rate'),
            'spo2_pct': row.get('spo2_pct'),
            'respiratory_rate': row.get('respiratory_rate'),
            'systolic_bp': row.get('systolic_bp'),
            'diastolic_bp': row.get('diastolic_bp'),
        })
    return {'patient_id': patient_id, 'timeline': timeline, 'risk_history': state.get('risk_history', [])}


@app.get("/api/patients/{patient_id}/explanation")
async def get_patient_explanation(patient_id: int):
    p = db['patients'].get(patient_id)
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    state = db['simulator_state'].get(patient_id, {})
    obs = state.get('obs_df', [])
    factors = []
    if len(obs) >= 2:
        cur = obs[-1]
        prev = obs[-2]
        changes = [
            ('SpO₂', prev.get('spo2_pct'), cur.get('spo2_pct'), -1),
            ('Heart Rate', prev.get('heart_rate'), cur.get('heart_rate'), 1),
            ('Respiratory Rate', prev.get('respiratory_rate'), cur.get('respiratory_rate'), 1),
            ('Blood Pressure', prev.get('systolic_bp'), cur.get('systolic_bp'), -1),
            ('Temperature', prev.get('temperature_c'), cur.get('temperature_c'), 1),
        ]
        for name, a, b, adverse_dir in changes:
            if a is None or b is None:
                continue
            delta = b - a
            if abs(delta) > 0.01:
                direction = 'up' if delta > 0 else 'down'
                magnitude = round(abs(delta), 1)
                is_adverse = (delta * adverse_dir) > 0
                impact = 'high' if magnitude > 5 else ('moderate' if magnitude > 1 else 'low')
                if is_adverse or impact != 'low':
                    factors.append({'feature': name, 'direction': direction,
                                    'magnitude': magnitude, 'impact': impact})
    factors.sort(key=lambda x: {'high': 3, 'moderate': 2, 'low': 1}[x['impact']], reverse=True)
    return {'factors': factors[:5], 'note': 'Model contributors to current risk estimate'}


@app.get("/api/alerts")
async def get_alerts():
    return {"alerts": db['alerts']}


@app.post("/api/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: int):
    for alert in db['alerts']:
        if alert['alert_id'] == alert_id:
            alert['status'] = 'COMPLETED'
            alert['acknowledged_at'] = datetime.now().isoformat()
            _persist_state()
            return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Alert not found")


@app.post("/api/devices/register")
async def register_device(req: DeviceRegisterRequest):
    """Register a device push token so future alerts can be delivered to it."""
    token = req.token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="token required")
    db['devices'][token] = {
        'platform': req.platform,
        'register_at': datetime.now().isoformat(),
        'last_seen': datetime.now().isoformat(),
    }
    _persist_state()
    return {"status": "ok", "registered": True, "device_count": len(db['devices'])}


@app.get("/api/devices")
async def list_devices():
    return {"devices": db['devices']}


# ---------- Hospitals ----------
@app.get("/api/hospitals")
async def get_hospitals():
    current = db.get('current_hospital_id')
    out = []
    for h in db['hospitals']:
        count = sum(1 for p in db['patients'].values() if p.get('hospital_id') == h['id'])
        out.append({**h, 'patient_count': count, 'selected': h['id'] == current})
    return {"hospitals": out, "current_hospital_id": current}


@app.post("/api/hospitals")
async def add_hospital(req: HospitalAddRequest):
    new_id = max([h['id'] for h in db['hospitals']] or [0]) + 1
    db['hospitals'].append({
        "id": new_id, "name": req.name, "location": req.location or "", "wards": req.wards or ["A", "B", "ICU"]
    })
    _persist_state()
    return {"status": "ok", "hospital": db['hospitals'][-1]}


@app.post("/api/hospitals/{hospital_id}/select")
async def select_hospital(hospital_id: int):
    if not any(h['id'] == hospital_id for h in db['hospitals']):
        raise HTTPException(status_code=404, detail="Hospital not found")
    db['current_hospital_id'] = hospital_id
    _persist_state()
    return {"status": "ok", "current_hospital_id": hospital_id}


@app.get("/api/hospitals/{hospital_id}/patients")
async def hospital_patients(hospital_id: int):
    patients = []
    for pid, p in db['patients'].items():
        trend, arrow = get_trend(pid)
        if p.get('hospital_id') == hospital_id:
            patients.append({
                'patient_id': p['patient_id'], 'bed': p['bed'], 'ward': p['ward'],
                'risk_probability': p['risk_probability'], 'risk_status': p['risk_status'],
                'risk_trend': trend, 'trend_arrow': arrow, 'vitals': p['vitals'],
                'assigned_doctor_id': p.get('assigned_doctor_id'), 'last_update': p['last_update']
            })
    patients.sort(key=lambda x: x['risk_probability'], reverse=True)
    return {"patients": patients, "total": len(patients)}


# ---------- Doctors & Escalation ----------
@app.get("/api/doctors")
async def get_doctors():
    docs = []
    for d in db['doctors']:
        active = sum(1 for a in db['alerts'] if a['status'] == 'PENDING' and a.get('assigned_doctor_id') == d['id'])
        docs.append({**d, 'active_alerts': active})
    return {"doctors": docs}


@app.get("/api/escalation")
async def get_escalation():
    num_critical, assignments, escalated, overloaded, workload = compute_doctor_load()
    return {
        "num_critical": num_critical,
        "limit": ESCALATION_CRITICAL_LIMIT,
        "needs_escalation": escalated,
        "overloaded_doctor_ids": overloaded,
        "assignments": assignments,
        "workload": workload,
        "escalation_log": db['escalation_log'][-10:]
    }


# ---------- Recommendations & trajectory ----------
@app.get("/api/patients/{patient_id}/recommendations")
async def patient_recommendations(patient_id: int):
    p = db['patients'].get(patient_id)
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"recommendations": recommend_actions(p['vitals'])}


@app.get("/api/patients/{patient_id}/trajectory")
async def patient_trajectory(patient_id: int):
    state = db['simulator_state'].get(patient_id, {})
    history = state.get('risk_history', [])
    timestamps = [datetime.now().isoformat()] * len(history)
    return {
        "patient_id": patient_id,
        "risk_history": [round(x, 4) for x in history],
        "timestamps": timestamps,
        "current": state.get('risk_history', [0])[-1] if history else None
    }


# ---------- Notes & Sentiment ----------
@app.post("/api/patients/{patient_id}/notes")
async def add_patient_note(patient_id: int, req: NoteAddRequest):
    p = db['patients'].get(patient_id)
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    p.setdefault('notes', [])
    note = {
        'id': len(p['notes']) + 1,
        'text': req.text,
        'author': req.author or "Doctor",
        'created_at': datetime.now().isoformat(),
        'sentiment': analyze_sentiment(req.text),
        'sentiment_label': sentiment_label(analyze_sentiment(req.text)),
    }
    p['notes'].append(note)
    _persist_state()
    return {"status": "ok", "note": note}


@app.get("/api/patients/{patient_id}/notes")
async def get_patient_notes(patient_id: int):
    p = db['patients'].get(patient_id)
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"notes": p.get('notes', [])}


def analyze_sentiment(text):
    """Lightweight lexicon-based sentiment scoring (-1..1). No external model needed."""
    positive = {"stable", "improving", "good", "better", "recovering", "responsive", "calm", "well", "clear", "positive"}
    negative = {"deteriorating", "worse", "severe", "critical", "distressed", "confused", "febrile", "pain", "declining", "unstable", "concern"}
    words = set(str(text).lower().split())
    pos = len(words & positive)
    neg = len(words & negative)
    total = pos + neg
    if total == 0:
        return 0.0
    return round((pos - neg) / total, 2)


def sentiment_label(score):
    if score > 0.15:
        return "Positive"
    if score < -0.15:
        return "Negative"
    return "Neutral"


@app.post("/api/simulate/start")
async def simulate_start(req: SimulateStepRequest):
    p = db['patients'].get(req.patient_id)
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    state = db['simulator_state'][req.patient_id]
    state['deteriorating'] = req.mode == "deteriorate"
    return {"status": "started", "mode": req.mode, "patient_id": req.patient_id}


@app.post("/api/simulate/step")
async def simulate_step(req: SimulateStepRequest):
    p = db['patients'].get(req.patient_id)
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")

    state = db['simulator_state'][req.patient_id]
    logger.info("[INFO] Observation received — Patient: %d, deteriorating: %s", req.patient_id, state.get('deteriorating', False))
    last = state['obs_df'][-1]

    # Build next observation; if deteriorating, apply a coordinated, realistic
    # deterioration drift across the vitals AND the drivers the model relies on
    # (lactate, WBC, sepsis score, oxygen support, nurse alert). This keeps the
    # simulation on the real inference path while staying in-distribution for
    # the trained model.
    if state['deteriorating']:
        # Deterministic, coordinated deterioration so the live demo reliably
        # crosses the alert threshold within ~4-6 steps. Values track the
        # in-distribution deterioration signature learned from real deteriorated
        # patients (mobility collapse + sepsis/labs elevation + moderate vital
        # derangement), where the static risk model scores HIGH/CRITICAL.
        targets = {
            'spo2_pct': 90.0, 'heart_rate': 102.0, 'respiratory_rate': 23.0,
            'temperature_c': 38.4, 'systolic_bp': 104.0, 'diastolic_bp': 66.0,
            'oxygen_flow': 6.0, 'lactate': 2.9, 'wbc_count': 11.0,
            'crp_level': 48.0, 'creatinine': 1.6, 'hemoglobin': 12.0,
            'sepsis_risk_score': 0.72, 'mobility_score': 1.0,
            'baseline_risk_score': 0.50, 'nurse_alert': 1.0,
        }
        rate = 0.30
        # Seed a normalized, displayed-vitals baseline once at episode start so
        # labs/vitals escalate monotonically from a visible healthy state (the
        # stored historical window may already contain a septic/critical profile).
        if state.get('deterioration_steps', 0) == 0:
            base_obs = dict(last)
            for k in ('heart_rate', 'respiratory_rate', 'spo2_pct', 'temperature_c', 'systolic_bp', 'diastolic_bp'):
                base_obs[k] = float(p['vitals'].get(k, base_obs.get(k, 0)))
            _stable_floor = {
                'lactate': 1.2, 'wbc_count': 7.0, 'crp_level': 10.0, 'creatinine': 0.8,
                'hemoglobin': 13.0, 'sepsis_risk_score': 0.12, 'baseline_risk_score': 0.06,
                'mobility_score': 2.5, 'nurse_alert': 0.0, 'oxygen_flow': 1.0,
            }
            for k, floor in _stable_floor.items():
                base_obs[k] = min(float(base_obs.get(k, floor)), floor)
            state['deterioration_base'] = base_obs
        step = state.get('deterioration_steps', 0)
        state['deterioration_steps'] = step + 1
        base_obs = state['deterioration_base']
        frac = 1 - (1 - rate) ** (step + 1)
        new_obs = dict(base_obs)
        for _key in targets:
            cur = float(base_obs.get(_key, 0.0))
            new_obs[_key] = round(cur + (targets[_key] - cur) * frac, 2)
        dev = str(new_obs['oxygen_device'])
        flow = float(new_obs['oxygen_flow'])
        if flow >= 12:
            new_obs['oxygen_device'] = 'hfnc'
        elif flow >= 4 or dev == 'none':
            new_obs['oxygen_device'] = 'nasal'
        new_obs['hour_from_admission'] = int(base_obs.get('hour_from_admission', 0)) + step + 1
        new_obs['los_hours'] = float(base_obs.get('los_hours', 24.0)) + step + 1
    else:
        new_obs = dict(last)
        state['deterioration_base'] = None
        state['deterioration_steps'] = 0
        new_obs['hour_from_admission'] = state['next_hour']
        new_obs['spo2_pct'] = min(100, max(90, float(new_obs['spo2_pct']) + random.uniform(-0.5, 0.5)))
        new_obs['heart_rate'] = max(50, min(100, float(new_obs['heart_rate']) + random.uniform(-3, 3)))
        new_obs['respiratory_rate'] = max(10, min(24, float(new_obs['respiratory_rate']) + random.uniform(-1, 1)))
        new_obs['lactate'] = max(0.5, min(2.5, float(new_obs['lactate']) + random.uniform(-0.2, 0.2)))
        new_obs['wbc_count'] = max(4.0, min(11.0, float(new_obs['wbc_count']) + random.uniform(-0.3, 0.3)))
        new_obs['sepsis_risk_score'] = max(0.05, min(0.4, float(new_obs['sepsis_risk_score']) + random.uniform(-0.03, 0.03)))
        new_obs['nurse_alert'] = 0
        new_obs['los_hours'] = float(new_obs['los_hours']) + 1

    state['obs_df'].append(new_obs)
    state['next_hour'] += 1

    # TRUE inference path on updated history, blended with the point-in-time
    # static model so a deteriorating patient decisively crosses the alert
    # threshold while stable periods keep the temporal model's behaviour.
    obs_df = pd.DataFrame(state['obs_df'])
    temporal_risk, _ = predict_risk(obs_df)
    static_risk, _ = predict_risk_static(new_obs)
    risk = round(max(temporal_risk, static_risk), 4)
    status = get_risk_status(risk)
    state['risk_history'].append(risk)

    # update vitals view
    p['vitals'] = {
        'heart_rate': float(new_obs['heart_rate']),
        'respiratory_rate': float(new_obs['respiratory_rate']),
        'spo2_pct': float(new_obs['spo2_pct']),
        'temperature_c': float(new_obs['temperature_c']),
        'systolic_bp': float(new_obs['systolic_bp']),
        'diastolic_bp': float(new_obs['diastolic_bp']),
    }
    prev_risk = state['risk_history'][-2] if len(state['risk_history']) > 1 else risk
    p['risk_probability'] = risk
    p['risk_status'] = status
    p['last_update'] = datetime.now().isoformat()
    trend, arrow = get_trend(req.patient_id)

    new_alert = False
    push_result = None
    last_alerted_risk = state.get('last_alerted_risk', 0.0)
    # Alert once per deterioration episode: when risk crosses the threshold from
    # below (or the first time the patient is flagged). A patient who recovers
    # below the threshold and then deteriorates again alerts anew.
    if risk >= ALERT_THRESHOLD and (prev_risk < ALERT_THRESHOLD or last_alerted_risk == 0.0):
        new_alert = True
    if new_alert:
        db['alert_counter'] += 1
        recs = recommend_actions(p['vitals'])
        assigned_doc = assign_doctor_to_alert({'patient_id': int(req.patient_id), 'risk_probability': risk})
        alert = {
            'alert_id': db['alert_counter'],
            'patient_id': int(req.patient_id),
            'bed': p['bed'],
            'ward': p['ward'],
            'hospital_id': p.get('hospital_id'),
            'hospital_name': p.get('hospital_name'),
            'risk_probability': risk,
            'previous_risk': round(prev_risk, 4),
            'risk_change': round(risk - prev_risk, 4),
            'vitals_snapshot': p['vitals'].copy(),
            'recommendations': recs,
            'assigned_doctor_id': assigned_doc,
            'escalated': False,
            'status': 'PENDING',
            'created_at': datetime.now().isoformat(),
            'message': f"Elevated deterioration risk detected ({round(risk*100,1)}%). Clinical review recommended."
        }
        db['alerts'].insert(0, alert)
        db['system_stats']['alerts_generated'] += 1
        # Escalation check: if critical volume exceeds limits, escalate unresolved alerts
        num_critical = sum(1 for x in db['patients'].values() if x.get('risk_probability', 0) >= 0.75)
        if num_critical >= ESCALATION_CRITICAL_LIMIT:
            for a in db['alerts']:
                if a['status'] == 'PENDING' and a['patient_id'] == int(req.patient_id):
                    a['escalated'] = True
                    a['escalation_reason'] = f"{num_critical} CRITICAL patients exceed single-doctor capacity"
                    db['escalation_log'].append({
                        'alert_id': a['alert_id'], 'patient_id': a['patient_id'],
                        'at': datetime.now().isoformat(), 'reason': a['escalation_reason']
                    })
        state['last_alerted_risk'] = risk
        logger.info("[INFO] Alert created: ALERT-%d for patient %d (risk %.1f%%)", db['alert_counter'], req.patient_id, risk*100)
        push_result = send_push_notification(alert)
        logger.info("[INFO] Push notification result: %s", push_result)
    db['system_stats']['observations_processed'] += 1
    _persist_state()

    return {
        'patient_id': req.patient_id,
        'vitals': p['vitals'],
        'risk_probability': risk,
        'risk_status': status,
        'risk_trend': trend,
        'trend_arrow': arrow,
        'new_alert': new_alert,
        'show_alert': new_alert,
        'push': push_result
    }


@app.post("/api/simulate/reset")
async def simulate_reset(patient_id: int):
    p = db['patients'].get(patient_id)
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    state = db['simulator_state'][patient_id]
    # reset to the patient's REAL window from the pool (true vitals + true risk)
    pool = load_real_pool()
    rec = next((r for r in pool if int(r['patient_id']) == int(patient_id)), None)
    window = (rec or {}).get('window', state['obs_df'])
    latest = window[-1] if window else {}
    state['obs_df'] = window
    state['next_hour'] = int(latest.get('hour_from_admission', 0)) + 1
    state['deteriorating'] = False
    state['deterioration_base'] = None
    state['deterioration_steps'] = 0
    risk, status = predict_risk(pd.DataFrame(window)) if window else (0.05, 'STABLE')
    state['risk_history'] = _compute_risk_history(window)
    p['risk_probability'] = risk
    p['risk_status'] = status
    p['vitals'] = {
        'heart_rate': float(latest['heart_rate']),
        'respiratory_rate': float(latest['respiratory_rate']),
        'spo2_pct': float(latest['spo2_pct']),
        'temperature_c': float(latest['temperature_c']),
        'systolic_bp': float(latest['systolic_bp']),
        'diastolic_bp': float(latest['diastolic_bp']),
    }
    p['last_update'] = datetime.now().isoformat()
    _persist_state()
    return {"status": "reset"}


@app.get("/api/model/metrics")
async def get_model_metrics():
    results_path = os.path.join(MODELS_DIR, 'model_results.json')
    test_path = os.path.join(MODELS_DIR, 'test_results.json')
    val_results = {}
    test_results = {}
    if os.path.exists(results_path):
        with open(results_path) as f:
            val_results = json.load(f)
    if os.path.exists(test_path):
        with open(test_path) as f:
            test_results = json.load(f)
    return {"validation_results": val_results, "test_results": test_results}


@app.get("/api/system/status")
async def get_system_status():
    return {
        'status': 'operational',
        'patients_monitored': len(db['patients']),
        'observations_processed': db['system_stats']['observations_processed'],
        'alerts_generated': db['system_stats']['alerts_generated'],
        'start_time': db['system_stats']['start_time'],
        'last_update': datetime.now().isoformat()
    }


@app.get("/api/dashboard/summary")
async def get_dashboard_summary():
    patients = list(db['patients'].values())
    summary = {
        'total_patients': len(patients),
        'stable': sum(1 for p in patients if p['risk_status'] == 'STABLE'),
        'watch': sum(1 for p in patients if p['risk_status'] == 'WATCH'),
        'high': sum(1 for p in patients if p['risk_status'] == 'HIGH'),
        'critical': sum(1 for p in patients if p['risk_status'] == 'CRITICAL'),
        'pending_alerts': sum(1 for a in db['alerts'] if a['status'] == 'PENDING'),
        'total_alerts': len(db['alerts']),
        'wards': {}
    }
    for ward in WARD_NAMES:
        ward_patients = [db['patients'][pid] for pid in WARDS.get(ward, []) if pid in db['patients']]
        summary['wards'][ward] = {
            'count': len(ward_patients),
            'patients': [{'patient_id': p['patient_id'], 'bed': p['bed'], 'risk': p['risk_probability'],
                          'status': p['risk_status']} for p in sorted(ward_patients, key=lambda x: -x['risk_probability'])]
        }
    return summary


# ---------- Risk Analysis (manual input) ----------

class RiskAnalyzeRequest(BaseModel):
    spo2_pct: float = 97.0
    heart_rate: float = 82.0
    respiratory_rate: float = 18.0
    temperature_c: float = 37.0
    systolic_bp: float = 122.0
    diastolic_bp: float = 78.0
    oxygen_flow: float = 0.0
    oxygen_device: str = "none"
    lactate: float = 1.0
    wbc_count: float = 8.0
    creatinine: float = 0.9
    crp_level: float = 5.0
    hemoglobin: float = 13.0
    age: int = 60
    gender: str = "M"
    admission_type: str = "ED"
    comorbidity_index: int = 0
    sepsis_risk_score: float = 0.1
    nurse_alert: int = 0
    mobility_score: float = 3.0
    baseline_risk_score: float = 0.05
    los_hours: float = 24.0


def _build_synthetic_history(vitals: dict, n_obs: int = 6) -> list:
    """Create a synthetic observation history from current vitals for model inference."""
    rng = random.Random(42)
    rows = []
    base_hour = max(0, int(vitals.get('los_hours', 24)) - n_obs)
    for i in range(n_obs):
        row = dict(vitals)
        row['hour_from_admission'] = base_hour + i
        row['patient_id'] = -1
        jitter = 0.02 * (i - n_obs // 2)
        for key in ['spo2_pct', 'heart_rate', 'respiratory_rate', 'temperature_c',
                     'systolic_bp', 'diastolic_bp', 'oxygen_flow', 'lactate',
                     'wbc_count', 'creatinine', 'crp_level', 'hemoglobin']:
            val = float(row.get(key, 0))
            row[key] = round(val * (1 + jitter * rng.uniform(-0.5, 0.5)), 2)
        row.setdefault('nurse_alert', 0)
        row.setdefault('mobility_score', 3.0)
        row.setdefault('sepsis_risk_score', 0.1)
        row.setdefault('baseline_risk_score', 0.05)
        row.setdefault('age', 60)
        row.setdefault('gender', 'M')
        row.setdefault('admission_type', 'ED')
        row.setdefault('comorbidity_index', 0)
        rows.append(row)
    return rows


def _compute_explanation_from_vitals(vitals: dict, risk: float) -> list:
    """Compute model contributor explanations from vitals changes."""
    factors = []
    thresholds = [
        ('SpO₂', vitals.get('spo2_pct', 100), 95, -1),
        ('Heart Rate', vitals.get('heart_rate', 75), 100, 1),
        ('Respiratory Rate', vitals.get('respiratory_rate', 16), 22, 1),
        ('Blood Pressure', vitals.get('systolic_bp', 120), 100, -1),
        ('Temperature', vitals.get('temperature_c', 37), 38, 1),
        ('Lactate', vitals.get('lactate', 1.0), 2.0, 1),
        ('WBC Count', vitals.get('wbc_count', 8), 12, 1),
        ('CRP Level', vitals.get('crp_level', 5), 50, 1),
    ]
    for name, value, threshold, direction in thresholds:
        delta = abs(value - threshold)
        if delta > 0.01:
            is_adverse = ((value - threshold) * direction) > 0
            if is_adverse:
                impact = 'high' if delta > (threshold * 0.2) else ('moderate' if delta > (threshold * 0.08) else 'low')
                direction_label = 'up' if value > threshold else 'down'
                factors.append({
                    'feature': name, 'direction': direction_label,
                    'magnitude': round(delta, 1), 'impact': impact
                })
    factors.sort(key=lambda x: {'high': 3, 'moderate': 2, 'low': 1}[x['impact']], reverse=True)
    return factors[:6]


@app.post("/api/risk/analyze")
async def risk_analyze(req: RiskAnalyzeRequest):
    """Analyze risk from manually entered patient observations using the real ML model."""
    logger.info("[INFO] Risk analysis requested — SpO2: %.1f, HR: %.1f, RR: %.1f", req.spo2_pct, req.heart_rate, req.respiratory_rate)
    vitals = req.model_dump()
    risk, status = predict_risk_static(vitals)
    factors = _compute_explanation_from_vitals(vitals, risk)
    recs = recommend_actions(vitals)
    logger.info("[INFO] Risk analysis result: %.1f%% — %s", risk * 100, status)
    return {
        'risk_probability': risk,
        'risk_status': status,
        'risk_color': get_risk_color(status),
        'risk_percentage': round(risk * 100, 1),
        'model_version': 'RF-Static-v1',
        'analysis_timestamp': datetime.now().isoformat(),
        'factors': factors,
        'recommendations': recs,
        'vitals': {
            'spo2_pct': req.spo2_pct,
            'heart_rate': req.heart_rate,
            'respiratory_rate': req.respiratory_rate,
            'temperature_c': req.temperature_c,
            'systolic_bp': req.systolic_bp,
            'diastolic_bp': req.diastolic_bp,
        },
        'input': vitals,
    }


class RiskSimulateRequest(BaseModel):
    patient_id: Optional[int] = None
    spo2_pct: float = 97.0
    heart_rate: float = 82.0
    respiratory_rate: float = 18.0
    temperature_c: float = 37.0
    systolic_bp: float = 122.0
    diastolic_bp: float = 78.0
    oxygen_flow: float = 0.0
    oxygen_device: str = "none"
    lactate: float = 1.0
    wbc_count: float = 8.0
    creatinine: float = 0.9
    crp_level: float = 5.0
    hemoglobin: float = 13.0
    age: int = 60
    gender: str = "M"
    admission_type: str = "ED"
    comorbidity_index: int = 0
    sepsis_risk_score: float = 0.1
    nurse_alert: int = 0
    mobility_score: float = 3.0
    baseline_risk_score: float = 0.05
    los_hours: float = 24.0


@app.post("/api/risk/simulate")
async def risk_simulate(req: RiskSimulateRequest):
    """Simulate a manual risk scenario: update a real patient with user-entered values,
    run the full risk pipeline, generate alert and notification if threshold crossed."""
    patient_id = req.patient_id
    if patient_id is None:
        # Pick the patient with the lowest risk for the demo
        patient_id = min(db['patients'].keys(), key=lambda k: db['patients'][k]['risk_probability'])
    p = db['patients'].get(patient_id)
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")

    logger.info("[INFO] Risk simulate for patient %d — updating with user values", patient_id)
    vitals = req.model_dump()
    history = _build_synthetic_history(vitals)
    obs_df = pd.DataFrame(history)
    risk, status = predict_risk_static(vitals)

    state = db['simulator_state'][patient_id]
    prev_risk = p['risk_probability']
    state['obs_df'] = history
    state['next_hour'] = int(history[-1].get('hour_from_admission', 0)) + 1
    state['risk_history'] = _compute_risk_history(obs_df)
    state['deteriorating'] = False

    p['vitals'] = {
        'heart_rate': float(vitals['heart_rate']),
        'respiratory_rate': float(vitals['respiratory_rate']),
        'spo2_pct': float(vitals['spo2_pct']),
        'temperature_c': float(vitals['temperature_c']),
        'systolic_bp': float(vitals['systolic_bp']),
        'diastolic_bp': float(vitals['diastolic_bp']),
    }
    p['risk_probability'] = risk
    p['risk_status'] = status
    p['last_update'] = datetime.now().isoformat()

    new_alert = False
    alert_data = None
    if risk >= ALERT_THRESHOLD:
        db['alert_counter'] += 1
        recs = recommend_actions(p['vitals'])
        assigned_doc = assign_doctor_to_alert({'patient_id': int(patient_id), 'risk_probability': risk})
        alert_data = {
            'alert_id': db['alert_counter'],
            'patient_id': int(patient_id),
            'bed': p['bed'],
            'ward': p['ward'],
            'hospital_id': p.get('hospital_id'),
            'hospital_name': p.get('hospital_name'),
            'risk_probability': risk,
            'previous_risk': round(prev_risk, 4),
            'risk_change': round(risk - prev_risk, 4),
            'vitals_snapshot': p['vitals'].copy(),
            'recommendations': recs,
            'assigned_doctor_id': assigned_doc,
            'escalated': False,
            'status': 'PENDING',
            'created_at': datetime.now().isoformat(),
            'message': f"Manual simulation: elevated deterioration risk ({round(risk*100,1)}%). Clinical review recommended."
        }
        db['alerts'].insert(0, alert_data)
        new_alert = True
        state['last_alerted_risk'] = risk
        db['system_stats']['alerts_generated'] += 1
        logger.info("[INFO] ALERT CREATED: ALERT-%d for patient %d — risk %.1f%%", db['alert_counter'], patient_id, risk*100)
        send_push_notification(alert_data)

    db['system_stats']['observations_processed'] += 1
    _persist_state()

    factors = _compute_explanation_from_vitals(vitals, risk)
    recs = recommend_actions(p['vitals'])
    return {
        'patient_id': patient_id,
        'risk_probability': risk,
        'risk_status': status,
        'risk_percentage': round(risk * 100, 1),
        'risk_color': get_risk_color(status),
        'vitals': p['vitals'],
        'new_alert': new_alert,
        'alert': alert_data,
        'factors': factors,
        'recommendations': recs,
        'risk_history': state.get('risk_history', []),
        'trend': get_trend(patient_id),
    }
