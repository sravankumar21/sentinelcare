# AI-Powered Early Warning System for Hospital Patient Deterioration (SentinelCare)

**Project Documentation — College Submission**

---

# 1. Cover Page

| Field | Details |
|---|---|
| **Project Title** | SentinelCare — AI-Powered Early Warning System for Hospital Patient Deterioration |
| **Domain** | Artificial Intelligence & Machine Learning (Healthcare) |
| **Submitted By** | Name: ____________________<br>Roll No.: ____________________<br>Course: ____________________<br>Department: ____________________<br>Guided By: ____________________<br>Academic Year: ____________________ |

---

# 2. Declaration

We hereby declare that the project report entitled **"SentinelCare — AI-Powered Early Warning
System for Hospital Patient Deterioration"** is our original work carried out as part of our
academic project under the guidance of the faculty. We take responsibility for the
information and work presented in this report.

Name & Signature:
1. ____________________
2. ____________________
3. ____________________

---

# 3. Acknowledgement

We sincerely thank our project guide and faculty members for their valuable guidance and
encouragement throughout the development of this project. We also express our gratitude to
everyone who supported us in completing the project successfully.

---

# 4. Abstract

SentinelCare is a research prototype of an **AI-powered early warning system** for hospital
in-patients. In hospitals, the vital signs that indicate a patient is deteriorating —
falling oxygen, rising heart rate and breathing rate, dropping blood pressure — often appear
**hours** before an emergency, but a busy doctor cannot watch every patient's monitor at
once. SentinelCare applies **machine learning** to this problem: two models, trained on a
**real hospital deterioration dataset** of ~418,000 hourly observations from ~10,000
patients, continuously score each patient's **risk of deterioration from 0% to 100%**. When
a patient's risk crosses a danger threshold, the system raises an **alert** — the phone
vibrates, an alarm banner appears, a doctor is assigned, and recommended next steps are
generated. The project demonstrates how sensors/observations, a server, and a mobile
dashboard can be combined to detect clinical deterioration early. It is a
**research/educational demonstration**, not a medical device.

---

# 5. Table of Contents

- Introduction, Background & Problem Statement
- Motivation & Objectives
- Scope & Existing vs. Proposed System
- System Requirements
- Component & System Module Descriptions
- Data & Configuration (the "Pin Configuration" equivalent)
- System Architecture & Block Diagram
- Working Principle & Operational Workflow
- Sensor (Observation) Operation
- Controller (Model & Server) Operation
- Software Architecture & Algorithm
- Pseudocode & Program Structure
- System Indications
- Testing & Test Cases
- Results & Analysis
- Advantages & Limitations
- Future Enhancements & Applications
- Conclusion & References
- Code

---

# 6. List of Figures

- Figure 1.1: Overall System Architecture
- Figure 1.2: ML Pipeline / Data Flow
- Figure 1.3: System Flowchart (Alert Generation)
- Figure 1.4: Mobile App Screens (Dashboard, Patient Detail, Risk Analyzer)
- Figure 1.5: Complete System Operation (Demo Flow)

---

# 7. List of Tables

- Table 1.1: Hardware Requirements
- Table 1.2: Software Requirements
- Table 1.3: Risk Bands & Thresholds
- Table 1.4: API Endpoints / Network Calls
- Table 1.5: Test Cases
- Table 1.6: Model Evaluation Results

---

# 8. Introduction, Background & Problem Statement

## Introduction

Patient monitoring is a central part of hospital care. Patients admitted to wards are
connected to bedside monitors that continuously record vital signs — **oxygen saturation
(SpO₂), heart rate, respiratory rate, temperature, blood pressure, and more** — the same way
the example smart-dustbin system combines a sensor and a controller. The challenge is not
collecting these numbers; it is **interpreting them in time**.

The problem SentinelCare addresses is called **clinical deterioration**: a patient's
condition quietly worsening over hours. The warning signs are subtle — a small dip in
oxygen, a slightly faster heartbeat — and can easily be missed when one doctor is
responsible for many beds. If caught **early**, deterioration is often treatable; if missed,
it can progress to a coma or even death.

