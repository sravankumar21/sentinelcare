"""One-time: build a real patient demo pool from the dataset.

For each patient compute the model's risk on their last 24 REAL observations
(current clinical status) and their TRUE deterioration outcome. Then select a
deterministic, meaningful mix (real high/deteriorated patients + real stable)
and save to backend/demo_pool.json so the backend seeds from real data.
"""
import os, sys, json, pickle, warnings
import numpy as np, pandas as pd
warnings.filterwarnings('ignore')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + '/..')

from ml.feature_engineering import add_temporal_features, get_feature_columns

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
MODELS = os.path.join(DATA, 'models')

df = pd.read_parquet(os.path.join(DATA, 'cleaned.parquet'))
model = pickle.load(open(os.path.join(MODELS, 'best_model.pkl'), 'rb'))
fc = json.load(open(os.path.join(MODELS, 'feature_columns.json')))

WINDOW = 24
records = []
for pid, g in df.sort_values(['patient_id', 'hour_from_admission']).groupby('patient_id'):
    g = g.reset_index(drop=True)
    if len(g) < 5:
        continue
    win = g.tail(WINDOW).reset_index(drop=True)
    try:
        eng = add_temporal_features(win)
        last = eng.iloc[[-1]][fc].fillna(0).replace([np.inf, -np.inf], 0)
        risk = float(model.predict_proba(last)[0, 1])
    except Exception:
        continue
    lastrow = g.iloc[-1]
    records.append({
        'patient_id': int(pid),
        'num_obs': int(len(g)),
        'risk': round(risk, 4),
        'label': int(lastrow['deterioration_next_12h']),
        'outcome_deteriorated_any': int(lastrow['deterioration_event']),
        'age': int(lastrow['age']) if not pd.isna(lastrow['age']) else 60,
        'gender': str(lastrow['gender']) if not pd.isna(lastrow['gender']) else 'M',
        'admission_type': str(lastrow['admission_type']) if not pd.isna(lastrow['admission_type']) else 'ED',
        'comorbidity_index': int(lastrow['comorbidity_index']) if not pd.isna(lastrow['comorbidity_index']) else 0,
        'ward': None,
        'bed': None,
        'vitals': {
            'heart_rate': float(lastrow['heart_rate']),
            'respiratory_rate': float(lastrow['respiratory_rate']),
            'spo2_pct': float(lastrow['spo2_pct']),
            'temperature_c': float(lastrow['temperature_c']),
            'systolic_bp': float(lastrow['systolic_bp']),
            'diastolic_bp': float(lastrow['diastolic_bp']),
            'oxygen_device': str(lastrow['oxygen_device']),
            'oxygen_flow': float(lastrow['oxygen_flow']),
        },
        # snapshot for the simulator's real inference baseline
        'window': win.drop(columns=['deterioration_next_12h', 'deterioration_event',
                                    'deterioration_hour', 'deterioration_within_12h_from_admission'],
                           errors='ignore').to_dict('records'),
    })

print('computed real pool for', len(records), 'patients')

# Rank by risk; label distribution
r = pd.DataFrame(records)
print('risk percentiles:', r['risk'].quantile([.25, .5, .75, .9, .99]).round(3).to_dict())
print('label==1 count:', int((r['label'] == 1).sum()), 'out of', len(r))
print('risk>0.5 count:', int((r['risk'] > 0.5).sum()))
print('risk>0.75 count:', int((r['risk'] > 0.75).sum()))

# Select a meaningful deterministic mix of 16:
#  1 genuinely high risk & deteriorated (label=1)
#  some high-risk
#  some medium
#  mostly stable (label=0, low risk)
zero = r[r['label'] == 0].sort_values('risk', ascending=False)
one = r[r['label'] == 1].sort_values('risk', ascending=False)

pick = []
pick += one.head(3).to_dict('records')                      # 3 real deteriorated, high-risk
pick += r[(r['risk'] > 0.5) & (r['label'] == 0)].head(2).to_dict('records')  # 2 high-risk-but-recovered
pick += r[(r['risk'] > 0.2) & (r['risk'] <= 0.5)].sort_values('risk', ascending=False).head(3).to_dict('records')  # 3 medium
pick += zero[zero['risk'] <= 0.2].sample(n=8, random_state=42).to_dict('records')  # 8 stable

# dedupe
seen, final = set(), []
for p in pick:
    if p['patient_id'] not in seen:
        seen.add(p['patient_id']); final.append(p)
if len(final) < 16:
    for p in zero.sample(n=16 - len(final), random_state=7).to_dict('records'):
        if p['patient_id'] not in seen:
            seen.add(p['patient_id']); final.append(p)

# deterministic bed/ward assignment
wards = ['A', 'B', 'C', 'ICU']
hospitals = [1, 1, 1, 2, 2, 3]
for i, p in enumerate(final):
    p['ward'] = wards[i % 4]
    p['bed'] = f"{wards[i % 4]}{100 + i // 4}"
    p['hospital_id'] = hospitals[i % len(hospitals)]
    p['doctor_id'] = (i % 5) + 1

final = sorted(final, key=lambda x: -x['risk'])
out = {'patients': final, 'source': 'real dataset (last 24 obs risk + true outcome)'}
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'demo_pool.json'), 'w') as f:
    json.dump(out, f)
print('saved backend/demo_pool.json with', len(final), 'patients')
for p in final[:16]:
    print(f"  pid={p['patient_id']:5d} risk={p['risk']*100:5.1f}% label={p['label']} ward={p['ward']} hosp={p['hospital_id']} doc={p['doctor_id']}")
