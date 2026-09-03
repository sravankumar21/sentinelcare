# SentinelCare

An **AI early-warning system for in-patient deterioration** — a research/educational prototype that predicts `deterioration_next_12h` from frequently-sampled hospital observations, serves real-time risk via a FastAPI backend, and surfaces it through dark glassmorphism web and mobile (React Native / Expo) dashboards with configurable risk bands and clinical-alert workflows.

> **Medical safety notice:** SentinelCare is a research and educational prototype using simulated clinical data. Risk estimates are **not** medical diagnoses and must not be used independently for clinical decision-making. Any high-risk output is accompanied by "Clinical review recommended."

---

## System overview

```
                         ┌──────────────────────────────┐
  Hugging Face dataset   │  ml/ (offline)               │
  hospital-deterioration │  clean → split → features    │
        │                │  → train/calibrate → eval    │
        ▼                └──────────────┬───────────────┘
  data/engineered.parquet               │  artifacts (pkl/json)
                                        ▼
                          ┌──────────────────────────────┐
                          │  backend/ FastAPI app.py     │
                          │  predict_risk() (real path)  │
                          │  /patients /alerts /simulate │
                          └──────────────┬───────────────┘
                                         │  /api (JSON)
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
              frontend/ (web)        mobile/ (Expo)      tests/ (pytest)
```

The simulator drives a live, in-memory demo hospital. Crucially, every risk score is computed by the **real inference pipeline** (`backend/app.py::predict_risk()` → `add_temporal_features()` → `model.predict_proba()` on the latest observation), never by a fake/fuzzed path.

---

## Usage

### 1. Backend (FastAPI)

```bash
pip install -r requirements.txt
python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000
```

Health check: `curl http://localhost:8000/api/system/status`

### 2. Web dashboard

```bash
cd frontend
npm install
npm start        # Recharts SPA, proxies /api on localhost:8000
```

### 3. Mobile app (Expo / React Native)

```bash
cd mobile
npm install
npx expo start   # press i (iOS sim) / a (Android) / w (web)
```

> On a physical device set `API_URL` in `mobile/src/theme.js` to your machine's LAN IP (e.g. `http://192.168.1.10:8000/api`). `localhost` works for simulators/web only.

### 4. Tests

```bash
python -m pytest tests/ -q
```

---

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/patients` | All monitored patients with live risk + vitals |
| GET | `/api/patients/{id}` | Single patient detail + prediction factors |
| GET | `/api/patients/{id}/timeline` | Vitals + risk history series |
| GET | `/api/patients/{id}/explanation` | Top SHAP-style risk drivers |
| GET | `/api/alerts` | Generated alerts |
| POST | `/api/alerts/{id}/acknowledge` | Acknowledge an alert |
| POST | `/api/simulate/start` | Begin a simulation run (`telemetry` / `deteriorate`) |
| POST | `/api/simulate/step` | Advance one hour; recomputes real risk |
| POST | `/api/simulate/reset` | Reset a patient to its seeded history |
| GET | `/api/model/metrics` | Held-out test + validation metrics, ROC/PR curves, calibration, lead time |
| GET | `/api/system/status` | Runtime status + alert counter |
| GET | `/api/dashboard/summary` | Risk-band counts across the hospital |

---

## Risk bands & alerting

Risk bands are configurable in `backend/app.py`:

| Range | Status | Color |
|-------|--------|-------|
| 0–24% | STABLE | `#22c55e` |
| 25–49% | WATCH | `#eab308` |
| 50–74% | HIGH | `#f97316` |
| 75–100% | CRITICAL | `#ef4444` |

`ALERT_THRESHOLD = 0.50` — crossing it fires an alert (PENDING → ACKNOWLEDGED, mirrored to mobile push via `expo-notifications`), with the "Clinical review recommended" guidance.

---

## Repository layout

```
├── ml/                      # offline ML pipeline
│   ├── data_processing.py       # clean, leakage-safe patient split
│   ├── feature_engineering.py   # add_temporal_features(), get_feature_columns()
│   └── model_training.py        # train LR+RF, calibrate, evaluate + lead time
├── backend/app.py           # FastAPI server (real inference path, simulator, alerts)
├── data/
│   ├── dataset.parquet          # raw Hugging Face data
│   ├── cleaned.parquet          # 417,866 dedup rows / 10,000 patients
│   ├── engineered.parquet       # 134 features
│   ├── patient_splits.json      # patient-level 70/15/15 split
│   └── models/                  # best_model.pkl, feature_columns.json, results
├── frontend/                # React + Recharts web dashboard
├── mobile/                  # Expo React Native app (glassmorphism)
│   └── src/{screens,components,services,theme.js}
└── tests/test_pipeline.py   # feature-engineering + leakage + risk tests
```

---

## About the data & pipeline

- **Dataset:** `hospital-deterioration` (Hugging Face). The 1.68M raw rows are interleaved duplicates; the **417,866 valid rows** are those with a non-null `deterioration_next_12h` (≈10,000 patients, ~5.4% positive).
- **Split:** patient-level 70/15/15 — a patient's full trajectory lives in exactly one split, preventing future-information leakage between train and test.
- **Features:** 134 engineered features (`add_temporal_features`) including rolling windows, hour-over-hour deltas, ratios (e.g. shock index, HR/RR), lab trends, oxygenation support, sepsis score, and encoded categoricals. `get_feature_columns()` excludes the target and all leakage columns.
- **Models:** LogisticRegression and RandomForest, patient-grouped evaluation. The RandomForest (wrapped in `CalibratedClassifierCV(method='sigmoid')`) is selected and serialized as `best_model.pkl`.

### Held-out test metrics (RandomForest, calibrated)

| Metric | Value |
|--------|-------|
| Precision | 0.765 |
| Recall | 0.588 |
| F1 | 0.665 |
| ROC-AUC | 0.953 |
| PR-AUC | 0.688 |

`GET /api/model/metrics` also exposes honest **alert lead-time** statistics: with the strict definition (first hour risk ≥ threshold must precede the first hour labeled deteriorating within the next 12h), only ~4.8% of deteriorated patients receive a *positive* lead. The model is a strong risk *discriminator* but is not consistently *early* under that strict window — documented rather than hidden.

> **Top model drivers** are lab/clinical trajectory features (`lactate_*`, `creatinine_*`, `sepsis_risk_score`, `oxygen_flow`, `nurse_alert`, `mobility_*`) rather than HR/SpO₂ alone. Consequently the simulator's deterioration drives these alongside vitals — vital-only drift is out-of-distribution and does not by itself elevate risk.