## Problem Statement

The objective is to develop a system that (1) **continuously ingests patient
observations** (vitals + labs + context), (2) **computes a live risk score (0–100%)** for
deterioration using machine-learning models trained on real hospital data, and (3) **raises
an alert** the moment a patient's risk crosses a danger threshold — so a clinician is
notified *while there is still time to act*.

---

# 9. Motivation & Objectives

## Motivation

The project is motivated by three facts:
- **Workload:** India has roughly one doctor per 811 people (Union Health Ministry, 2024–26);
  a single doctor may monitor many beds on many wards at once.
- **Detectability:** Up to ~70% of in-hospital cardiac arrests show abnormal vital signs in
  the **hours before** the event — the warning is present, but easy to miss.
- **Impact:** Early recognition lets care teams respond before a crisis; delayed recognition
  dramatically raises mortality and ICU burden.

## Objectives

- To build a backend server (FastAPI) that holds patient data and runs a real ML inference
  pipeline.
- To train a **temporal (time-series)** model and a **static (point-in-time)** model on a
  real hospital deterioration dataset.
- To compute a live, explainable risk score (0–100%) for every patient every few seconds.
- To raise and log an **alert** when risk crosses the danger threshold (50%).
- To provide a **mobile dashboard** (React Native / Expo) that shows risk, alerts, a
  simulator, and a risk analyzer.
- To demonstrate how real patient observations can drive automated early-warning alerts.

---

# 10. Scope & Existing vs. Proposed System

## Scope

The prototype can be used to demonstrate AI-assisted early-warning monitoring on a local
network in homes, classrooms, and lab/college settings. It includes a full demo environment:
16 real patient profiles, a simulator, an alert workflow, and a risk analyzer.

## Existing System

Traditional ward monitoring relies on **manual review** of vitals by clinical staff. There
is no automated, machine-learned risk scoring; warning signs may be missed under workload,
and no systematic alerting exists at the prototype level.

## Proposed System

The proposed system uses **machine-learning models** to continuously score each patient's
deterioration risk from their live observations and **automatically raises an alert** when
risk crosses a threshold — reducing reliance on manual recognition and providing an early,
consistent warning signal to the care team.

---

# 11. System Requirements

## Table 1.1: Hardware Requirements

| Component | Purpose |
|---|---|
| Computer / Laptop (Windows or macOS) | Runs the backend server ("the brain") |
| Android phone | Runs the mobile app (via Expo Go) |
| Wi-Fi network (shared) | Lets the phone reach the server on the local network |

## Table 1.2: Software Requirements

| Category | Software / Version |
|---|---|
| Language (backend) | Python 3.12 |
| Backend framework | FastAPI (≥0.111), Uvicorn (≥0.30) |
| Data / ML libraries | pandas ≥2.1, numpy ≥1.26, scikit-learn ≥1.9, pyarrow ≥15 |
| Other backend | pydantic ≥2.7, google-auth ≥2.30, pytest ≥8 |
| Language (mobile) | JavaScript (React 18.2, React Native 0.74.5) |
| Mobile framework | Expo SDK ~51, Expo Go app, React Navigation |
| Mobile packages | expo-notifications, expo-device, expo-constants, reanimated, safe-area-context, screens |
| Operating system | macOS / Windows (developer machine), Android (device) |

---

# 12. Component & System Module Descriptions

*Analogous to the "component descriptions" of the example: each module plays a defined role.*

**Dataset (real).** ~418,000 hourly observation rows from ~10,000 hospital patients
(public `hospital-deterioration` dataset), including 28 columns — 6 vitals (SpO₂, HR, RR,
temp, systolic/diastolic BP), oxygen support, mobility, nurse alert, labs (lactate, WBC,
creatinine, CRP, hemoglobin), sepsis-risk, demographics, and the target
`deterioration_next_12h`.

**Feature Engineering.** Converts raw observations into model-ready features: for 12 core
signals it derives 9 trend features each (previous value, 1h/3h change, rolling mean/std/min
/max, slope) → **134 total features** for the temporal model; a separate 22-feature set for
the static model.

