"""SentinelCare - Data Loading, Cleaning, and Leakage-Safe Splitting"""
import pandas as pd
import numpy as np
import os
import json

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'dataset.parquet')
PROCESSED_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')

LEAKAGE_COLUMNS = [
    'deterioration_event',
    'deterioration_within_12h_from_admission',
    'deterioration_hour'
]

TARGET = 'deterioration_next_12h'

VITAL_SIGNALS = ['heart_rate', 'respiratory_rate', 'spo2_pct', 'temperature_c', 'systolic_bp', 'diastolic_bp']
LAB_VALUES = ['wbc_count', 'lactate', 'creatinine', 'crp_level', 'hemoglobin']
NUMERIC_FEATURES = VITAL_SIGNALS + LAB_VALUES + ['oxygen_flow', 'mobility_score', 'nurse_alert',
                                                    'sepsis_risk_score', 'age', 'comorbidity_index',
                                                    'baseline_risk_score', 'los_hours']
CATEGORICAL_FEATURES = ['oxygen_device', 'gender', 'admission_type']


def load_raw():
    df = pd.read_parquet(DATA_PATH)
    return df


def clean(df):
    # The dataset contains duplicate interleaved observations. Rows with a
    # populated target also carry the full vitals; duplicate copies have NaN
    # target but identical vitals. Keep the rows with the target populated.
    df = df.dropna(subset=['deterioration_next_12h'])
    df = df.dropna(subset=['patient_id'])
    df = df[df['heart_rate'].notna()]
    df = df.drop_duplicates(subset=['patient_id', 'hour_from_admission'], keep='last')
    df = df.sort_values(['patient_id', 'hour_from_admission']).reset_index(drop=True)
    df['patient_id'] = df['patient_id'].astype(int)
    df['hour_from_admission'] = df['hour_from_admission'].astype(int)
    for col in NUMERIC_FEATURES:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    return df


def split_patients(df, train_ratio=0.70, val_ratio=0.15, seed=42):
    patients = df['patient_id'].unique()
    rng = np.random.RandomState(seed)
    rng.shuffle(patients)
    n = len(patients)
    n_train = int(n * train_ratio)
    n_val = int(n * val_ratio)
    train_pids = set(patients[:n_train])
    val_pids = set(patients[n_train:n_train + n_val])
    test_pids = set(patients[n_train + n_val:])
    return train_pids, val_pids, test_pids


def compute_patient_level_stats(df):
    stats = df.groupby('patient_id').agg(
        total_hours=('hour_from_admission', 'max'),
        ever_deteriorated=(TARGET, 'max'),
        n_observations=(TARGET, 'count')
    ).reset_index()
    return stats


if __name__ == '__main__':
    print("Loading raw data...")
    df = load_raw()
    print(f"Raw shape: {df.shape}")

    print("Cleaning...")
    df = clean(df)
    print(f"Clean shape: {df.shape}")

    print(f"Unique patients: {df['patient_id'].nunique()}")
    print(f"Target distribution:\n{df[TARGET].value_counts()}")
    print(f"Positive rate: {df[TARGET].mean():.4f}")

    train_pids, val_pids, test_pids = split_patients(df)
    print(f"\nSplit: train={len(train_pids)}, val={len(val_pids)}, test={len(test_pids)}")

    df.to_parquet(os.path.join(PROCESSED_DIR, 'cleaned.parquet'), index=False)
    print("Saved cleaned.parquet")

    split_info = {
        'train': [int(p) for p in train_pids],
        'val': [int(p) for p in val_pids],
        'test': [int(p) for p in test_pids]
    }
    with open(os.path.join(PROCESSED_DIR, 'patient_splits.json'), 'w') as f:
        json.dump(split_info, f)
    print("Saved patient_splits.json")
