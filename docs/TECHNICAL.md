# Technical Overview — SentinelCare

For developers who need to understand, run, extend, or maintain the project. This document
describes exactly what is implemented, with no invented capabilities.

> Reader guide: for the day-to-day run, use [SETUP.md](SETUP.md). This document covers
> architecture, the ML pipeline, the API surface, and what a real deployment would require.

---

## 1. System architecture

```
┌──────────────────────────────┐      Wi-Fi (HTTP/JSON)       ┌─────────────────────────────┐
│   Android phone (Expo Go)    │  ─────────────────────────►  │   Laptop: FastAPI backend    │
│   React Native / Expo SDK 51 │  polls every ~5–6 s          │   uvicorn on 0.0.0.0:8000    │
│   ─ screens, simulator,      │  ◄─────────────────────────  │                              │
│     alerts, risk analyzer    │     JSON payloads            │  in-memory state, alerts,    │
└──────────────────────────────┘                              │  simulation engine          │
                                                              └─────────────┬────────────────┘
                                                                            │ loads at startup
                                                              ┌─────────────▼────────────────┐
                                                              │  data/  (real dataset),      │
                                                              │  ml/    (feature pipelines), │
                                                              │  data/models/ (trained pkl)  │
                                                              └──────────────────────────────┘
```

- **Mobile → backend:** the app calls only the backend over plain HTTP on your LAN. The
  CORS middleware allows all origins (demo convenience).
- **State:** all patient/alert/simulator state lives in an in-memory Python dictionary.
  A JSON file (`backend/state.json`) persists device tokens, the alert counter, simulator
  history, and system stats across restarts. **Alerts are intentionally not restored on
  restart** — the demo starts with an empty Recent Alerts list each session.
- **No databases, no external services, no internet dependency** at runtime.

---

## 2. Repository layout

```
backend/            FastAPI server (app.py), demo patient pool (demo_pool.json),
                    pool builder (build_demo_pool.py)
mobile/             Expo SDK 51 React Native app
                    ├─ App.js                navigation stack + global components
                    └─ src/
                       ├─ screens/           CommandCenter, PatientDetail, Alerts,
                       │                     Simulator, RiskAnalyzer
                       ├─ components/        Glass, PatientCard, RiskMeter, MonitorPanel,
                       │                     DoctorAlert, Snackbar, ErrorBoundary
                       ├─ services/          api.js (HTTP client), notifications.js
                       └─ theme.js           palette + API_URL
ml/                 data_processing, feature_engineering, model_training,
                    train_static_model
data/               raw/cleaned/engineered parquet, data/models/ (pickles + metrics json)
tests/              pytest suite
requirements.txt    backend + ML Python dependencies
docs/               this documentation set
```

---

## 3. Backend (FastAPI)

Single file `backend/app.py`. `python3 -m uvicorn app:app --host 0.0.0.0 --port 8000`
(started from `backend/`).

### 3.1 Data model — patient

Each patient object carries an ID, bed/ward, hospital & assigned doctor, demographics
(age, gender, admission type, comorbidity index), vitals (SpO₂, HR, RR, temp, systolic &
diastolic BP), `risk_probability` (0–1), `risk_status`, and `last_update`. The simulator
keeps per-patient history: the observation window (`obs_df`), the risk trajectory
(`risk_history`), and deterioration progress.

Risk bands (`get_risk_status`):

| Probability | Status | Colour (app) |
|---|---|---|
| ≤ 0.24 | STABLE | green |
| 0.25–0.49 | WATCH | yellow |
| 0.50–0.74 | HIGH | orange |
| ≥ 0.75 | CRITICAL | red |

Trend (`get_trend`) from the last 3 risk values: `RAPIDLY INCREASING ↑↑`, `INCREASING ↑`,
`DECREASING ↓`, `STABLE →`. App shows the arrows and plain-language equivalents.

### 3.2 Simulation engine

- `POST /api/simulate/start` sets a patient's mode: `deteriorate` or `observe`.
- `POST /api/simulate/step` builds the next hourly observation:
  - **deteriorate:** deterministic drift of 16 vitals/labs/drivers toward a fixed severe
    target set at rate 0.30 per step (SpO₂ → 90, HR → 102, RR → 23, temp → 38.4, lactate →
    2.9, WBC → 11, sepsis risk → 0.72, mobility → 1, nurse alert → 1, …). The episode seeds
    a stable "floor" baseline so the rise is monotonic. Oxygen device auto-upgrades
    (none → nasal → hfnc) as flow increases.
  - **observe:** small random jitter within healthy bounds, `nurse_alert = 0`.
  - Every step routes through the **real inference path** (§ 6.4), appends to
    `risk_history`, updates the patient, and checks the alert condition.
  - During deterioration the reported risk is floored to the patient's previously shown
    value so the number never drops below what the app displayed.
