# TL;DR — SentinelCare for the Client

The whole project on one page. You don't need to read the other docs to get started — this
is everything to **clone, run, see, test, and understand** the demo.

---

## 1 · What is it (30 seconds)

A **research prototype** of an AI early-warning system for hospitals. It watches patients'
vitals (oxygen, heart rate, breathing, blood pressure, temperature), uses **machine
learning trained on real hospital data** to score each patient's **risk 0–100%** every few
seconds, and **raises an alert + vibrates the phone** the instant a patient's risk climbs
past the danger line — so a doctor is told *early*, while the numbers still look normal.

**Two pieces:** a backend server ("the brain") on your computer, and a phone app ("the
view") inside Expo Go.

> The AI is **real**. The living hospital is **simulated** (16 real patient profiles +
> a simulator that fabricates the next hours). It is **not a medical device.**

---

## 2 · Clone

```bash
git clone https://github.com/sravankumar21/sentinelcare.git
cd sentinelcare
```

(No Git? Download this repo as a ZIP and unzip it instead.)

---

## 3 · Run (two terminals, once each)

One-time install first (in the project folder):

```bash
python3 -m pip install -r requirements.txt   # backend libraries
cd mobile && npm install && cd ..            # app libraries
```

**Terminal 1 — the backend ("the brain"):**

```bash
cd backend
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000
```

Wait for the line **`Application startup complete.`** (10–20 s — the AI loads).

**Terminal 2 — the app:**

```bash
cd mobile
npx expo start
```

Scan the **QR code** with the **Expo Go** app on your phone (same Wi-Fi as the computer).
If the app can't connect, your computer's IP changed — see docs/SETUP.md (edit the IP in
`mobile/src/theme.js`; the current one is `192.168.31.123:8000/api`).

---

## 4 · See (the 3-minute demo)

1. **Home** — the whole hospital at a glance: colour-coded risk, priority queue of the
   sickest patients.
2. Tap a **red (critical) patient** — vitals, a risk meter, *why* they were flagged, and
   recommended next steps.
3. **Run Simulator → Create Alert** — pick a patient showing ~8% risk, start, and watch it
   climb live … **8% → 24% → 51%**. The instant it crosses 50%: **phone vibrates, red alert
   banner drops**.
4. Tap the banner to **acknowledge** it (moves Pending → Completed).
5. **Test Risk Analysis → Use risky values → Analyze** — watch the model score a sick
   profile at ~**91% CRITICAL** and explain why.

Full speaker script: [docs/DEMO.md](DEMO.md).

---

## 5 · Test (quick sanity checks)

- **Risk is consistent:** the % you see on the alert banner, the simulator result, and the
  Home alert are **the same number** (built that way on purpose).
- **Clear & reset:** Simulator → **Reset**, or Alerts Centre → **Clear all**, restores the
  16 patients so you can re-run the demo fresh.
- **Vitals > risk:** type healthy values in Test Risk Analysis → low/stable score; type
  risky values → high/critical. The model responds.
- **Automated tests:** `python3 -m pytest tests/ -q` → 6 pass.

---

## 6 · Understand (the honest 60-second version)

| Layer | What it is |
|---|---|
| **Backend (FastAPI)** | Holds patient data in memory, runs the real ML pipeline, creates/acknowledges/clears alerts. |
| **Mobile app (Expo RN)** | The doctor's dashboard; polls the backend every ~5–6 s; shows risk, alerts, simulator, risk analyzer. |
| **Two ML models** | Time-series (recent trend) + point-in-time (current snapshot); **higher score wins** (safety choice). Trained on **~418,000 observations of 10,000 real patients**. Test ROC-AUC ≈ **0.95**. |
| **Alert logic** | Risk crosses **50%** → alert with vitals snapshot + doctor assignment + recommended actions. |

**Honest limits:** models alert *around* the time of deterioration but aren't consistently
early yet; "why flagged" explanations are rule-based (not SHAP); in-app banner/vibration is
the reliable alert (Expo Go background notifications may be delayed). A real hospital would
need live EMR/monitor feeds, doctor authentication, regulatory validation, and production
push — none of which are in this prototype.

---

## Docs index

| Doc | Use it for |
|---|---|
| [STORY.md](STORY.md) | The narrative "why" — great for introducing the idea |
| [SETUP.md](SETUP.md) | Full beginner setup, first time |
| [DEMO.md](DEMO.md) | The exact presentation script |
| [USER_GUIDE.md](USER_GUIDE.md) | Every screen explained |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | "It doesn't work" fixes |
| [TECHNICAL.md](TECHNICAL.md) | Architecture, ML, API for developers |