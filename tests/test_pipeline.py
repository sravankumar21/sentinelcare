import os
import sys
import pytest
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from ml.feature_engineering import add_temporal_features, get_feature_columns
from ml.data_processing import TARGET, LEAKAGE_COLUMNS


@pytest.fixture(scope='module')
def sample_df():
    df = pd.DataFrame({
        'patient_id': [1, 1, 1, 2, 2, 2],
        'hour_from_admission': [0, 1, 2, 0, 1, 2],
        'heart_rate': [80, 82, 85, 70, 75, 90],
        'respiratory_rate': [16, 17, 18, 14, 15, 20],
        'spo2_pct': [97, 96, 95, 98, 97, 91],
        'temperature_c': [37.0, 37.1, 37.2, 36.8, 36.9, 38.0],
        'systolic_bp': [120, 118, 115, 110, 108, 95],
        'diastolic_bp': [80, 79, 78, 70, 68, 60],
        'oxygen_device': ['none', 'none', 'none', 'none', 'none', 'hfnc'],
        'oxygen_flow': [0, 0, 0, 0, 0, 2],
        'mobility_score': [3, 3, 2, 2, 2, 1],
        'nurse_alert': [0, 0, 0, 0, 0, 1],
        'age': [60, 60, 60, 72, 72, 72],
        'gender': ['M', 'M', 'M', 'F', 'F', 'F'],
        'comorbidity_index': [2, 2, 2, 4, 4, 4],
        'admission_type': ['Elective', 'Elective', 'Elective', 'ED', 'ED', 'ED'],
        'baseline_risk_score': [0.2, 0.2, 0.2, 0.3, 0.3, 0.3],
        'los_hours': [24, 24, 24, 48, 48, 48],
        'wbc_count': [6, 6.5, 7, 8, 9, 12],
        'lactate': [1.2, 1.3, 1.5, 2, 2.5, 4],
        'creatinine': [1.0, 1.0, 1.1, 1.2, 1.3, 1.5],
        'crp_level': [10, 12, 15, 20, 30, 80],
        'hemoglobin': [13, 13, 12.5, 11, 11, 10],
        'sepsis_risk_score': [0.2, 0.2, 0.25, 0.3, 0.4, 0.7],
    })
    return df


class TestFeatureEngineering:
    def test_adds_temporal_features(self, sample_df):
        out = add_temporal_features(sample_df)
        assert 'heart_rate_chg1h' in out.columns
        assert 'spo2_pct_roll3_mean' in out.columns
        assert out.shape[0] == len(sample_df)

    def test_no_future_leakage(self, sample_df):
        out = add_temporal_features(sample_df)
        # For patient 1, chg1h at hour 2 must equal hour2 - hour1, never using
        # future hours. The chg feature only depends on the current and previous
        # hour (a shift of 1), so it cannot see future information.
        p1 = out[out['patient_id'] == 1].sort_values('hour_from_admission')
        assert p1['heart_rate_chg1h'].iloc[1] == 82 - 80
        assert p1['heart_rate_chg1h'].iloc[2] == 85 - 82

    def test_get_feature_columns_no_leakage(self):
        cols = get_feature_columns()
        for leak in LEAKAGE_COLUMNS + [TARGET, 'hour_from_admission']:
            assert leak not in cols, f"Leakage column {leak} in features!"

    def test_groupby_ordering(self, sample_df):
        out = add_temporal_features(sample_df)
        # Verify patient 1 hour 1 eval uses only prior data
        p1 = out[out['patient_id'] == 1].sort_values('hour_from_admission')
        assert p1['heart_rate_chg1h'].iloc[1] == 82 - 80
        assert p1['heart_rate_chg1h'].iloc[2] == 85 - 82


class TestTarget:
    def test_target_binary(self):
        df = pd.read_parquet('data/cleaned.parquet')
        assert set(df[TARGET].unique()) <= {0, 1}
        assert df[TARGET].mean() > 0.01


class TestRiskClassification:
    def test_risk_thresholds(self):
        sys.path.insert(0, 'backend')
        from app import get_risk_status
        assert get_risk_status(0.10) == 'STABLE'
        assert get_risk_status(0.30) == 'WATCH'
        assert get_risk_status(0.60) == 'HIGH'
        assert get_risk_status(0.90) == 'CRITICAL'
