"""SentinelCare - Model Training, Evaluation, and Comparison"""
import pandas as pd
import numpy as np
import json
import os
import pickle
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (precision_score, recall_score, f1_score, roc_auc_score,
                              average_precision_score, confusion_matrix, precision_recall_curve,
                              roc_curve, classification_report)
from sklearn.calibration import calibration_curve, CalibratedClassifierCV
from ml.feature_engineering import add_temporal_features, get_feature_columns
from ml.data_processing import TARGET

MODELS_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'models')
os.makedirs(MODELS_DIR, exist_ok=True)


def load_split_data():
    df = pd.read_parquet('data/engineered.parquet')
    with open('data/patient_splits.json') as f:
        splits = json.load(f)
    train_pids = set(splits['train'])
    val_pids = set(splits['val'])
    test_pids = set(splits['test'])
    feature_cols = get_feature_columns()
    train_df = df[df['patient_id'].isin(train_pids)].copy()
    val_df = df[df['patient_id'].isin(val_pids)].copy()
    test_df = df[df['patient_id'].isin(test_pids)].copy()
    return train_df, val_df, test_df, feature_cols


def prepare_xy(df, feature_cols):
    X = df[feature_cols].copy()
    y = df[TARGET].copy()
    X = X.fillna(0)
    inf_cols = X.columns[np.isinf(X.any())]
    for c in inf_cols:
        X[c] = 0
    return X, y


def compute_alert_lead_time(df_test, threshold=0.75):
    results = []
    for pid, grp in df_test.groupby('patient_id'):
        grp = grp.sort_values('hour_from_admission')
        if grp[TARGET].sum() == 0:
            continue
        det_rows = grp[grp[TARGET] == 1]
        first_det_hour = det_rows['hour_from_admission'].min()
        pred_hours = grp[grp['risk_probability'] >= threshold]['hour_from_admission'].values
        total_det = int(det_rows['hour_from_admission'].nunique())
        if len(pred_hours) > 0:
            first_alert = pred_hours[0]
            lead = first_det_hour - first_alert
            results.append({'patient_id': pid, 'lead_time_hours': int(lead),
                           'first_alert_hour': int(first_alert), 'first_deterioration_hour': int(first_det_hour),
                           'total_deteriorated': total_det})
        else:
            results.append({'patient_id': pid, 'lead_time_hours': None,
                           'first_alert_hour': None, 'first_deterioration_hour': int(first_det_hour),
                           'total_deteriorated': total_det, 'missed_alert': True})
    return pd.DataFrame(results)


def train_models(train_df, val_df, feature_cols):
    X_train, y_train = prepare_xy(train_df, feature_cols)
    X_val, y_val = prepare_xy(val_df, feature_cols)

    models = {
        'LogisticRegression': LogisticRegression(max_iter=1000, class_weight='balanced', random_state=42),
        'RandomForest': RandomForestClassifier(n_estimators=200, max_depth=12, class_weight='balanced',
                                                random_state=42, n_jobs=-1),
    }

    results = {}
    trained = {}
    for name, model in models.items():
        print(f"Training {name}...")
        model.fit(X_train, y_train)
        y_prob = model.predict_proba(X_val)[:, 1]
        y_pred = (y_prob >= 0.5).astype(int)
        results[name] = {
            'precision': float(precision_score(y_val, y_pred)),
            'recall': float(recall_score(y_val, y_pred)),
            'f1': float(f1_score(y_val, y_pred)),
            'roc_auc': float(roc_auc_score(y_val, y_prob)),
            'pr_auc': float(average_precision_score(y_val, y_prob)),
            'confusion_matrix': confusion_matrix(y_val, y_pred).tolist()
        }
        trained[name] = model
        print(f"  ROC-AUC: {results[name]['roc_auc']:.4f}, PR-AUC: {results[name]['pr_auc']:.4f}")

    best_name = max(results, key=lambda k: results[k]['roc_auc'])
    print(f"\nBest model: {best_name} (ROC-AUC: {results[best_name]['roc_auc']:.4f})")

    # Calibrate the best model's probabilities on the validation set so that
    # the output spans the full [0,1] range meaningfully. Probabilistic
    # calibration does not change ranking (AUC is unchanged) but makes the
    # probability bands (STABLE/WATCH/HIGH/CRITICAL) and alert thresholds
    # interpretable, which is important for an early-warning product.
    best_raw = trained[best_name]
    calibrated = CalibratedClassifierCV(best_raw, method='sigmoid', cv='prefit')
    calibrated.fit(X_val, y_val)
    best_model = calibrated

    with open(os.path.join(MODELS_DIR, 'best_model.pkl'), 'wb') as f:
        pickle.dump(best_model, f)
    with open(os.path.join(MODELS_DIR, 'model_results.json'), 'w') as f:
        json.dump(results, f, indent=2)
    with open(os.path.join(MODELS_DIR, 'feature_columns.json'), 'w') as f:
        json.dump(feature_cols, f)

    return best_model, best_name, results