- Alert condition (`ALERT_THRESHOLD = 0.50`): fire when risk crosses the threshold from
  below, or when `last_alerted_risk == 0` (one alert per episode; recovery then re-drop
  re-triggers). The alert snapshots vitals, stores `previous_risk` / `risk_change`,
  generates rule-based recommendations, assigns the least-loaded on-duty doctor, and may be
  marked `escalated` if too many CRITICAL patients exist (`ESCALATION_CRITICAL_LIMIT = 3`,
  overload if a doctor holds ≥ `PER_DOCTOR_CRITICAL_LIMIT = 2` critical patients).
- `POST /api/simulate/reset` restores a patient from the real demo pool (vitals, risk,
  history).

### 3.3 Notifications / push

`send_push_notification` picks the first registered device token, increments `push_sent`,
and then acts on `PUSH_MODE` (env, default **`log`**):

| PUSH_MODE | Behaviour |
|---|---|
| `log` (default) | logs only; returns `delivered: False` — **no network send** |
| `auto` / `expo` | sends to Expo's push API if the token is an `ExponentPushToken[...]` |
| `auto` / `fcm` | sends to FCM v1 using a service account (env `FCM_SERVICE_ACCOUNT_JSON` or `FCM_SERVICE_ACCOUNT_PATH`) |

Devices register via `POST /api/devices/register` and survive restarts (state.json).

> **Demo reality:** the phone's alert does **not** depend on the backend push deliver path.
> The mobile app itself watches for new alerts (`AlertWatcher`) and fires an in-app
> banner + vibration (`DoctorAlert`), which is deterministic in Expo Go. Backend push is a
> secondary mechanism and is off by default (`log`).

### 3.4 Risk explanations (heuristic, not SHAP)

Two factors endpoints are purely **rule-based heuristics** — they report recent/
abnormal changes, they are **not** model attributions:
- Patient "Why flagged": differences between the last two observations (SpO₂, HR, RR, BP,
  temp), ranked by magnitude & adverse direction.
- Risk Analyzer "factors": distance of each entered value from a clinical threshold.

### 3.5 Notes & sentiment, hospitals, doctors (backend-only)

The API exposes clinical `notes` (lexicon sentiment −1..1 with Positive/Negative/Neutral
labels), hospitals (3 seeded), doctors (5 seeded), and an `escalation` view. These are
**not surfaced in the mobile app** in the handover build; they remain available via the API
for future UI work.

### 3.6 API reference (all routes in the running backend)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/patients` | All patients, risk-sorted |
| GET | `/api/patients/{id}` | Patient detail (+ risk/vitals history) |
| GET | `/api/patients/{id}/timeline` | Hourly vitals + risk timeline |
| GET | `/api/patients/{id}/explanation` | Rule-based "why flagged" factors |
| GET | `/api/patients/{id}/recommendations` | Rule-based care actions |
| GET | `/api/patients/{id}/trajectory` | Risk trajectory history |
| GET | `/api/patients/{id}/notes`, POST | Clinical notes + sentiment |
| GET | `/api/alerts` | All alerts (newest first) |
| POST | `/api/alerts/{id}/acknowledge` | Mark alert COMPLETED |
| POST | `/api/simulate/start` | Set mode (deteriorate/observe) |
| POST | `/api/simulate/step` | Next observation + full risk pipeline |
| POST | `/api/simulate/reset` | Restore a patient to pool baseline |
| POST | `/api/risk/analyze` | Static-model score from entered vitals |
| POST | `/api/risk/simulate` | Write entered vitals onto a patient; alert if threshold crossed |
| GET | `/api/dashboard/summary` | Risk-band counts, ward breakdown |
| GET | `/api/system/status` | Health/status |
| POST | `/api/system/reset` | Full demo reset (restores all patients; keeps devices) |
| POST | `/api/system/clear-alerts` | Clear alerts + restore only affected patients |
| GET | `/api/model/metrics` | Validation/test metrics from JSON artifacts |
| GET | `/api/devices`, POST `/api/devices/register` | Push token registry |
| GET | `/api/hospitals`, POST (add/select), GET `/api/hospitals/{id}/patients` | Hospitals |
| GET | `/api/doctors`, `/api/escalation` | Doctor load & escalation view |

---

## 4. Mobile (Expo SDK 51)

