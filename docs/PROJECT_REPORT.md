# AI-Powered Early Warning System for Hospital Patient Deterioration

## SentinelCare — Project Report

**Domain:** Artificial Intelligence & Machine Learning (Healthcare Informatics)

---

# Cover Page

### Project Title
**SentinelCare — AI-Powered Early Warning System for Hospital Patient Deterioration**

### Domain
Artificial Intelligence & Machine Learning (Healthcare Informatics)

### Submitted By

| Field | Details |
|---|---|
| **Name** | ____________________ |
| **Roll No.** | ____________________ |
| **Course** | ____________________ |
| **Department** | ____________________ |

| Field | Details |
|---|---|
| **Guided By** | ____________________ |
| **Academic Year** | ____________________ |

---

# Declaration

We hereby declare that the project report entitled **"SentinelCare — AI-Powered Early
Warning System for Hospital Patient Deterioration"** is our original work carried out as
part of our academic project under the guidance of the faculty. We take responsibility for
the information and work presented in this report. No part of this report has been
submitted for any degree or diploma elsewhere.

Name & Signature:
1. ____________________
2. ____________________
3. ____________________

**Place:** ____________________
**Date:** ____________________

---

# Acknowledgement

We sincerely thank our project guide and faculty members for their valuable guidance,
encouragement, and constructive feedback throughout the development of this project. Their
support in understanding machine learning, system design, and mobile development was
invaluable.

We also express our gratitude to our department staff, our colleagues who helped in testing
the application, and everyone who supported us in completing this project successfully.

---

# Abstract

SentinelCare is a research prototype of an **AI-powered early warning system** for hospital
in-patients. In hospitals, the vital signs that indicate a patient is deteriorating —
falling oxygen saturation, rising heart rate and breathing rate, dropping blood pressure —
often appear **hours** before an emergency, but a busy doctor cannot watch every patient's
monitor at once. SentinelCare applies **machine learning** to this problem. Two models,
trained on a **real hospital deterioration dataset** of ~418,000 hourly observations from
~10,000 patients, continuously score each patient's **risk of deterioration from 0% to 100%**.

The system comprises a **FastAPI backend** that holds patient data and runs the inference
pipeline, and a **React Native (Expo) mobile app** that serves as the clinician's dashboard.
Every few seconds the app polls the server; when a patient's risk crosses the danger
threshold, the system raises an **alert** — the phone vibrates, an alarm banner appears, a
doctor is assigned, and recommended next steps are generated. The system also includes a
**simulator** to demonstrate a deterioration in real time and a **risk analyzer** to score
any set of entered observations.

The combined model reaches a **test ROC-AUC of ~0.95**, demonstrating strong ability to
distinguish deteriorating from stable patients. SentinelCare is an **educational/research
demonstration**, not a medical device, and this is stated clearly throughout.

---

# Table of Contents

1. **Cover Page**
2. **Declaration**
3. **Acknowledgement**
4. **Abstract**
5. **Table of Contents**
6. **List of Figures**
7. **List of Tables**
8. **Introduction, Background & Problem Statement** — healthcare context, clinical
   deterioration, problem definition
9. **Motivation & Objectives** — motivation, problem statistics, objectives
10. **Scope & Existing vs. Proposed System** — scope, existing system, proposed system,
    ethical & disclaimer note
11. **System Requirements** — hardware, software, dependency tables
12. **Component & System Module Descriptions** — dataset, preprocessing, feature
    engineering, models, backend, app, alerting
13. **Data & Configuration** — feature schema, risk bands, thresholds, key parameters
14. **System Architecture & Block Diagram** — system diagram, ML pipeline, flowchart
15. **Working Principle & Operational Workflow** — numbered end-to-end flow
16. **"Sensor" (Observation) Operation** — data sources, simulator drift model
17. **"Controller" (Model & Server) Operation** — inference, scoring, doctor assignment,
    escalation, recommendations
18. **Software Architecture & Algorithm** — module responsibilities, key algorithms
19. **Pseudocode & Program Structure** — endpoints and design
20. **System Indications** — statuses, alerts, log lines, explainability
21. **Testing & Test Cases** — test plan, cases, results
22. **Results & Analysis** — model metrics, comparisons, demo results, honest limitations
23. **Advantages & Limitations**
24. **Future Enhancements & Applications**
25. **Conclusion & References**
26. **Code**

---

# List of Figures

- **Figure 1.1:** Overall System Architecture
- **Figure 1.2:** ML Training Pipeline / Data Flow
- **Figure 1.3:** System Flowchart (Alert Generation)
- **Figure 1.4:** Mobile App Screen Structure (Navigation)
- **Figure 1.5:** Complete Demo Operation Flow

---

# List of Tables

- **Table 1.1:** Hardware Requirements
- **Table 1.2A:** Backend Software Requirements
- **Table 1.2B:** Mobile Software Requirements
- **Table 1.3:** Dataset Summary
- **Table 1.4:** Temporal Feature Construction (per signal)
- **Table 1.5:** Risk Bands & Thresholds
- **Table 1.6:** Backend API Endpoints
- **Table 1.7:** Mobile App Screens & Purposes
- **Table 1.8:** Rule-Based Recommendation Priority
- **Table 1.9:** Test Cases
- **Table 1.10:** Combined Model Evaluation Results
- **Table 1.11:** Static Model Evaluation Results

