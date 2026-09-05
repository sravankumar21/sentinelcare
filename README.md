# SentinelCare

**AI-Powered Early Warning System for Hospital Deterioration Risk**

SentinelCare is a research prototype that helps hospital staff spot patients who are
quietly getting worse — before it becomes an emergency. It watches a patient's vitals,
uses a machine-learning model trained on **real hospital data**, and raises an alert the
moment a patient's risk of deterioration starts to climb.

> **Please read this first.** SentinelCare is an **educational / research prototype**.
> It is **not** a replacement for doctors or nurses, and it is **not** a validated
> medical device. It is a demonstration of how AI could support a hospital early-warning
> system. Risk scores must never be used to make clinical decisions.
>
> Everything you see is built from either real (but anonymised/old) hospital
> observations or clearly-labelled simulations. See [What is real and what is simulated](#what-is-real-and-what-is-simulated).

> **New here?** If you're about to present or pitch this project, start with
> **[docs/STORY.md](docs/STORY.md)** — it tells the "why" as a short narrative you can
> speak in 2–3 minutes. For the quickest practical handover, read
> **[docs/TLDR.md](docs/TLDR.md)** (one page: clone, run, see, test, understand).

---

## What problem does it solve?

In a real hospital, the signs that a patient is deteriorating often appear **hours**
before the emergency: oxygen drops, the heart beats faster, blood pressure starts to
fall. By the time the alarm is obvious, the window for early treatment may be gone.

SentinelCare demonstrates how this could work:

1. A patient's vitals (oxygen, heart rate, breathing rate, temperature, blood pressure)
   are monitored continuously.
2. A machine-learning model, trained on real hospital deterioration records, computes a
   **risk score** (0% – 100%) for each patient.
3. When a patient's risk crosses an alert threshold, an **alert** is raised, a doctor is
   assigned, and recommended next steps are generated.
4. Staff can see every patient's risk at a glance, understand *why* a patient was flagged,
   and confirm ("acknowledge") each alert.

---

## The system at a glance

SentinelCare is two pieces of software that talk to each other over your Wi-Fi:

| Piece | What it is | Where it lives |
|---|---|---|
| **The brain (backend)** | A server that holds the patient data, runs the AI model, and creates alerts | Runs on the computer doing the demo |
| **The app (mobile)** | The doctor's/nurse's view on a phone — dashboards, alerts, simulator, risk analyzer | Runs inside the **Expo Go** app on an Android phone |

You control the demo from the **phone app**. The computer runs the backend silently in the background.

---

## Quick start (3 steps)

Full, beginner-friendly instructions are in **[docs/SETUP.md](docs/SETUP.md)** with every detail.

1. **Install the required software** on the demo computer —
   [Python 3.12](https://www.python.org/downloads/), [Node.js](https://nodejs.org/), and the
   **Expo Go** app on the phone.
2. **Start the backend** (the "brain") on the computer, and **start the app** with Expo —
   both commands are in the setup guide.
3. **Scan the QR code** shown in the terminal with **Expo Go** on the phone.

That's it. The app loads ~16 real patient profiles and you can run the full demonstration.

---

## What can you do with it?

- **See every patient's risk at a glance** (Home screen) — colour-coded dashboard, priority
  queues, live risk bars and trend arrows.
- **Drill into one patient** (Patient Detail) — full vitals, an easy-to-read **risk bar**,
  *why* the patient was flagged, and recommended next steps for the care team.
- **Alerts Centre** — every alert with Pending / Completed status, acknowledge alerts,
  or clear the whole list.
- **Run Simulator** — pick a patient and "simulate" a deterioration over the next hours;
  watch the risk climb in real time until the system raises an alert, vibrates the phone,
  and notifies the assigned doctor.
- **Test Risk Analysis** — type in any set of vitals (SpO₂, heart rate, labs, …) and watch
  the AI model score the patient instantly, explain what pushed the risk up, and list
  recommended actions. A "Use risky values" switch shows a high-risk example in one tap.
- **Acknowledge alerts** with visible confirmation — alerts move from Pending to Completed.
- **Reset** any time — puts every patient back to their original state for a clean demo.

A ready-to-follow script is in **[docs/DEMO.md](docs/DEMO.md)** — the exact flow used to
present SentinelCare at a college demo, from start to finish.

---

## Ideas for presenting the demo (10 minutes)

If you have almost no time, this is the version that shows the most impact:

1. Open the app → Home screen shows the dashboard and "patients requiring attention".
2. Tap a **critical patient** (red) → see vitals, the risk bar, *why* they were flagged,
   and recommended actions.
3. Go to **Run Simulator** → pick a healthier patient → **Create Alert** → watch the risk
   climb live, the phone vibrates, an alert banner drops in, and the alert appears in
   Home → Alerts.
4. Tap the banner to **acknowledge** it → it moves to Completed.
5. Open **Test Risk Analysis** → tap "Use risky values" → **Analyze Risk** → see the model
   score ~91% CRITICAL and explain why.

Step-by-step speaker notes for this flow are in **[docs/DEMO.md](docs/DEMO.md)**.

---

## What is real and what is simulated

SentinelCare deliberately mixes three layers. Each is clearly labelled in this project:

| Layer | What it is | Notes |
|---|---|---|
| **Real** | The **AI models** are trained on a real hospital deterioration dataset (~418,000 observations of ~10,000 patients). The **16 patient profiles** in the demo are real patients drawn from that same dataset (their actual last-12-hours of observations). | See the ML chapter in [docs/TECHNICAL.md](docs/TECHNICAL.md). |
| **Simulated** | The **Run Simulator** feature generates future observations for a patient (as if they were monitored over the coming hours) so you can watch an alert being created live. The **bedside monitor** (ECG line) is a visual simulation. "Test Risk Analysis" lets you enter any values to try the model. Alerts, doctors, wards, and hospitals are simplified demo structures. | Labelled in-app: "Research / Demonstration Model", "LEAD II — DEMO". |
| **Required for a real hospital** | Real-time connections to hospital monitoring/EMR systems, clinician authentication and roles, validated & locally-approved AI (regulatory clearance), real push-notification infrastructure, security and audit, and ongoing clinical review. | None of this is part of this prototype. |

In short: **the AI is real, the living hospital is simulated.** Always present it that way.

---

## How it works under the hood (one paragraph)

The mobile app polls the backend a few times a minute. The backend holds the patient data
in memory, and every new observation goes through the same machine-learning pipeline:
a time-series model and a point-in-time model each score the patient, and the higher score
wins (a deliberate safety choice). If the score crosses 50% risk, an alert is created that
snapshots the patient's vitals, assigns the least-busy doctor, and triggers the phone's
alarm (vibration + banner). Everything works on your local Wi-Fi; nothing is sent to the
internet.

For the full architecture, API list, and ML details, see **[docs/TECHNICAL.md](docs/TECHNICAL.md)**.

---

## Project structure

```
SentinelCare/
├── README.md                 ← you are here
├── docs/                     ← setup, story, demo, user guide, troubleshooting, technical
│   ├── TLDR.md               ← 1-page client handover: clone, run, see, test, understand
│   ├── STORY.md              ← the narrative "why" behind the project (great for pitching)
│   ├── SETUP.md              ← install everything and run it
│   ├── DEMO.md               ← step-by-step demonstration script
│   ├── USER_GUIDE.md         ← what every screen does
│   ├── TROUBLESHOOTING.md    ← common problems and fixes
│   └── TECHNICAL.md          ← architecture, ML details, API reference
├── backend/
│   ├── app.py                ← the FastAPI server ("the brain")
│   ├── demo_pool.json        ← the 16 real patient profiles
│   └── build_demo_pool.py    ← tool that built the patient pool
├── mobile/
│   ├── App.js                ← Expo app entry point
│   └── src/                  ← screens, components, services
├── ml/
│   ├── data_processing.py    ← load & clean the dataset
│   ├── feature_engineering.py← build the time-series features
│   ├── model_training.py     ← train & evaluate the temporal model
│   └── train_static_model.py ← train & evaluate the point-in-time model
├── data/
│   ├── dataset.parquet       ← raw real hospital dataset
│   └── models/               ← trained models + evaluation results
├── tests/                    ← automated tests (run with pytest)
└── requirements.txt          ← Python packages needed by the backend
```

---

## Documentation index

| Guide | Audience | What it covers |
|---|---|---|
| **[TL;DR — client handover](docs/TLDR.md)** | Everyone | The whole project on one page: clone, run, see, test, understand |
| **[The story](docs/STORY.md)** | Presenters | A narrative explainer (the "why") for pitching or introducing the idea |
| **[Setup guide](docs/SETUP.md)** | Everyone | Everything you need to install and run the project for the first time |
| **[Demo guide](docs/DEMO.md)** | Presenters | A speaker-ready walkthrough of the full demonstration |
| **[User guide](docs/USER_GUIDE.md)** | Everyone | Every screen and feature explained in plain language |
| **[Troubleshooting](docs/TROUBLESHOOTING.md)** | Everyone | "It doesn't work" → what to check |
| **[Technical overview](docs/TECHNICAL.md)** | Developers | Architecture, ML pipeline, dataset & model results, API reference, what's simulated vs. what a real deployment needs |

---

## Quick commands reference

```bash
# Terminal 1 — start the backend (from the backend/ folder)
cd backend
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000

# Terminal 2 — start the Expo app (from the mobile/ folder)
cd mobile
npx expo start
# then scan the QR code with Expo Go on the same Wi-Fi
```

If the phone cannot connect, your computer's Wi-Fi IP address has changed — see
[Step 6 & 7 of the setup guide](docs/SETUP.md#step-6-find-your-computers-address-on-the-wi-fi)
(edit one line in `mobile/src/theme.js`).

---

## Disclaimer

SentinelCare is an **educational and research prototype** for demonstrating AI-assisted
hospital early-warning concepts. It uses simulated clinical workflows and a model trained
on historical anonymised data. Risk estimates produced by this prototype are **not medical
diagnoses** and must never be used for clinical decision-making. No warranty is provided,
and no regulatory approval has been sought.