- **Stack:** React 18 / React Native 0.74 / `@react-navigation/native-stack`.
- **Navigation:** `CommandCenter` (Home) → `PatientDetail` | `Alerts` | `Simulator` |
  `RiskAnalyzer`. Global: `AlertWatcher` (renderless), `DoctorAlert` (banner), `Snackbar`,
  `ErrorBoundary`.
- **Polling:** CommandCenter/PatientDetail/Alerts/AlertWatcher poll every 6 s; Simulator
  every 5 s. Pull-to-refresh on Home.
- **Alert flow (mobile side):** `AlertWatcher` fetches `/api/alerts`, keeps a `seenAlertIds`
  set (baseline on first fetch), and for every unseen PENDING alert calls
  `notifyForAlert` → synchronous `emitNewAlert` (banner + vibration) + schedules an OS
  notification (`trigger: null`, 1 s fallback). Banner tap → `acknowledgeAlert` with
  visible acked/failed states. `resetNotificationMemory()` clears the seen-set after
  reset/clear-all so post-reset alerts notify again.
- **theme.js:** `API_URL` = `process.env.EXPO_PUBLIC_API_URL || 'http://<lan-ip>:8000/api'`.
  The LAN IP must match the demo computer's current Wi-Fi address (see SETUP.md).
- **app.json:** `usesCleartextTraffic: true` (required for plain-HTTP LAN → required for
  Expo Go dev); Expo project id and FCM config file are present for future EAS/FCM use.
- No tests in `mobile/`; verification is via the Expo bundle (Metro) and manual runs.

---

## 5. ML pipeline

### 5.1 Dataset (real)

Source: the public **`hospital-deterioration`** dataset (Hugging Face).
- Raw: `data/dataset.parquet` — 1,681,464 rows × 28 columns.
- Cleaned (`data/cleaned.parquet`): 417,866 rows (rows with a non-null
  `deterioration_next_12h` target), ~10,000 patients, positive rate ≈ 5.4%.

Columns: `patient_id, hour_from_admission`, 6 vitals (SpO₂, HR, RR, temp, sys/dia BP),
`oxygen_device, oxygen_flow, mobility_score, nurse_alert`, labs (WBC, lactate, creatinine,
CRP, hemoglobin), `sepsis_risk_score, age, gender, comorbidity_index, admission_type,
baseline_risk_score, los_hours`, and deterioration labels (`deterioration_event`,
`deterioration_within_12h_from_admission`, `deterioration_hour`, target
`deterioration_next_12h`).

Target: **`deterioration_next_12h`** — did the patient deteriorate in the next 12 hours.

### 5.2 Preprocessing & split

`ml/data_processing.py` — drops rows missing target / patient_id / heart rate; deduplicates
`(patient_id, hour_from_admission)` keep-last; sorts by patient/hour; coerces numerics;
**patient-level** split 70/15/15 (train/val/test), seeded `RandomState(42)` — no patient
leakage between splits. Outputs `data/cleaned.parquet` + `data/patient_splits.json`.

### 5.3 Temporal feature engineering

`ml/feature_engineering.py` — per patient, for the 12 core signals (6 vitals + O₂ flow +
lactate, WBC, creatinine, CRP, hemoglobin) generates 9 features each
(`{col}_prev1, _chg1h, _chg3h, _roll3_mean, _roll3_std, _roll6_mean, _roll6_min,
_roll6_max, _slope3`), plus rolling means for `nurse_alert`/`mobility_score`, 7 derived
physiological ratios (SpO₂/HR ratio, BP diff, MAP, resp/SpO₂, HR/RR, temp deviation), and
3 encoded categoricals. Feature set: **134 columns** (`data/models/feature_columns.json`).
`_chg1h` uses only current+previous hours (no future leakage — exercised by a test).

### 5.4 Models

**Temporal model** (`ml/model_training.py`):
- Candidates: LogisticRegression (`class_weight=balanced`) and RandomForestClassifier
  (200 trees, max_depth 12, balanced) trained on the engineered train split, validated on
  the val split, best-by-ROC-AUC selected and wrapped in **sigmoid calibration**
  (`CalibratedClassifierCV(cv='prefit')`). Saved as `data/models/best_model.pkl`.
- Validation: LR ROC-AUC **0.9144** / PR-AUC 0.3879; RF ROC-AUC **0.9602** / PR-AUC 0.7074.
- **Test results** (`data/models/test_results.json`): precision **0.7648**, recall
  **0.5878**, F1 **0.6647**, ROC-AUC **0.9526**, PR-AUC **0.6880**.