---

# 8. Introduction, Background & Problem Statement

## 1.1 Introduction

Patient monitoring is a central and essential part of hospital care. Patients admitted to
wards are connected to bedside monitors that continuously record vital signs — **oxygen
saturation (SpO₂), heart rate, respiratory rate, temperature, systolic and diastolic blood
pressure**, along with laboratory values and patient context. These readings are the raw
signal that tells a clinician how a patient is doing from hour to hour.

The difficulty is not collecting these numbers; it is **interpreting them in time**.
Modern hospital units can generate thousands of data points per patient per day. A single
medical doctor, responsible for many beds across several wards, cannot simultaneously track
the minute trends of every patient's oxygen, heart rate, breathing and blood pressure.

This project addresses a well-known clinical problem: **clinical deterioration** — a
patient's condition quietly worsening over hours. The earliest signs are subtle: a small
dip in oxygen, a slightly faster heartbeat, a rising respiratory rate. Left unnoticed,
deterioration can progress to respiratory failure, shock, cardiac arrest, coma, or death.
Caught **early**, the same deterioration is often immediately treatable with oxygen,
fluids, or escalation of care.

## 1.2 Background

### The doctor shortage in India

India's *national average* doctor-to-population ratio is about **one doctor per 811
people** (Union Health Ministry figures tabled in Parliament, 2024–26), a figure that on
paper beats the World Health Organization's recommended minimum of 1:1000. But this average
masks severe regional imbalance: roughly **70% of doctors work in urban areas**, which hold
only about 30% of the population; some states have ratios as low as one doctor per ~13,000
people. The practical result is that a single clinician frequently monitors a large number
of beds at once — exactly the scenario where automated early-warning systems can help most.

### Deterioration is detectable — and often missed

Research consistently shows that in-hospital cardiac arrests rarely come without warning.
Studies report that **up to ~70% of patients who suffer an in-hospital cardiac arrest had
abnormal vital signs in the hours before the event**. The warning is present; the difficulty
is recognizing and acting on it under real workload.

### Why machine learning

Traditional tools such as the National Early Warning Score (NEWS / NEWS-2) use simple
thresholds on a handful of vital signs. While useful, they ignore the interactions and
**trends** between many signals simultaneously. A machine-learning model can ingest dozens
of features (vitals plus their changes and rolling statistics) and learn complex patterns
that distinguish a patient who is about to deteriorate from a patient who is merely
charting a normal, stable course. This is the core idea behind SentinelCare.

## 1.3 Problem Statement

The objective is to develop a system that:

1. **Continuously ingests patient observations** — vitals, oxygen support, laboratory
   values, and patient context;
2. **Computes a live risk score (0–100%)** for deterioration using machine-learning models
   trained on real hospital data;
3. **Raises an alert** the moment a patient's risk crosses a defined danger threshold;
4. **Drives the alert through a real workflow** — assign a doctor, provide recommended
   actions, and allow acknowledgement — so a clinician is notified *while there is still
   time to act*; and
5. **Explains itself** — surfaces *why* a patient was flagged (which vitals changed) and
   *what to do* next.

---

# 9. Motivation & Objectives

## 2.1 Motivation

The project is motivated by three interlocking facts:

- **Workload.** India has roughly one doctor per 811 people; a single doctor often monitors
  many beds across many wards, making continuous manual review of every patient's vitals
  impractical.
- **Detectability.** Up to ~70% of in-hospital cardiac arrests show abnormal vital signs in
  the **hours before** the event — the warning is present but easy to miss.
- **Impact.** Early recognition leads to timely, often simple interventions; delayed
  recognition sharply raises mortality and burdens intensive-care (ICU) resources.

These facts motivated building a practical demonstration that couples a real
machine-learning model with a realistic alerting workflow, so the idea of automated
early-warning can be **understood, tested, and demonstrated** in a classroom or lab.

## 2.2 Objectives

- To build a backend server (FastAPI) that holds patient data and runs a real ML inference
  pipeline.
- To train a **temporal (time-series)** model on engineered features capturing vitals
  trends.
- To train a **static (point-in-time)** model on a single observation snapshot.
- To compute a live, explainable risk score (0–100%) for every patient every few seconds.
- To raise and log an **alert** when risk crosses the danger threshold (50%).
- To provide a **mobile dashboard** (React Native / Expo) showing risk, alerts, a
  simulator, and a risk analyzer.
- To implement an alert **acknowledge/reset workflow** and doctor assignment & escalation.
- To demonstrate the full end-to-end idea on a local network without internet dependency.

---

# 10. Scope & Existing vs. Proposed System

## 3.1 Scope

