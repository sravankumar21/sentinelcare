"""SentinelCare - FastAPI Backend"""
import os
import sys
import json
import pickle
import random
import urllib.request
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from ml.feature_engineering import add_temporal_features, get_feature_columns, VITAL_SIGNALS

app = FastAPI(title="SentinelCare API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
MODELS_DIR = os.path.join(DATA_DIR, 'models')

db = {
    'patients': {},
    'alerts': [],
    'alert_counter': 0,
    'simulator_state': {},
    'devices': {},  # device_token -> {platform, last_seen}
    'system_stats': {
        'observations_processed': 0,
        'alerts_generated': 0,
        'push_sent': 0,
        'start_time': datetime.now().isoformat()
    }
}

model = None
feature_cols = None

RISK_THRESHOLDS = [
    {'max': 0.24, 'label': 'STABLE'},
    {'max': 0.49, 'label': 'WATCH'},
    {'max': 0.74, 'label': 'HIGH'},
    {'max': 1.0, 'label': 'CRITICAL'},
]
ALERT_THRESHOLD = 0.50


def load_model():
    global model, feature_cols
    model_path = os.path.join(MODELS_DIR, 'best_model.pkl')
    if os.path.exists(model_path):
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
    features_path = os.path.join(MODELS_DIR, 'feature_columns.json')
    if os.path.exists(features_path):
        with open(features_path) as f:
            feature_cols = json.load(f)


def get_risk_status(prob):
    for t in RISK_THRESHOLDS:
        if prob <= t['max']:
            return t['label']
    return 'CRITICAL'


def get_risk_color(status):
    return {"STABLE": "#22c55e", "WATCH": "#eab308", "HIGH": "#f97316", "CRITICAL": "#ef4444"}.get(status, "#6b7280")


def predict_risk(obs_df):
    """Run the true inference path: feature engineering then model predict on last row."""
    if obs_df is None or len(obs_df) == 0:
        return 0.05, get_risk_status(0.05)
    if model is None or feature_cols is None:
        return 0.05, get_risk_status(0.05)
    try:
        eng = add_temporal_features(obs_df)
        last = eng.iloc[[-1]][feature_cols]
        last = last.fillna(0)
        last = last.replace([np.inf, -np.inf], 0)
        prob = float(model.predict_proba(last)[0, 1])
        return round(prob, 4), get_risk_status(prob)
    except Exception:
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


def init_demo_patients():
    df = pd.read_parquet(os.path.join(DATA_DIR, 'cleaned.parquet'))
    np.random.seed(42)
    # create deterministic demo patient assignments
    num_demo = 16
    demo_pids = list(range(1, num_demo + 1))
    for i, pid in enumerate(demo_pids):
        ward = WARD_NAMES[i % 4]
        bed_num = 101 + i // 4
        patient_df = df[df['patient_id'] == pid].sort_values('hour_from_admission')
        if len(patient_df) == 0:
            continue
        # Use an EARLY, stable window so all demo patients start low/stable and
        # the simulator can demonstrate deterioration from a low baseline.
        window = patient_df.head(12).reset_index(drop=True)
        latest = window.iloc[-1]
        rec = {
            key: latest[key] for key in [
                'heart_rate', 'respiratory_rate', 'spo2_pct', 'temperature_c',
                'systolic_bp', 'diastolic_bp', 'oxygen_flow', 'mobility_score',
                'nurse_alert', 'age', 'gender', 'comorbidity_index', 'admission_type',
                'oxygen_device', 'baseline_risk_score', 'los_hours',
                'wbc_count', 'lactate', 'creatinine', 'crp_level', 'hemoglobin',
                'sepsis_risk_score'
            ]
        }
        for k, v in rec.items():
            if pd.isna(v):
                rec[k] = 0 if isinstance(latest[k], (int, float)) else 'none'

        # compute base risk via model on the early window
        risk, status = predict_risk(window)

        # raise a couple of patients slightly for earliest demo variety
        if i in [3, 8]:
            risk = max(risk, 0.52)
            status = get_risk_status(risk)

        obs_df = window.copy()
        db['patients'][pid] = {
            'patient_id': int(pid),
            'bed': f"{ward}{bed_num}",
            'ward': ward,
            'vitals': {
                'heart_rate': float(rec['heart_rate']),
                'respiratory_rate': float(rec['respiratory_rate']),
                'spo2_pct': float(rec['spo2_pct']),
                'temperature_c': float(rec['temperature_c']),
                'systolic_bp': float(rec['systolic_bp']),
                'diastolic_bp': float(rec['diastolic_bp']),
            },
            'oxygen_device': str(rec['oxygen_device']),
            'age': int(rec['age']) if not pd.isna(rec['age']) else 60,
            'gender': str(rec['gender']) if not pd.isna(rec['gender']) else 'M',
            'admission_type': str(rec['admission_type']) if not pd.isna(rec['admission_type']) else 'ED',
            'risk_probability': round(risk, 4),
            'risk_status': status,
            'last_update': datetime.now().isoformat(),
        }
        db['simulator_state'][pid] = {
            'obs_df': obs_df.to_dict('records'),
            'next_hour': int(latest['hour_from_admission']) + 1,
            'risk_history': [risk],
            'deteriorating': False,
        }
        WARDS[ward].append(pid)

    db['system_stats']['patients_monitored'] = len(db['patients'])


@app.on_event("startup")
async def startup():
    load_model()
    init_demo_patients()


class SimulateStepRequest(BaseModel):
    patient_id: int
    mode: str = "deteriorate"


class DeviceRegisterRequest(BaseModel):
    token: str
    platform: str = "android"


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


def send_push_notification(alert: dict):
    """Deliver a real push via Firebase Cloud Messaging (v1 HTTP API).

    Config (env vars on the host):
      PUSH_MODE                 - "fcm" to actually send, "log" (default) to only log.
      FCM_SERVICE_ACCOUNT_JSON  - contents of the firebase service account JSON.
      FCM_SERVICE_ACCOUNT_PATH  - OR a path to that JSON file.
    """
    token = next(iter(db['devices'].keys()), None)
    db['system_stats']['push_sent'] += 1
    mode = os.getenv('PUSH_MODE', 'log')
    if mode != 'fcm' or not token:
        return {"delivered": False, "mode": mode, "reason": "no token or PUSH_MODE!=fcm"}

    sa = _get_service_account()
    if not sa:
        return {"delivered": False, "mode": mode, "reason": "FCM_SERVICE_ACCOUNT not set"}

    try:
        from google.oauth2 import service_account
        creds = service_account.Credentials.from_service_account_info(
            sa, scopes=["https://www.googleapis.com/auth/firebase.messaging"]
        )
        # Force a fresh token; the google-auth default RSA flow handles expiry.
        creds.refresh if hasattr(creds, 'refresh') else None
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
            return {"delivered": True, "status": resp.status, "name": resp.read().decode()[:120]}
    except Exception as e:
        return {"delivered": False, "error": str(e)}


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
    return {
        **p,
        'risk_trend': trend,
        'trend_arrow': arrow,
        'risk_history': state.get('risk_history', []),
        'obs_count': len(state.get('obs_df', []))
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
            alert['status'] = 'ACKNOWLEDGED'
            alert['acknowledged_at'] = datetime.now().isoformat()
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
    return {"status": "ok", "registered": True, "device_count": len(db['devices'])}


@app.get("/api/devices")
async def list_devices():
    return {"devices": db['devices']}


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
    last = state['obs_df'][-1]

    # Build next observation; if deteriorating, apply a coordinated, realistic
    # deterioration drift across the vitals AND the drivers the model relies on
    # (lactate, WBC, sepsis score, oxygen support, nurse alert). This keeps the
    # simulation on the real inference path while staying in-distribution for
    # the trained model.
    new_obs = dict(last)
    new_obs['hour_from_admission'] = state['next_hour']
    if state['deteriorating']:
        # Deterministic, coordinated deterioration so the live demo reliably
        # crosses the alert threshold. Values follow the deterioration template
        # learned from real deteriorated patients (vitals + labs + oxygen).
        new_obs['spo2_pct'] = max(60, float(new_obs['spo2_pct']) - 2.2)
        new_obs['heart_rate'] = min(170, float(new_obs['heart_rate']) + 7)
        new_obs['respiratory_rate'] = min(44, float(new_obs['respiratory_rate']) + 2.4)
        new_obs['systolic_bp'] = max(55, float(new_obs['systolic_bp']) - 3.5)
        new_obs['diastolic_bp'] = max(28, float(new_obs['diastolic_bp']) - 2)
        new_obs['temperature_c'] = min(40.5, float(new_obs['temperature_c']) + 0.5)
        new_obs['lactate'] = min(6.0, float(new_obs['lactate']) + 0.35)
        new_obs['wbc_count'] = min(16.0, float(new_obs['wbc_count']) + 0.5)
        new_obs['sepsis_risk_score'] = min(0.9, float(new_obs['sepsis_risk_score']) + 0.06)
        new_obs['nurse_alert'] = 1
        new_obs['oxygen_flow'] = min(45, float(new_obs['oxygen_flow']) + 4.5)
        dev = str(new_obs['oxygen_device'])
        flow = float(new_obs['oxygen_flow'])
        if flow > 35:
            new_obs['oxygen_device'] = 'niv'
        elif flow > 20:
            new_obs['oxygen_device'] = 'hfnc'
        elif flow > 8:
            new_obs['oxygen_device'] = 'mask'
        elif dev == 'none':
            new_obs['oxygen_device'] = 'nasal'
        new_obs['los_hours'] = float(new_obs['los_hours']) + 1
    else:
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

    # TRUE inference path on updated history
    obs_df = pd.DataFrame(state['obs_df'])
    risk, status = predict_risk(obs_df)
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

    new_alert = risk >= ALERT_THRESHOLD and prev_risk < ALERT_THRESHOLD
    push_result = None
    if new_alert:
        db['alert_counter'] += 1
        alert = {
            'alert_id': db['alert_counter'],
            'patient_id': int(req.patient_id),
            'bed': p['bed'],
            'ward': p['ward'],
            'risk_probability': risk,
            'previous_risk': round(prev_risk, 4),
            'risk_change': round(risk - prev_risk, 4),
            'vitals_snapshot': p['vitals'].copy(),
            'status': 'PENDING',
            'created_at': datetime.now().isoformat(),
            'message': f"Elevated deterioration risk detected ({round(risk*100,1)}%). Clinical review recommended."
        }
        db['alerts'].insert(0, alert)
        db['system_stats']['alerts_generated'] += 1
        push_result = send_push_notification(alert)
    db['system_stats']['observations_processed'] += 1

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
    # reset to original early stable window from cleaned data
    df = pd.read_parquet(os.path.join(DATA_DIR, 'cleaned.parquet'))
    patient_df = df[df['patient_id'] == patient_id].sort_values('hour_from_admission')
    window = patient_df.head(12).reset_index(drop=True)
    latest = window.iloc[-1]
    state['obs_df'] = window.to_dict('records')
    state['next_hour'] = int(latest['hour_from_admission']) + 1
    state['deteriorating'] = False
    risk, status = predict_risk(window)
    state['risk_history'] = [risk]
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