**Temporal (time-series) ML model.** Random Forest (200 trees) with sigmoid calibration,
trained on the engineered features, patient-level 70/15/15 split (no leakage). Captures the
**trend** of a patient's vitals over the last hours.

**Static (point-in-time) ML model.** Random Forest-V3 (25 trees, leaf 8), trained on a
single observation snapshot (22 features). Captures the **current level** of risk.

**Backend server (FastAPI).** Holds patient data + simulator state in memory, runs the ML
pipeline (`risk = max(temporal, static)`), creates/acknowledges/clears alerts, and assigns
the least-loaded doctor.

**Mobile app (Expo RN).** The clinician's dashboard: Home (Command Center), Patient Detail,
Alerts Centre, Simulator, and Test Risk Analysis. Polls the server every ~5–6 s.

**Alerting / Notifications.** On threshold-crossing, logs an alert, vibrates the phone, and
shows an in-app alarm banner (primary) plus an optional Expo/FCM push (default `log` mode).

---

# 13. Data & Configuration (the "Pin Configuration" equivalent)

*Instead of wiring pins, this project wires **data fields** and **thresholds**.*

## Table 1.3: Risk Bands & Thresholds

| Risk Score | Status | Colour |
|---|---|---|
| 0 – 24% | STABLE | Green |
| 25 – 49% | WATCH | Yellow |
| 50 – 74% | HIGH | Orange |
| 75 – 100% | CRITICAL | Red |

**Alert threshold:** risk ≥ **50%** triggers an alert.
**Combination rule:** `risk = max(temporal_risk, static_risk)` (safety bias — higher wins).

## Key Configuration

- **API base URL:** mobile app connects to `http://<computer-IP>:8000/api` (editable in
  `mobile/src/theme.js`).
- **Push mode:** `PUSH_MODE=log` by default (logs only; no external push server needed).
- **Escalation bounds:** escalate when ≥3 CRITICAL patients; a doctor is overloaded at ≥2
  critical patients.

---

# 14. System Architecture & Block Diagram

## Figure 1.1: Overall System Architecture

```
  Real hospital dataset ──► ML pipeline (feature engineering → train 2 models)
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

## Figure 1.2: ML Pipeline / Data Flow

```
Raw observations → clean (drop missing, dedupe) → patient-level 70/15/15 split (seed 42)
→ temporal feature engineering (134 cols) → train RF temporal + calibrate
→ train RF static (22 cols) → evaluate on unseen test → pickled artifacts
```

## Figure 1.3: System Flowchart (Alert Generation)

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

*The analogue of the distance sensor: the source of live readings.*

- The simulator fabricates the "next hour" of a deteriorating patient — drifting SpO₂,
  heart rate, respiratory rate, temperature, BP, lactate, WBC, sepsis risk, oxygen support,
  mobility, and nurse-alert toward a severe profile.
- During a deterioration run, the risk is floored to the value already on the patient card
  so it **climbs monotonically** (never drops mid-run), keeping the displayed % consistent.
- Example condition: *if risk ≥ 50% → create alert; otherwise → keep monitoring.*

---

# 17. "Controller" (Model & Server) Operation

*The analogue of the microcontroller: decides and acts.*

- **Initializes** by loading the trained models and the demo pool.
- **Reads** observations and builds the latest feature vector.
- **Scores** with both models; takes the higher risk.
- **Compares** against the alert threshold.
- **Acts** by creating the alert, assigning a doctor, and triggering the notification.
- **Repeats** continuously, and handles acknowledge/clear/reset.

---

# 18. Software Architecture & Algorithm

1. Start; load models, feature columns, demo pool; start FastAPI server.
2. Receive an observation.
3. Compute temporal risk (recent trend) and static risk (current snapshot).
4. Combine: `risk = max(temporal, static)`.
5. If deteriorating, enforce `risk = max(risk, prior_risk)`.
6. If `risk ≥ 0.50`, create and log an alert, snapshot vitals, assign doctor, notify.
7. Else update the patient card with the lower risk.
8. Support acknowledge, reset, and clear-alerts commands.
9. Repeat continuously (server is a live polling loop from the app's perspective).

---

# 19. Pseudocode & Program Structure

```
START
  load models & feature columns
  load demo patient pool
  start server on port 8000