The prototype is designed for **demonstration, education, and research** on a local network.
It can be used in homes, classrooms, labs, and colleges to show how real patient
observations can drive automated early-warning alerts. It includes a complete demo
environment: **16 real patient profiles**, a **simulator** (which fabricates the next hours
of a patient's vitals), a **risk analyzer** (to score any typed observations), an **alert
workflow** (create, acknowledge, clear), and a **mobile dashboard**.

The project does **not** currently connect to real hospital monitoring equipment, real
Electronic Health Record (EHR) systems, or provide clinician authentication.

## 3.2 Existing System (manual review)

Traditional ward monitoring relies on **manual review** of vitals by clinical staff. There
is no automated, machine-learned risk scoring in the basic setting; warning signs may be
missed under workload, and no systematic alerting or escalation exists at the prototype
level. Standard tools like NEWS-2 apply a limited, fixed set of thresholds and can miss the
subtle multi-signal interactions.

## 3.3 Proposed System (AI-assisted early warning)

The proposed system uses **machine-learning models** to continuously score each patient's
deterioration risk from their live observations, and **automatically raises an alert** when
risk crosses a threshold. Benefits over the existing approach:

- Consolidates many vitals *and their trends* into one risk number.
- Alerts **automatically and immediately**, without requiring staff to spot the change.
- Assigns a doctor and suggests **recommended actions**.
- Explains the flag (which vitals changed).
- Provides a **consistent** risk that matches the value shown on the patient card.

## 3.4 Ethical & Disclaimer Note

SentinelCare is an **educational research prototype**. Risk estimates are **not medical
diagnoses** and must **never be used for clinical decision-making**. No regulatory approval
has been sought. The 16 demo patients are real historical (anonymised) observations being
**simulated**; the "living hospital" is not real. This distinction is present throughout the
documentation and in the app itself.

---

# 11. System Requirements

## 4.1 Hardware Requirements

**Table 1.1: Hardware Requirements**

| Component | Purpose | Notes |
|---|---|---|
| Computer / Laptop (Windows or macOS) | Runs the backend server ("the brain") | Python 3.12, any modern laptop |
| Android phone | Runs the mobile app | Via the **Expo Go** app |
| Wi-Fi network (shared by both) | Lets the phone reach the server | Both devices on the same network |
| Internet link | Required only for one-time installs | Not required at runtime |

## 4.2 Software Requirements

**Table 1.2A: Backend Software Requirements**

| Software / Library | Version | Purpose |
|---|---|---|
| Python | 3.12 | Primary language |
| FastAPI | ≥ 0.111 | Web framework |
| Uvicorn | ≥ 0.30 | ASGI server |
| pandas | ≥ 2.1 | Data manipulation |
| numpy | ≥ 1.26 | Numerical computing |
| scikit-learn | ≥ 1.9 | ML models & metrics |
| pyarrow | ≥ 15 | Parquet data reading |
| pydantic | ≥ 2.7 | Request/response validation |
| google-auth | ≥ 2.30 | (optional) FCM auth |
| pytest | ≥ 8 | Automated tests |

**Table 1.2B: Mobile Software Requirements**

| Software / Library | Version |
|---|---|
| React | 18.2.0 |
| React Native | 0.74.5 |
| Expo SDK | ~51 |
| Expo Go (app) | SDK 51 compatible |
| Expo Notifications | ~0.28.13 |
| React Navigation (native / native-stack) | 6.x |
| react-native-reanimated | ~3.10.1 |
| react-native-safe-area-context | 4.10.5 |
| react-native-screens | 3.31.1 |

---

# 12. Component & System Module Descriptions

This section describes each module of the system and its responsibility.

## 5.1 Dataset (Real)

The project is trained on the public **`hospital-deterioration`** dataset (Hugging Face).
After cleaning it contains **417,866 hourly observation rows** from **~10,000 patients**,
with **28 columns**.

**Table 1.3: Dataset Summary**

| Aspect | Value |
|---|---|
| Raw rows | 1,681,464 |
| Cleaned rows | 417,866 |
| Patients | ~10,000 |
| Columns | 28 |
| Positive rate (`deterioration_next_12h`) | ≈ 5.4% |
| Target | `deterioration_next_12h` |

The columns include: `patient_id`, `hour_from_admission`, six vitals (SpO₂, heart rate,
respiratory rate, temperature, systolic BP, diastolic BP), oxygen device and flow, mobility
score, nurse-alert flag, five laboratory values (WBC, lactate, creatinine, CRP, hemoglobin),
sepsis-risk score, demographics (age, gender, comorbidity index, admission type),
`baseline_risk_score`, `los_hours`, and the deterioration labels.

## 5.2 Preprocessing Module

`ml/data_processing.py` performs:

1. **Drop rows** missing the target, `patient_id`, or heart rate.
2. **Deduplicate** rows by `(patient_id, hour_from_admission)`, keeping the last.
3. **Sort** by patient then hour.
4. **Patient-level split** into train / validation / test **70/15/15** using a seeded
   `RandomState(42)` so that no single patient's data leaks into more than one split.
5. Write outputs: `data/cleaned.parquet`, `data/patient_splits.json`.

This split strategy is critical: because an individual patient can appear many times, a
**patient-level** split (not a row-level split) prevents leakage and gives an honest
estimate of generalization to new patients.

## 5.3 Feature Engineering Module

`ml/feature_engineering.py` converts raw hourly observations into model-ready features.
For the **temporal model**, for each of 12 core signals (six vitals + oxygen flow + five
labs) it derives **9 trend features** each:

**Table 1.4: Temporal Feature Construction (per signal)**

| Feature | Meaning |
|---|---|
| `{col}_prev1` | Previous hour's value |
| `{col}_chg1h` | Change over 1 hour |
| `{col}_chg3h` | Change over 3 hours |
| `{col}_roll3_mean` | 3-hour rolling mean |
| `{col}_roll3_std` | 3-hour rolling standard deviation |
| `{col}_roll6_mean` | 6-hour rolling mean |
| `{col}_roll6_min` | 6-hour rolling minimum |
| `{col}_roll6_max` | 6-hour rolling maximum |
| `{col}_slope3` | 3-hour linear slope |

It also adds rolling means for `nurse_alert` and `mobility_score`, derived physiological
ratios (SpO₂/HR ratio, BP difference, mean arterial pressure, respiratory/SpO₂ ratio,
HR/respiratory ratio, temperature deviation from 37 °C), and encoded categoricals (oxygen
device, gender, admission type). The **full temporal feature set is 134 columns** and is
saved to `data/models/feature_columns.json`. The `_chg1h` feature uses only current and
previous hours, so there is **no future leakage**.

For the **static (point-in-time) model** a separate **22-feature** set is used from a single
snapshot.

## 5.4 Temporal (Time-Series) Model

`ml/model_training.py` trains and compares two candidates on the engineered train split:

- **LogisticRegression** (`class_weight='balanced'`)
- **RandomForestClassifier** (200 trees, `max_depth=12`, balanced)

The best by validation ROC-AUC (the Random Forest) is wrapped in **sigmoid calibration**
(`CalibratedClassifierCV(method='sigmoid', cv='prefit')`), so the raw model scores become
well-calibrated probabilities. Validation: LR ROC-AUC ≈ 0.914 / PR-AUC 0.388; RF ROC-AUC ≈
**0.960** / PR-AUC 0.707. The calibrated RF is saved as `data/models/best_model.pkl`.

## 5.5 Static (Point-in-Time) Model

`ml/train_static_model.py` trains a **RandomForest-V3** on a single observation snapshot
per row (22 features) with a 70/30 stratified split (seed 1). The shipped artifact used
**25 estimators, `min_samples_leaf=8`** (deliberately small for fast loading), reaching
**train AUC 0.9947 / test AUC 0.9619**. Saved as `data/models/best_model_static.pkl`.

## 5.6 Backend Server (FastAPI)

`backend/app.py` is the "brain". Responsibilities:

- Holds the patient list and simulator state **in memory** and persists device tokens,
  alert counter, and system stats to `backend/state.json`.
- Runs the **real inference pipeline** on every new observation:
  `risk = max(temporal_risk, static_risk)` (safety bias — higher wins).
- Enforces a **monotonic risk floor** during deterioration so the alert % always matches the
  card %.
- Creates, logs, acknowledges, and clears **alerts**.
- Assigns the **least-loaded on-duty doctor** and handles **escalation**.
- Generates **rule-based recommendations** and **explainability** factors.
- Exposes a full REST **API** (Table 1.6).

## 5.7 Mobile App (React Native / Expo)

`mobile/` is the clinician's dashboard. Screens:

**Table 1.7: Mobile App Screens & Purposes**

| Screen | Purpose |
|---|---|
| CommandCenter (Home) | Colour-coded dashboard, priority queue, recent alerts, quick actions |
| PatientDetail | Vitals, risk bar, why flagged, recommended actions |
| Alerts | Pending/Completed list; acknowledge; clear all |
| Simulator | Watch a patient deteriorate live and create an alert |
| RiskAnalyzer | Type any vitals; see the model score & explain |

Global services: `AlertWatcher` (renderless, polls for new alerts), `DoctorAlert` (in-app
banner + vibration), `Snackbar` (toasts), `ErrorBoundary` (graceful crash screen). The app
polls the server every ~5–6 seconds.

## 5.8 Alerting & Notifications

When risk crosses the threshold, the system:
1. **Logs an alert** with a vitals snapshot and assigned doctor.
2. **Notifies the phone** — primarily via the **in-app alarm banner + vibration**
   (`DoctorAlert`), which works deterministically inside Expo Go.
3. Optionally sends an **Expo/FCM push** (default `PUSH_MODE=log`, i.e. log-only, so no
   external push server is required for the demo).

---

# 13. Data & Configuration

## 6.1 Feature Schema

- **Temporal model:** 134 features (base signals + trend features + derived ratios +
  encodings). Filled with 0 for missing/inf; expects a dataframe with the engineered last
  row.
- **Static model:** 22 features from a single snapshot; missing values use documented
  defaults.

## 6.2 Risk Bands & Thresholds

**Table 1.5: Risk Bands & Thresholds**

| Risk Score | Status | Colour |
|---|---|---|
| 0 – 24% | STABLE | Green |
| 25 – 49% | WATCH | Yellow |
| 50 – 74% | HIGH | Orange |
| 75 – 100% | CRITICAL | Red |

- **Alert threshold:** risk ≥ **50%** (`ALERT_THRESHOLD = 0.50`).
- **Combination rule:** `risk = max(temporal_risk, static_risk)` — the higher wins (a
  deliberate safety bias).
- **Monotonic floor:** during a deterioration run, `risk = max(risk, prior_risk)` so the
  displayed risk never drops mid-run.

## 6.3 Doctor Load & Escalation

- `ESCALATION_CRITICAL_LIMIT = 3`: escalate when more than this many CRITICAL patients
  exist.
- `PER_DOCTOR_CRITICAL_LIMIT = 2`: a doctor is "overloaded" when holding ≥2 critical
  patients.
- Doctor assignment: assign each new critical patient to the **least-loaded on-duty
  doctor**; escalate to more doctors when the critical count exceeds the limit.

## 6.4 Push Configuration

- `PUSH_MODE` (env): `log` (default) | `expo` | `fcm`. `log` mode logs the notification
  intent without sending, so the demo works offline.
- Countries: devices register via `POST /api/devices/register`; tokens persist in
  `state.json`.

## 6.5 Network Configuration

- The mobile app connects to `http://<computer-IP>:8000/api`. The base URL is editable in
  `mobile/src/theme.js`.
- The backend binds `0.0.0.0:8000`, so it is reachable on the LAN.

---

# 14. System Architecture & Block Diagram

## 7.1 Overall System Architecture

**Figure 1.1: Overall System Architecture**

```
  Real hospital dataset ──► ML pipeline (preprocess → features → train 2 models)
                                   │   artifacts (pkl / json)
                                   ▼
        Live observations ──►  BACKEND (FastAPI, 0.0.0.0:8000)
        (16 real profiles /      │  predict_risk: max(temporal, static) → 0–100%
         simulator / typed)      │  alerts · doctors · reset · clear
                                   │  /api  (JSON over local Wi-Fi)
                                   ▼
        Android phone (Expo Go)  ◄──── mobile dashboard (Home, Detail, Alerts,
        QR scan                   Simulator, Risk Analyzer) — polls every ~5–6 s
```

## 7.2 Machine-Learning Training Pipeline

**Figure 1.2: ML Training Pipeline / Data Flow**

```
Raw observations
      │  clean (drop missing, dedupe, sort)
      ▼
Cleaned parquet (~417,866 rows, ~10,000 patients)
      │  patient-level 70/15/15 split (RandomState 42)
      ▼
Train / Val / Test
      │  train: temporal features (134 cols) → RF + LR → pick best → sigmoid calibrate
      │  train: static snapshot (22 cols) → RF-V3 (25 trees, leaf 8)
      ▼
Artifacts: best_model.pkl · best_model_static.pkl
           feature_columns.json · static_feature_columns.json
           model_results.json · test_results.json · static_model_results.json
```

## 7.3 Alert Generation Flowchart

**Figure 1.3: System Flowchart (Alert Generation)**

```
        Start
          │
Init: load models, load demo pool, start server
          │
Receive observation (sim step / typed vitals)
          │
Compute temporal_risk and static_risk
          │
risk = max(temporal, static)
          │
if deteriorating: risk = max(risk, prior_risk)   (never drop mid-run)
          │
      risk ≥ 50% ? ──No──► update patient card, return
          │Yes
Create alert: snapshot vitals, log, assign doctor
          │
Notify: in-app banner + vibration (+ optional push)
          │
Acknowledge / Clear
          ▼
        End / repeat
```

## 7.4 Mobile App Navigation

**Figure 1.4: Mobile App Screen Structure (Navigation)**

```
App
 ├─ ErrorBoundary
 ├─ NavigationContainer ─ Stack.Navigator
 │    ├─ CommandCenter (Home)
 │    ├─ PatientDetail
 │    ├─ Alerts
 │    ├─ Simulator
 │    └─ RiskAnalyzer
 ├─ Snackbar
 ├─ AlertWatcher   (renderless global poller)
 └─ DoctorAlert    (global in-app alarm banner)
```

## 7.5 Complete Demo Operation

**Figure 1.5: Complete Demo Operation Flow**

```
Open Expo Go → scan QR → Home dashboard (16 patients)
  → open critical patient (vitals, risk bar, why-flagged, actions)
  → Run Simulator → Create Alert → risk climbs 8% → 51%
  → phone vibrates + alarm banner (same %) → alert in Home
  → acknowledge → Pending → Completed
  → Test Risk Analysis → Use risky values → ~91% CRITICAL explained
  → Alerts → Clear all → resets patients for a fresh demo
```

---

# 15. Working Principle & Operational Workflow

1. The system is powered ON; the server loads both ML models and the 16-patient demo pool.
2. The phone app connects over Wi-Fi and polls the server every few seconds.
3. Each new observation (from the simulator or typed into the analyzer) goes through the ML
   pipeline.
4. The server computes a risk score and updates the patient card.
5. When risk crosses **50%**, the server creates an alert, snapshots the vitals, and assigns
   the least-loaded doctor.
6. The phone **vibrates** and shows an **alarm banner** with the same risk percentage.
7. The alert appears as Pending in Home/Alerts; the clinician **acknowledges** it (→
   Completed).
8. **Reset / Clear all** restores every patient to their original state for a fresh demo.
9. The system returns to continuous monitoring mode.

---

# 16. "Sensor" (Observation) Operation

The "sensor" is the analogue of the distance sensor in the reference embedded example: the
**source of live readings**.

## 9.1 Data sources

- **Real demo pool:** 16 real patients drawn from the cleaned dataset, each carrying its
  real 12 hourly observations (`window`) plus a computed risk. 6 are high-risk (77.9–84.0%)
  and 10 low-risk (0.6–9.5%); 10 truly deteriorated in their record.
- **Simulator:** fabricates "the next hour" of a deteriorating patient — drifting vitals and
  drivers (SpO₂ → 90, HR → 102, RR → 23, temp → 38.4, lactate → 2.9, WBC → 11, sepsis risk
  → 0.72, mobility → 1, nurse alert → 1), and auto-upgrades the oxygen device
  (none → nasal → HFNC) as flow increases. Discretised drift at a fixed rate keeps the
  simulated patient *in-distribution* for the trained model.
- **Risk Analyzer:** pure model entry of any typed vitals/labs/context (no simulation).

## 9.2 Example condition

> If risk ≥ 50% → create an alert; otherwise → keep monitoring (update patient card).

This mirrors the reference sensor rule (`if distance < limit → open lid`) but operates on a
learned risk score.

---

# 17. "Controller" (Model & Server) Operation

The "controller" is the analogue of the microcontroller: it **decides and acts**.

## 10.1 Inference & scoring

1. **Reads** the latest observation and builds the feature vector.
2. **Scores** with the temporal model (trend) and the static model (snapshot).
3. **Combines**: `risk = max(temporal, static)`.
4. **Floors** the risk during deterioration to never drop below the shown value.
5. **Compares** against the threshold and updates the patient card.

## 10.2 Doctor assignment & escalation

- Assign the least-loaded on-duty doctor for a new critical patient.
- Track per-doctor PENDING critical loads; flag overloaded doctors (≥2) and escalate when
  CRITICAL patients exceed the limit (3).

## 10.3 Recommended actions (rule-based)

For an alert, `recommend_actions(vitals)` returns tiered care actions:

**Table 1.8: Rule-Based Recommendation Priority**

| Condition | Action | Priority |
|---|---|---|
| SpO₂ < 92 | Administer O₂; consider HFNC/NIV | HIGH |
| HR > 110 | Review for tachycardia | MEDIUM |
| RR > 24 | Evaluate respiratory distress; ABG | HIGH |
| SBP < 90 | Hypotension protocol; fluids/pressors | CRITICAL |
| Temp ≥ 38 °C | Fever workup; cultures | MEDIUM |
| Lactate > 2.0 | Sepsis screen; repeat lactate; early goal therapy | HIGH |
| WBC > 12 or CRP > 50 | Evaluate infection; review antibiotics | MEDIUM |
| (none triggered) | Continue routine monitoring | LOW |

## 10.4 Explainability

- **Patient "why flagged":** differences between the last two observations (SpO₂, HR, RR,
  BP, temp), ranked by magnitude and adverse direction (`_compute_explanation_from_vitals`).
- **Risk Analyzer "factors":** distance of each entered value from a clinical threshold,
  labelled high/moderate/low impact.

These are **rule-based heuristics** — not SHAP attribution — and are documented as such.

---

# 18. Software Architecture & Algorithm

## 11.1 Module responsibilities

| Module | Responsibility |
|---|---|
| `ml/data_processing.py` | Load, clean, split the dataset (patient-level) |
| `ml/feature_engineering.py` | Build 134 temporal + 22 static features |
| `ml/model_training.py` | Train/calibrate the temporal model |
| `ml/train_static_model.py` | Train the static model |
| `backend/app.py` | Serve API, run inference, manage alerts/doctors/state |
| `mobile/src/services/api.js` | HTTP client for the backend |
| `mobile/src/services/notifications.js` | Polls alerts, dedupe seen, triggers banner/notification |
| `mobile/src/screens/*` | UI screens |
| `mobile/src/components/*` | Shared UI + global alert/snackbar/error components |

## 11.2 Key algorithms

1. **Patient-level split.** Seed 42; shuffle patient IDs; assign 70/15/15 (prevents leakage).
2. **Temporal feature builder.** Rolling windows (3h, 6h), deltas, slope — all computed per
   patient, no future leakage.
3. **Calibrated ensemble scoring.** `risk = max(temporal, static)` with monotonic floor.
4. **Alert state machine.** Pending → Completed (acknowledge); clear restores patients.
5. **Doctor load balancer.** Least-loaded on-duty doctor by specialty, with escalation.

---

# 19. Pseudocode & Program Structure

```
START
  load models & feature columns
  load demo patient pool (16 patients)
  start server on port 8000

ENDPOINT evaluate_observation(patient, observation):
    features = build_features(observation history)     # temporal
    t_risk   = temporal_model.predict(features)
    s_risk   = static_model.predict(snapshot)          # point-in-time
    risk     = max(t_risk, s_risk)
    IF deteriorating THEN risk = max(risk, prior_risk)
    update patient card with risk
    IF risk >= 0.50 THEN
        create alert (snapshot vitals, assign doctor)
        notify -> banner + vibration (+ optional push)
    END IF
    RETURN risk
END

ENDPOINT acknowledge(alert_id):
    set status = COMPLETED
END

ENDPOINT clear_alerts():
    clear alerts; restore affected patients from demo pool
END

ENDPOINT reset():
    restore all 16 patients; clear alerts; reset simulator state
END

# Mobile App
LOOP every ~6 seconds:
    poll /patients, /dashboard/summary, /alerts
    if new PENDING alert (not seen): emit banner + vibration + schedule notification
END
```

---

# 20. System Indications

| Condition | System Status / Output |
|---|---|
| System powered ON / server started | `Application startup complete.` |
| Models loaded | `ML model loaded successfully: RandomForestClassifier` |
| Features loaded | `Feature columns loaded: 134 features` |
| Observation received | `Observation received — Patient: n, deteriorating: True` |
| Risk computed | `Model prediction: 0.51 → HIGH` |
| Alert raised | `Alert created: ALERT-13 for patient 4407 (risk 51.4%)` |
| Phone notification | In-app alarm banner + vibration |
| After acknowledge | Alert moves Pending → Completed |
| After clear/reset | Alerts cleared; patients restored |
| Risk analyzer | `Risk analysis result: 90.9% — CRITICAL` |

These logs also feed the **live-terminal demonstration** (see `docs/DEMO.md`) — a teacher can
watch every network request and model prediction appear in the backend terminal in real
time as the app is used.

---

# 21. Testing & Test Cases

## 14.1 Test approach

Testing combined **source-level unit tests** (pytest), **model-metric validation**, and
**end-to-end functional testing** on the live system.

## 14.2 Automated tests

| Test file | Covers |
|---|---|
| `tests/test_pipeline.py` | Feature engineering correctness; no-future-leakage; target integrity; risk-band thresholds |

Run with:
```bash
python3 -m pytest tests/ -q
```
Result: **6 tests, all passing**.

## 14.3 Functional end-to-end test cases

**Table 1.9: Test Cases**

| Test ID | Application | Input | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| TC-01 | System startup | Power ON | Server starts; models load | Startup complete | PASS |
| TC-02 | Risk consistency | Deteriorate patient 3360 (card 84%) | Alert = 84%, no drop | 0.84 → HIGH | PASS |
| TC-03 | Monotonic risk climb | Deteriorate patient 4407 (8%) | Risk rises 8% → 51% | 8% → 51.4% HIGH | PASS |
| TC-04 | Clear alerts | Clear after alert | Alerts cleared; patient restored | patients_restored = 1 | PASS |
| TC-05 | Risk analyzer (risky) | "Use risky values" | ~91% CRITICAL | 90.9% CRITICAL | PASS |
| TC-06 | Risk analyzer (healthy) | Healthy vitals | Low / STABLE | Low | PASS |
| TC-07 | Doctor assignment | Many critical alerts | Least-loaded doctor; overload/escalation flags | Latched correctly | PASS |
| TC-08 | Acknowledge | Acknowledge button/banner | Pending → Completed | Confirmed | PASS |

---

# 22. Results & Analysis

## 15.1 Combined (temporal + static) model — unseen test set

**Table 1.10: Combined Model Evaluation Results**

| Metric | Value |
|---|---|
| Precision | 0.7648 |
| Recall | 0.5878 |
| F1 | 0.6647 |
| **ROC-AUC** | **0.9526** |
| PR-AUC | 0.6880 |

A ROC-AUC of ~0.95 means the model separates deteriorating from stable patients far better
than chance, giving strong confidence in the risk ranking.

## 15.2 Static point-in-time model

**Table 1.11: Static Model Evaluation Results**

| Metric | Value |
|---|---|
| Train ROC-AUC | 0.9947 |
| Test ROC-AUC | 0.9619 |
| Test PR-AUC (APS) | 0.7255 |
| Estimators | 25 (min_samples_leaf 8) |
| Train rows / Test rows | 292,506 / 125,360 |
| Target rate | 0.0541 |

## 15.3 Demo / functional results

- The simulator successfully drove a stable patient's risk from ~8% upward; the alert fired
  at the exact crossing of 50%, and the **alert percentage matched the patient-card
  percentage** (consistency verified end-to-end).
- **Clear-alerts** correctly reset all affected patients to their original profile.
- The **risk analyzer** returned ~91% CRITICAL for a risky profile and low/STABLE for
  healthy values.

## 15.4 Honest limitations

- **Alert lead-time** (mean −4.9 h, median −5 h) shows alerts fire *around* the
  deterioration time but are **not consistently early** (only ~4.8% positive lead). This is
  future work, not a claim we make today.
- **"Why flagged"** explanations are **rule-based heuristics**, not SHAP feature
  attribution.
- **Expo Go background notifications** may be delayed/hidden; the in-app banner +
  vibration is the reliable alert.
- **In-memory state**: restarting the backend resets current-session alerts (by design).

---

# 23. Advantages & Limitations

## 16.1 Advantages

- Automated, continuous risk scoring — no manual watching of every monitor.
- Uses **real** machine-learned models trained on a **real hospital deterioration dataset**.
- Provides the **"why"** (flagged factors) and **recommended actions** for each alert.
- Consistent, explainable risk — the alert % always matches the card %.
- Full working demo: simulator, alerts, acknowledge workflow, risk analyzer.
- Works entirely on **local Wi-Fi** — no internet dependency at runtime.
- Honest, reproducible evaluation (published AUC, precision/recall, lead-time).

## 16.2 Limitations

- Requires a computer to run the backend and an Android phone running Expo Go.
- Research prototype — **not** a clinically validated/approved medical device.
- Models are not yet **consistently early** (lead-time limitation).
- Explanations are heuristic, not deep model attributions.
- Backend state is **in-memory** (restart resets current-session alerts).
- Expo Go **background notification** delivery is unreliable on some setups.
- No real-time EMR/monitor integration or clinician authentication.

---

# 24. Future Enhancements & Applications

## 17.1 Future Enhancements

- **Real-time EMR / monitor integration** to stream live observations instead of simulated.
- Clinician **authentication and role-based access** (doctor/nurse/admin).
- **Regulatory-validated**, per-facility retrained models with drift monitoring.
- **Production push** infrastructure (FCM/APNs) with delivery guarantees.
- **Database-backed persistence**, high availability, and audit logging.
- Improve **alert lead-time** (predict earlier) and replace rule-based explanations with
  model attribution (e.g. SHAP).
- Multi-language support, touchless monitoring demo, and multi-hospital scaling.

## 17.2 Applications

- Hospital in-patient wards & ICUs (future deployment)
- Rapid-Response / Early-Warning clinical decision support
- Telemedicine and remote patient monitoring
- Medical / biomedical engineering education and research
- AI-in-healthcare demonstration and validation studies

---

# 25. Conclusion & References

## 18.1 Conclusion

SentinelCare demonstrates the practical implementation of **AI-assisted early warning**
using real patient observations, two machine-learning models, a FastAPI server, and a mobile
dashboard. The system continuously computes a patient's deterioration risk (0–100%), raises
an alert when risk crosses the danger threshold, and presents a consistent, explainable,
acknowledgeable alert workflow. The combined model reaches a **test ROC-AUC of ~0.95**,
confirming its ability to separate deteriorating from stable patients.

The project shows how machine learning can help clinicians spot deterioration early — while
clearly acknowledging that it is a **research demonstration, not a medical device**. The
system is fully demonstrable offline on a local network, making it well suited for
education, research, and validation studies.

## 18.2 References

1. SentinelCare source repository and design docs: `README.md`, `docs/SETUP.md`,
   `docs/DEMO.md`, `docs/USER_GUIDE.md`, `docs/TECHNICAL.md`, `docs/STORY.md`,
   `docs/TLDR.md`.
2. `hospital-deterioration` dataset — public hospital observations, Hugging Face.
3. scikit-learn documentation — Random Forest, Logistic Regression, calibration, metrics.
4. FastAPI & Uvicorn documentation.
5. React Native / Expo SDK 51 documentation.
6. Union Health Ministry (India) doctor-to-population ratio ~1:811 (Parliament statement),
   WHO recommended minimum 1:1000.
7. Clinical-deterioration literature — ~70% of in-hospital cardiac arrests show abnormal
   vitals in the hours before the event.

---

# 26. Code

## 19.1 Backend — core alert evaluation (from `backend/app.py`)

```python
# Risk combination + monotonic floor + alert creation
prior_risk = float(p.get('risk_probability', 0.0))
temporal_risk, _ = predict_risk(obs_df)          # time-series model
static_risk,  _  = predict_risk_static(new_obs)  # point-in-time model
risk = round(max(temporal_risk, static_risk), 4)

if state['deteriorating']:                       # never drop mid-run
    risk = max(risk, prior_risk)

status = get_risk_status(risk)                   # STABLE/WATCH/HIGH/CRITICAL
state['risk_history'].append(risk)

if risk >= ALERT_THRESHOLD and (...):            # 0.50
    alert = create_alert(patient, risk, vitals)  # snapshot + assign doctor
    notify(alert)                                # banner + vibration + optional push
```

## 19.2 Backend — rule-based recommendations (from `backend/app.py`)

```python
def recommend_actions(vitals):
    recommendations = []
    spo2 = float(vitals.get('spo2_pct', 100))
    if spo2 < 92:
        recommendations.append({
            "action": "Administer supplemental O2; consider escalation to HFNC/NIV",
            "priority": "HIGH",
            "rationale": f"SpO2 {spo2:.0f}% below target"})
    # … similar rules for HR, RR, SBP, temp, lactate, WBC/CRP …
    return recommendations
```

## 19.3 Backend — doctor assignment & escalation (from `backend/app.py`)

```python
def compute_doctor_load():
    critical = {a['patient_id'] for a in db['alerts']
                if a['status'] == 'PENDING' and a['risk_probability'] >= 0.75}
    num_critical = len(critical)
    needs_escalation = num_critical > ESCALATION_CRITICAL_LIMIT   # 3
    workload = {d['id']: 0 for d in db['doctors'] if d['on_duty']}
    # assign each critical patient to the least-loaded on-duty doctor
    return num_critical, assignments, needs_escalation, overloaded, workload
```

## 19.4 Mobile — API client (from `mobile/src/services/api.js`)

```js
const request = async (path, options = {}) => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
};
export const api = {
  getPatients: () => request('/patients'),
  getDashboard: () => request('/dashboard/summary'),
  getAlerts: () => request('/alerts'),
  simulateStep: (patientId) =>
    request('/simulate/step', { method: 'POST',
      body: JSON.stringify({ patient_id: patientId, mode: 'deteriorate' }) }),
  riskAnalyze: (vitals) => request('/risk/analyze', { method: 'POST', ... }),
  // …
};
```

## 19.5 Mobile — risk analyzer call (from `mobile/src/screens/RiskAnalyzer.js`)

```js
const data = await api.riskAnalyze(values);      // POST /api/risk/analyze
setResult(data);                                 // risk_probability, status, factors, recs
if (data.risk_status === 'HIGH' || data.risk_status === 'CRITICAL') {
  // canSimulate → "Simulate for Patient" writes values to a patient & may alert
}
```

## 19.6 Backend — server startup

```bash
cd backend
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000
```

## 19.7 Mobile — server startup

```bash
cd mobile
npx expo start
```

---

*End of project documentation.*

*For the full implementation, API reference, and model details, see `docs/TECHNICAL.md`;
for the demonstration script and live-terminal walkthrough see `docs/DEMO.md`.*