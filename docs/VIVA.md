# SentinelCare — Viva Preparation

25 likely questions with short, crisp answers. Read through the night
before; keep each answer under 3 lines.

---

### Q1. What is the project about?

An AI-powered early warning system that continuously monitors ICU patient
vitals and predicts deterioration up to 12 hours in advance. It assigns
doctors, sends real-time alerts on a mobile app, and reduces missed
critical events.

---

### Q2. Why did you choose this problem statement?

Around 70% of in-hospital cardiac arrests show abnormal vitals hours
before the event. India has roughly 1 doctor per 811 people — one
clinician can monitor many beds simultaneously. An automated early
warning system fills this gap by catching deterioration early when
simple interventions (oxygen, fluids, escalation) can save lives.

---

### Q3. Why Random Forest and not Deep Learning or other models?

We tested Logistic Regression vs Random Forest on validation data. RF
scored ROC-AUC 0.9602 vs LR 0.9144. RF handles mixed feature types well,
needs no GPU, trains in minutes, and is explainable — important in a
clinical setting where doctors need to trust the output.

---

### Q4. Why not a neural network / LSTM for temporal data?

LSTMs need far more data per patient and longer training time. Our
dataset has ~10,000 patients with 12-hour windows. Random Forest with
engineered temporal features (rolling means, slopes, deltas) captured
the same trend information at a fraction of the complexity and was the
empirical best performer.

---

### Q5. What dataset did you use?

The public `hospital-deterioration` dataset from Hugging Face — a
MIMIC-like ICU dataset. After cleaning: 417,866 rows, ~10,000 patients,
28 columns, with a 5.4% positive deterioration rate (target:
`deterioration_next_12h`).

---

### Q6. What is the prediction target?

Whether a patient will deteriorate within the next 12 hours
(`deterioration_next_12h` = 1 or 0). This gives clinicians a lead
window to intervene before the event actually happens.

---

### Q7. What is precision? What is your value?

Out of all patients the model flagged as deteriorating, what fraction
actually did. Our combined model: **76.5%** — meaning roughly 1 in 4
alerts is a false positive, which is acceptable for an early warning
system where missing a case is worse than a false alarm.

---

### Q8. What is recall? What is your value?

Out of all patients who actually deteriorated, what fraction did the
model catch. Our combined model: **58.8%**. This is the most important
clinical metric — we catch nearly 6 in 10 deteriorations. The rest are
missed, which is an honest limitation we document.

---

### Q9. What is F1 score and why use it?

The harmonic mean of precision and recall — it balances the trade-off
between catching cases (recall) and avoiding false alarms (precision).
Our F1: **0.665** (66.5%), which is solid for a 5.4% imbalanced
clinical dataset.

---

### Q10. What is ROC-AUC and what does 0.95 mean?

ROC-AUC measures how well the model separates deteriorating from stable
patients across all threshold settings. 0.95 means a 95% chance the
model ranks a random deteriorating patient higher than a random stable
one — near-excellent discrimination.

---

### Q11. What is PR-AUC and why does it matter more here?

Precision-Recall AUC focuses on the minority (positive) class. With only
5.4% positives, ROC-AUC can look inflated. PR-AUC of **0.688** gives a
more honest picture of performance on the rare deteriorating cases.

---

### Q12. Why do you have two models instead of one?

One model (temporal, 134 features) looks at trends over a 12-hour
window. The other (static, 22 features) looks at the current snapshot.
We take `risk = max(temporal, static)` — the higher score wins. This
ensures a sudden acute change (caught by static) isn't diluted by a
stable history, and a gradual decline (caught by temporal) isn't missed
because the snapshot looks okay right now.

---

### Q13. What are the 134 temporal features?

For each of 12 core signals (6 vitals + O₂ flow, lactate, WBC,
creatinine, CRP, hemoglobin): previous value, 1h/3h change, 3h/6h
rolling mean, 3h rolling std, 6h min/max, 3h slope — that's 9 per
signal (108). Plus rolling means for nurse_alert and mobility, 7
derived physiological ratios (SpO₂/HR ratio, MAP, pulse pressure, etc.),
and 3 encoded categoricals = **134**.

---

### Q14. What are the 22 static features?