ENDPOINT evaluate_observation(patient, observation):
    features = build_features(observation history)
    t_risk   = temporal_model.predict(features)
    s_risk   = static_model.predict(snapshot)
    risk     = max(t_risk, s_risk)
    IF deteriorating THEN risk = max(risk, prior_risk)
    update patient card with risk
    IF risk >= 0.50 THEN
        create alert (snapshot vitals, assign doctor)
        notify -> banner + vibration
    END IF
    RETURN risk
END

ENDPOINT acknowledge(alert_id):  set status = COMPLETED
ENDPOINT clear_alerts():         clear alerts; restore affected patients
ENDPOINT reset():                restore all 16 patients; clear alerts
```

---

# 20. System Indications

| Condition | System Status |
|---|---|
| System powered ON / server started | `Application startup complete.` |
| Models loaded | `ML model loaded successfully: RandomForestClassifier` |
| Observation received | `Observation received — Patient: n, deteriorating: True` |
| Risk computed | `Model prediction: 0.51 → HIGH` |
| Alert raised | `Alert created: ALERT-13 for patient 4407 (risk 51.4%)` |
| Phone notification | In-app alarm banner + vibration |
| After acknowledge | Alert moves Pending → Completed |
| After clear/reset | Alerts cleared; patients restored |

---

# 21. Testing & Test Cases

## Table 1.5: Test Cases

| Test ID | Test | Input | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| TC-01 | System startup | Power ON | Server starts, models load | See §22 | PASS |
| TC-02 | Risk-consistency | Deteriorate patient 3360 (card 84%) | Alert risk = 84%, no drop | 0.84 → HIGH | PASS |
| TC-03 | Monotonic risk climb | Deteriorate patient 4407 (8%) | Risk rises 8% → 51% | 8 → 51.4% HIGH | PASS |
| TC-04 | Clear alerts | Clear after alert | Alerts cleared; patient restored | patients_restored = 1 | PASS |
| TC-05 | Risk analyzer (risky) | "Use risky values" | ~91% CRITICAL | 90.9% CRITICAL | PASS |
| TC-06 | Risk analyzer (healthy) | Healthy vitals | Low / STABLE | Low | PASS |
| TC-07 | Automated tests | `pytest tests/ -q` | 6 pass | 6/6 PASS | PASS |

---

# 22. Results & Analysis

## Model Evaluation (published from `data/models/`)

### Temporal + static combined (unseen test set)

| Metric | Value |
|---|---|
| Precision | 0.7648 |
| Recall | 0.5878 |
| F1 | 0.6647 |
| **ROC-AUC** | **0.9526** |
| PR-AUC | 0.6880 |

### Static point-in-time model

| Metric | Value |
|---|---|
| Train ROC-AUC | 0.9947 |
| Test ROC-AUC | 0.9619 |
| Test PR-AUC (APS) | 0.7255 |
| Estimators | 25 (min_samples_leaf 8) |

### Demo / functional results

The simulator successfully drove a stable patient's risk from ~8% upward; the alert fired
at the exact crossing of 50%, and the **alert percentage matched the patient-card
percentage** (consistency verified end-to-end). Clear-alerts correctly reset all affected
patients, and the risk analyzer returned ~91% CRITICAL for a risky profile and low/STABLE
for healthy values.

### Honest limitations

- The alert **lead-time** analysis (mean −4.9 h, median −5 h) shows alerts fire *around*
  the deterioration time but are **not consistently early** (only ~4.8% positive lead).
- "Why flagged" explanations are **rule-based** heuristics, not SHAP attribution.
- Expo Go background notifications may be delayed/hidden; the in-app banner + vibration is
  the reliable alert.

---

# 23. Advantages & Limitations

## Advantages

- Automated, continuous risk scoring — no manual watching of every monitor.
- Uses **real** machine-learned models trained on a real hospital deterioration dataset.
- Provide the "why" (flagged factors) and recommended actions for each alert.
- Consistent, explainable risk (alert % always matches the card %).
- Full working demo: simulator, alerts, acknowledge workflow, risk analyzer.
- Works entirely on local Wi-Fi — no internet dependency.
- Honest, reproducible evaluation (published AUC, precision/recall, lead-time).

## Limitations

- Requires a computer to run the backend and a phone running Expo Go.
- Research prototype, **not** a clinically validated/approved medical device.
- Models are not yet **consistently early** (lead-time limitation).
- Explanations are heuristic, not deep model attributions.
- Backend state is in-memory (restart resets current-session alerts).
- Expo Go background notification delivery is unreliable on some setups.

---

# 24. Future Enhancements & Applications

## Future Enhancements

- **Real-time EMR / monitor integration** to stream live observations instead of simulated.
- Clinician **authentication and role-based access** (doctor/nurse/admin).
- Regulatory-validated, per-facility retrained models + drift monitoring.
- Production push-notification infrastructure (FCM/APNs with delivery guarantees).
- Database-backed persistence, high-availability and audit logging.
- Improve **alert lead-time** (predict earlier) and replace rule-based explanations with
  model attribution (e.g. SHAP).

## Applications

- Hospital in-patient wards & ICUs (future)
- Rapid-Response / Early-Warning clinical decision support
- Telemedicine and remote patient monitoring
- Medical / biomedical engineering education and research
- AI-in-healthcare demonstration and validation studies

---

# 25. Conclusion & References

## Conclusion

SentinelCare demonstrates the practical implementation of **AI-assisted early warning**
using real patient observations, two machine-learning models, a FastAPI server, and a
mobile dashboard. The system continuously computes a patient's deterioration risk (0–100%),
raises an alert when risk crosses the danger threshold, and presents a consistent,
explainable, acknowledge-able alert workflow. The models reach a test ROC-AUC of ~0.95,
confirming their ability to separate deteriorating from stable patients. The project shows
how machine learning can help clinicians spot deterioration early — while clearly
acknowledging that it is a **research demonstration, not a medical device**.

## References

- SentinelCare source code & design docs: `README.md`, `docs/` in the repository
  (SETUP, DEMO, USER_GUIDE, TECHNICAL, STORY, TLDR).
- `hospital-deterioration` dataset (Hugging Face) — public real hospital observations.
- scikit-learn documentation (RandomForest, calibration, metrics).
- FastAPI & Uvicorn documentation.
- React Native / Expo SDK 51 documentation.
- Union Health Ministry (India) doctor-to-population ratio 1:811 (Parliament statement,
  2024–26); WHO recommended minimum 1:1000.
- Clinical-deterioration literature on pre-arrest warning signs (~70% of in-hospital
  cardiac arrests show abnormal vitals in the hours before).

---

# 26. CODE

## Backend — core alert evaluation (simplified, from `backend/app.py`)

```python
# Risk combination + monotonic floor + alert creation
prior_risk = float(p.get('risk_probability', 0.0))
temporal_risk, _ = predict_risk(obs_df)        # time-series model
static_risk,  _  = predict_risk_static(new_obs) # point-in-time model
risk = round(max(temporal_risk, static_risk), 4)

if state['deteriorating']:                     # never drop mid-run
    risk = max(risk, prior_risk)

status = get_risk_status(risk)                 # STABLE/WATCH/HIGH/CRITICAL
state['risk_history'].append(risk)

if risk >= ALERT_THRESHOLD and (...) :         # 0.50
    alert = create_alert(patient, risk, vitals)  # snapshot + assign doctor
    notify(alert)                                # banner + vibration + push
```

## Mobile — risk analyzer call (from `mobile/src/screens/RiskAnalyzer.js`)

```js
const data = await api.riskAnalyze(values);     // POST /api/risk/analyze
setResult(data);                                // risk_probability, status, factors, recs
```

## Backend — server startup (from `docs/` / runbook)

```bash
cd backend
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000
```

---
*End of project documentation. Full implementation, API reference, and model details: see
`docs/TECHNICAL.md`.*