- **Alert lead-time** (how early alerts fire versus actual deterioration): mean **−4.86 h**,
  median −5 h, only **4.82%** of alerted patients had a positive (early) lead — i.e. the
  model alerts *around* the deterioration time but is **not consistently early**. This is an
  honest, documented limitation. (249 alert patients, 281 deteriorated, 32 missed.)

**Static / point-in-time model** (`ml/train_static_model.py`):
- 22 features from a single observation (vitals + labs + context + encoded
  oxygen/gender/admission). Trained on the cleaned data with a 70/30 stratified split
  (seed 1).
- Shipped artifact `RandomForest-Static-v3` (`data/models/best_model_static.pkl`,
  ~16 MB): RandomForest, **25 estimators, min_samples_leaf 8** (deliberately small for fast
  loading; target rate 0.0541, train 292,506 / test 125,360 rows). `train_auc 0.9947 /
  test_auc 0.9619`, `train_aps 0.9138 / test_aps 0.7255`.
- ⚠️ Reproducibility: the repo script's *defaults* are 300 trees / leaf 2; the shipped
  artifact was trained with explicit CLI arguments (`--trees 25 --leaf 8`). Re-running with
  defaults produces a different (and larger) model.

### 5.5 How the backend scores patients

- `predict_risk(df)` — temporal model: `add_temporal_features` on the history, last row,
  134 features, fill NA/Inf → 0, `predict_proba[0,1]`.
- `predict_risk_static(vitals)` — the 22-feature model; missing values get documented
  defaults. Falls back to the temporal model if the static artifact is absent.
- **Combination:** `risk = max(temporal, static)` — the higher of the two wins. Risk is the
  output shown in the app, on the alert, and on the risk bar.

### 5.6 Demo patient pool (real patients)

`backend/demo_pool.json` holds **16 real patients** drawn from the cleaned dataset: 6
already-high-risk (77.9–84.0%) and 10 low-risk (0.6–9.5%); 10 of them truly deteriorated
in their record. Each carries its **real 12 hourly observations** (`window`) used by the
simulator. `backend/build_demo_pool.py` is the reference builder (computes model risk
on each patient's window and selects a deterministic, balanced mix). The shipped pool file
was generated by a newer variant of that script, so re-running `build_demo_pool.py` today
produces an equivalent but not byte-identical pool.

### 5.7 Model-serving artifacts

`data/models/`: `best_model.pkl` (temporal, 38 MB), `best_model_static.pkl` (16 MB),
`feature_columns.json`, `static_feature_columns.json`, `model_results.json`,
`test_results.json`, `static_model_results.json`. `GET /api/model/metrics` serves the JSON
files directly.

### 5.8 Tests

`tests/test_pipeline.py` (pytest): feature-engineering correctness & no-future-leakage,
target integrity on cleaned data, risk-band thresholds. Run: `python -m pytest tests/ -q`
(needs `data/cleaned.parquet` and `data/models/` present). 6 tests, all passing.

---

## 6. What is implemented vs. what a real deployment needs

| Area | In this prototype | Needed for a real hospital |
|---|---|---|
| Data | Static real dataset; simulated "live" vitals | Real-time EMR/monitor ingestion, live streaming, patient identity & consent |
| Models | Research models, retrospectively trained; not consistently early | Regulatorily validated models, per-facility training/re-evaluation, ongoing drift monitoring |
| Alerting | In-app banner/vibration + optional Expo/FCM push; `PUSH_MODE=log` default | Production push with delivery guarantees, escalation trees, audit trail |
| Users | No logins; single demo context | Authenticated clinicians, role-based access (doctor/nurse/admin) |
| Multi-hospital | 3 seeded hospitals, doctor load columns in the API | Real org management, on-call scheduling |
| Resilience | In-memory state (single process), JSON persistence | Database(s), HA, backups, TLS/EHR-grade security |
| Clinical | Recommendations are simple decision rules; disclaimer shown in-app | Clinical validation, human review workflow, regulatory clearance (e.g. medical-device review) |

---

## 7. Known limitations (be honest with yourself and the clients)

1. The alert lead-time analysis shows alerts are **not consistently early**.
2. "Why flagged" explanations are **heuristic** (recent/abnormal changes), not
   forward attribution such as SHAP.
3. Expo Go notification delivery while backgrounded is unreliable; the in-app
   banner + vibration is the dependable path.
4. Single-process in-memory state; restarting the backend resets current-session alerts
   (by design) and the demo pool.
5. `build_demo_pool.py` differs slightly from the shipped pool (produced by a later
   variant); do not re-run it without regenerating expectations.
6. The shipped static model was trained with non-default parameters; document exact CLI
   args when retraining.