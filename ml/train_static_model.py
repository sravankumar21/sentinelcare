"""SentinelCare - Static (point-in-time) risk model training.

Trains a RandomForest on cleaned.parquet where each row is a single patient
observation (no temporal window), predicting deterioration_next_12h from the
22 core vitals/labs/context features. This model powers the Test Risk Analyzer
and the simulator's deterioration frequency, so it must respond monotonically
to the in-distribution multi-system deterioration signature learned from real
deteriorated patients.

Saves: best_model_static.pkl, static_feature_columns.json, static_model_results.json
"""
import json
import os
import pickle
import time

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score, average_precision_score
from sklearn.model_selection import train_test_split

MODELS_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'models')

STATIC_FEATURES = [
    'heart_rate', 'respiratory_rate', 'spo2_pct', 'temperature_c',
    'systolic_bp', 'diastolic_bp', 'oxygen_flow', 'mobility_score',
    'nurse_alert', 'wbc_count', 'lactate', 'creatinine', 'crp_level',
    'hemoglobin', 'sepsis_risk_score', 'age', 'comorbidity_index',
    'baseline_risk_score', 'los_hours',
    'oxygen_device_enc', 'gender_enc', 'admission_type_enc',
]

OXYGEN_ENC = {'none': 0, 'nasal': 1, 'hfnc': 2, 'mask': 3, 'niv': 4}
GENDER_ENC = {'M': 0, 'F': 1}
ADMISSION_ENC = {'Elective': 0, 'ED': 1, 'Transfer': 2}
TARGET = 'deterioration_next_12h'


def load_and_prepare():
    df = pd.read_parquet('data/cleaned.parquet')
    df['oxygen_device_enc'] = df['oxygen_device'].map(OXYGEN_ENC).fillna(0).astype(int)
    df['gender_enc'] = df['gender'].map(GENDER_ENC).fillna(0).astype(int)
    df['admission_type_enc'] = df['admission_type'].map(ADMISSION_ENC).fillna(0).astype(int)
    X = df[STATIC_FEATURES].copy()
    X = X.fillna(0)
    X = X.replace([np.inf, -np.inf], 0)
    y = df[TARGET].astype(int)
    return X, y


def main():
    X, y = load_and_prepare()
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.3, stratify=y, random_state=1)

    t0 = time.time()
    model = RandomForestClassifier(
        n_estimators=300,
        min_samples_leaf=2,
        max_features='sqrt',
        n_jobs=-1,
        random_state=1,
    )
    model.fit(Xtr, ytr)
    elapsed = time.time() - t0

    tr_p = model.predict_proba(Xtr)[:, 1]
    te_p = model.predict_proba(Xte)[:, 1]

    results = {
        'model': 'RandomForest-Static-v2',
        'trained_at': pd.Timestamp.now().isoformat(),
        'train_rows': int(len(Xtr)),
        'test_rows': int(len(Xte)),
        'target_rate': float(y.mean()),
        'train_time_s': round(elapsed, 1),
        'train_auc': round(float(roc_auc_score(ytr, tr_p)), 4),
        'test_auc': round(float(roc_auc_score(yte, te_p)), 4),
        'train_aps': round(float(average_precision_score(ytr, tr_p)), 4),
        'test_aps': round(float(average_precision_score(yte, te_p)), 4),
        'test_max_prob': round(float(te_p.max()), 4),
        'n_estimators': model.n_estimators,
    }

    os.makedirs(MODELS_DIR, exist_ok=True)
    with open(os.path.join(MODELS_DIR, 'best_model_static.pkl'), 'wb') as f:
        pickle.dump(model, f, protocol=4)
    with open(os.path.join(MODELS_DIR, 'static_feature_columns.json'), 'w') as f:
        json.dump(STATIC_FEATURES, f, indent=2)
    with open(os.path.join(MODELS_DIR, 'static_model_results.json'), 'w') as f:
        json.dump(results, f, indent=2)

    print(json.dumps(results, indent=2))
    print('test rows >0.5: %d (%.2f%%)' % ((te_p > 0.5).sum(), (te_p > 0.5).mean() * 100))
    print('saved best_model_static.pkl (%.1f MB)' % (os.path.getsize(os.path.join(MODELS_DIR, 'best_model_static.pkl')) / 1e6))


if __name__ == '__main__':
    main()