A single point-in-time snapshot: heart rate, respiratory rate, SpO₂,
temperature, blood pressures, O₂ flow, mobility score, nurse alert,
lab values (WBC, lactate, creatinine, CRP, hemoglobin), sepsis risk
score, age, comorbidity index, baseline risk, LOS hours, and 3
encoded categoricals (gender, admission type, oxygen device).

---

### Q15. What risk thresholds do you use?

Four bands: **STABLE** ≤ 0.24 (green), **WATCH** 0.25–0.49 (yellow),
**HIGH** 0.50–0.74 (orange), **CRITICAL** ≥ 0.75 (red). An alert is
created when risk crosses ≥ 0.50 from below (`ALERT_THRESHOLD = 0.50`).

---

### Q16. How does the escalation logic work?

Each new CRITICAL patient is assigned to the least-loaded on-duty
doctor. If one doctor holds ≥ 2 CRITICAL patients (`PER_DOCTOR_LIMIT`),
a second doctor is added. If ≥ 3 CRITICAL patients exist overall
(`ESCALATION_CRITICAL_LIMIT = 3`), all on-duty doctors share the load.

---

### Q17. What is the lead time — does it predict before or after?

Honest answer: the mean lead time is **−4.86 hours**, meaning alerts
fire roughly around (not consistently before) the deterioration window.
Only ~4.8% of alerts fire early. This is a documented limitation — the
system is better at detecting deterioration is happening than predicting
it hours in advance.

---

### Q18. What tech stack did you use?

**Backend:** FastAPI + uvicorn (Python 3.12), scikit-learn for ML, plain
JSON for state. **Mobile:** React Native + Expo SDK 51, TypeScript,
`@react-navigation/native-stack`. Communication is plain HTTP over local
Wi-Fi — no internet, no database server required.

---

### Q19. Why React Native and not native Android/iOS?

One codebase runs on both Android and Expo Go makes live demos trivial
(reload without rebuild). For a college project this saved weeks of
dual-platform work. In production you'd evaluate native for performance,
but RN was the right trade-off here.

---

### Q20. How does the simulator work for demos?

You pick a patient at ~8% risk (stable). Each "Next Hour" step applies a
deterministic drift toward deterioration targets (SpO₂ ↓, HR ↑, lactate
↑, sepsis score ↑). After ~4–6 steps the model crosses 50%, the phone
vibrates, a red alert banner drops, and the risk shown in the banner,
simulator, and home screen are all identical — proving end-to-end
consistency.

---

### Q21. How does the app know which patients need attention?

The home screen polls the backend every 6 seconds. It sorts patients by
risk (descending) and shows HIGH/CRITICAL patients at the top. Stat
cards show counts per band. Recent Alerts tab shows only PENDING alerts
that need acknowledgement.

---

### Q22. What happens when an alert is created?

The backend assigns the least-loaded on-duty doctor, stores the alert as
PENDING, and sends a push notification (log mode in demo). The mobile
app's AlertWatcher detects the new PENDING alert, triggers a local
notification sound and a red banner drop. The doctor taps to acknowledge
→ status becomes COMPLETED.

---

### Q23. What are the main limitations of this system?

Three honest ones: (1) alerts fire *around* deterioration, not
consistently *before* (mean lead time is negative); (2) recall is 58.8%
— ~41% of deteriorations are missed; (3) push notifications are in
"log mode" (no Firebase configured) so real-time alerts need the app
open. All three are documented in the report.

---

### Q24. What would you do differently / future work?

(1) Integrate Firebase for real push notifications. (2) Add a
rule-based explainability layer that maps risk factors to actual
clinical language (currently a placeholder). (3) Collect real hospital
data and retrain; the current model is trained on public synthetic-like
data. (4) Add a web dashboard for ward-level overview.

---

### Q25. What did you personally build vs. what was already there?

The ML training pipeline, feature engineering, dual-model architecture,
risk scoring, alert escalation, and the entire mobile app (5 screens)
were built from scratch. The dataset is public. The model training
notebooks are provided. Every line of backend logic, every React Native
component, and all 8 documentation files were written by the team.

---

**Tip for the viva:** If you don't know an answer, say so honestly and
offer what you do know. Panels respect honesty over bluffing. Lead with
the real number, then explain what it means.
