"""SentinelCare - Time-Series Feature Engineering"""
import pandas as pd
import numpy as np
from ml.data_processing import VITAL_SIGNALS, LAB_VALUES, NUMERIC_FEATURES, CATEGORICAL_FEATURES, TARGET


def add_temporal_features(df):
    df = df.sort_values(['patient_id', 'hour_from_admission']).copy()
    groups = df.groupby('patient_id')

    for col in VITAL_SIGNALS + ['oxygen_flow', 'lactate', 'wbc_count', 'creatinine', 'crp_level', 'hemoglobin']:
        df[f'{col}_prev1'] = groups[col].shift(1)
        df[f'{col}_chg1h'] = df[col] - df[f'{col}_prev1']
        df[f'{col}_chg3h'] = df[col] - groups[col].shift(3)
        df[f'{col}_roll3_mean'] = groups[col].transform(lambda x: x.rolling(3, min_periods=1).mean())
        df[f'{col}_roll3_std'] = groups[col].transform(lambda x: x.rolling(3, min_periods=1).std())
        df[f'{col}_roll6_mean'] = groups[col].transform(lambda x: x.rolling(6, min_periods=1).mean())
        df[f'{col}_roll6_min'] = groups[col].transform(lambda x: x.rolling(6, min_periods=1).min())
        df[f'{col}_roll6_max'] = groups[col].transform(lambda x: x.rolling(6, min_periods=1).max())
        df[f'{col}_slope3'] = groups[col].transform(lambda x: x.rolling(3, min_periods=2).apply(
            lambda w: np.polyfit(range(len(w)), w, 1)[0] if len(w) > 1 else 0, raw=True))

    for col in ['nurse_alert', 'mobility_score']:
        df[f'{col}_roll3_mean'] = groups[col].transform(lambda x: x.rolling(3, min_periods=1).mean())
        df[f'{col}_roll6_mean'] = groups[col].transform(lambda x: x.rolling(6, min_periods=1).mean())

    df['hour_from_admission'] = groups['hour_from_admission'].cumcount()

    df['spo2_hr_ratio'] = df['spo2_pct'] / (df['heart_rate'] + 1)
    df['bp_systolic_diastolic_diff'] = df['systolic_bp'] - df['diastolic_bp']
    df['map'] = df['diastolic_bp'] + (df['systolic_bp'] - df['diastolic_bp']) / 3
    df['map_prev1'] = groups['map'].shift(1)
    df['map_chg1h'] = df['map'] - df['map_prev1']
    df['respiratory_spo2_ratio'] = df['respiratory_rate'] / (df['spo2_pct'] + 1)
    df['hr_resp_ratio'] = df['heart_rate'] / (df['respiratory_rate'] + 1)
    df['temp_deviation'] = np.abs(df['temperature_c'] - 37.0)

    oxygen_map = {'none': 0, 'nasal': 1, 'hfnc': 2, 'mask': 3, 'niv': 4}
    df['oxygen_device_encoded'] = df['oxygen_device'].map(oxygen_map).fillna(0).astype(int)
    gender_map = {'M': 0, 'F': 1}
    df['gender_encoded'] = df['gender'].map(gender_map).fillna(0).astype(int)
    admission_map = {'Elective': 0, 'ED': 1, 'Transfer': 2}
    df['admission_type_encoded'] = df['admission_type'].map(admission_map).fillna(0).astype(int)

    return df


def get_feature_columns():
    temporal_cols = []
    for col in VITAL_SIGNALS + ['oxygen_flow', 'lactate', 'wbc_count', 'creatinine', 'crp_level', 'hemoglobin']:
        temporal_cols.extend([
            f'{col}_prev1', f'{col}_chg1h', f'{col}_chg3h',
            f'{col}_roll3_mean', f'{col}_roll3_std',
            f'{col}_roll6_mean', f'{col}_roll6_min', f'{col}_roll6_max',
            f'{col}_slope3'
        ])
    for col in ['nurse_alert', 'mobility_score']:
        temporal_cols.extend([f'{col}_roll3_mean', f'{col}_roll6_mean'])

    base_cols = VITAL_SIGNALS + ['oxygen_flow', 'sepsis_risk_score', 'age',
                                   'comorbidity_index', 'baseline_risk_score', 'los_hours']
    derived_cols = ['spo2_hr_ratio', 'bp_systolic_diastolic_diff', 'map', 'map_chg1h',
                     'respiratory_spo2_ratio', 'hr_resp_ratio', 'temp_deviation']
    encoded_cols = ['oxygen_device_encoded', 'gender_encoded', 'admission_type_encoded']

    return base_cols + temporal_cols + derived_cols + encoded_cols


if __name__ == '__main__':
    df = pd.read_parquet('data/cleaned.parquet')
    print(f"Input shape: {df.shape}")
    df = add_temporal_features(df)
    print(f"Output shape: {df.shape}")
    feature_cols = get_feature_columns()
    print(f"Feature count: {len(feature_cols)}")
    df.to_parquet('data/engineered.parquet', index=False)
    print("Saved engineered.parquet")