def evaluate_on_test(model, test_df, feature_cols):
    X_test, y_test = prepare_xy(test_df, feature_cols)
    y_prob = model.predict_proba(X_test)[:, 1]
    y_pred = (y_prob >= 0.5).astype(int)

    test_df = test_df.copy()
    test_df['risk_probability'] = y_prob
    test_df['risk_predicted'] = y_pred

    results = {
        'precision': float(precision_score(y_test, y_pred)),
        'recall': float(recall_score(y_test, y_pred)),
        'f1': float(f1_score(y_test, y_pred)),
        'roc_auc': float(roc_auc_score(y_test, y_prob)),
        'pr_auc': float(average_precision_score(y_test, y_prob)),
        'confusion_matrix': confusion_matrix(y_test, y_pred).tolist()
    }

    roc_fpr, roc_tpr, _ = roc_curve(y_test, y_prob)
    pr_prec, pr_rec, _ = precision_recall_curve(y_test, y_prob)
    cal_y, cal_x = calibration_curve(y_test, y_prob, n_bins=10)

    results['roc_curve'] = {'fpr': roc_fpr.tolist()[:200], 'tpr': roc_tpr.tolist()[:200]}
    results['pr_curve'] = {'precision': pr_prec.tolist()[:200], 'recall': pr_rec.tolist()[:200]}
    results['calibration'] = {'y_true': cal_y.tolist(), 'y_prob': cal_x.tolist()}

    lead_df = compute_alert_lead_time(test_df)
    alerts_received = lead_df[lead_df['lead_time_hours'].notna()]
    missed = lead_df[lead_df.get('missed_alert', False).fillna(False)]
    results['alert_lead_time'] = {
        'mean': float(alerts_received['lead_time_hours'].mean()) if len(alerts_received) > 0 else 0,
        'median': float(alerts_received['lead_time_hours'].median()) if len(alerts_received) > 0 else 0,
        'pct_with_positive_lead': float((alerts_received['lead_time_hours'] > 0).mean() * 100) if len(alerts_received) > 0 else 0,
        'patients_with_alerts': int(len(alerts_received)),
        'deteriorated_patients': int(len(lead_df)),
        'total_deteriorated_hours': int(lead_df['total_deteriorated'].sum()),
        'missed_alert_patients': int(len(missed)),
        'note': 'Lead time = (first hour labeled deteriorating within 12h) - (first hour risk>=threshold). Positive = early warning before deterioration window onset.'
    }

    with open(os.path.join(MODELS_DIR, 'test_results.json'), 'w') as f:
        json.dump(results, f, indent=2)

    return results


if __name__ == '__main__':
    print("Loading split data...")
    train_df, val_df, test_df, feature_cols = load_split_data()
    print(f"Train: {len(train_df)}, Val: {len(val_df)}, Test: {len(test_df)}")
    print(f"Features: {len(feature_cols)}")

    model, best_name, val_results = train_models(train_df, val_df, feature_cols)
    print(f"\nTest evaluation:")
    test_results = evaluate_on_test(model, test_df, feature_cols)
    for k in ['precision', 'recall', 'f1', 'roc_auc', 'pr_auc']:
        print(f"  {k}: {test_results[k]:.4f}")
