# Demo Guide — Presenting SentinelCare

This is a speaker-ready script. You can run the **5-minute**, **10-minute**, or
**20-minute** versions — they all follow the same story.

> **Before you start (do this 5 minutes before the audience arrives):**
>
> 1. Backend running — see "Running it again tomorrow" in [SETUP.md](SETUP.md).
> 2. App connected — open Expo Go, scan the QR, and confirm the Home screen loads.
> 3. **Reset the demo** — open **Alerts Center → Clear all**, or use **Run Simulator → Reset**
>    on the Home quick actions. This guarantees a clean, empty alerts list.
> 4. Background the app so alerts work smoothly, and put the phone on loud + vibrate.

---

## The story you're telling

> "Every year, hospital patients can deteriorate silently — the warning signs appear hours
> before an emergency. **SentinelCare** is a research prototype showing how AI could watch
> every patient's vitals, score their risk, and alert staff the moment a patient starts to
> get worse. It is a demonstration of an early-warning concept — not a medical device."

This one sentence plus the live demo below is the whole pitch.

---

## 10-minute version (recommended)

### 1. Home screen — "everything at a glance" ~1 min

Say: *"This is what a doctor sees when they open SentinelCare — every patient in the
hospital, colour-coded by risk."*

- Point to the header: total patients monitored, number of critical patients.
- Point to the four stat cards: **Stable · Watch · High Risk · Critical**.
- Point to **"N patients requiring attention"** (the HIGH/CRITICAL queue).

**Tap** one of the priority (red/orange) patient cards.

### 2. Patient detail — "the story of one patient" ~2 min

Say: *"Here's one patient who needs attention right now."*

- The big number is the model's **risk score** (e.g. 84%) with a status pill.
- **Current observations** — SpO₂, heart rate, breathing rate, temperature, blood pressure
  (fields turn orange/red when dangerous).
- **Risk trajectory** — the risk bar and the natural-language line: *"The bar shows how far
  this patient's risk has climbed… Right now it's 84% — getting worse."*
- **Why this patient was flagged** — the vitals that changed most (e.g. SpO₂ down, heart
  rate up). Say: *"The system explains itself — it doesn't just say 'high risk', it says
  what pushed the risk up."*
- **Recommended actions** — e.g. *"Start supplemental oxygen"*. Say: *"And it suggests next
  steps for the care team, highest priority first."*

**Press back.**

### 3. Test Risk Analysis — "try the AI yourself" ~2 min (optional but very impressive)

Say: *"Now let's use the AI the way a clinician might — type in any patient's readings and
see the model in action."*

**Tap "Test Risk Analysis"** (Home → quick actions).

- **Tap "Use risky values"** — the form fills with a deterioration profile.
- **Tap "Analyze Risk"**.
- The bedside-monitor panel appears: an ECG line, HR/SpO₂/RR/BP/TEMP readouts, and a
  **~91 % CRITICAL** score.
- Show the explanation factors ("lactate ↑, heart rate ↑…") and the recommended actions.

Say: *"Notice the model explains its reasoning — no black box. This is powered by real
machine-learning, trained on a real hospital dataset."*

**Press back.**

### 4. Run Simulator — "the hero moment: an alert is created live" ~3 min

Say: *"The strongest way to show this is to watch a patient get worse in real time and see
the system react. SentinelCare simulates the next few hours of a stable patient."*

**Tap "Run Simulator".**

- The list shows patients with **no active alert**. Each row has a button: healthy patients
  show a disabled **"● Stable"** button; the others (e.g. **Risk ~8% · WATCH**) show
  **"Create Alert"**. Pick one with a **Create Alert** button and tap it. If every patient
  says Stable, tap **Reset** (top right) to restore the pool first, then try again.
- As you tap, say: *"Watch the risk climb…"* A live line shows **"Risk climbing… 8 % → … → 51 %"**.
- The phone **vibrates** and a red **alert banner** drops from the top: *"PATIENT … — HIGH
  RISK 51%"* with SpO₂ and heart rate.

Say: *"And there it is — the system just detected a deteriorating patient and raised the
alarm. A doctor has been notified."*

- The same percentage (51%) is shown in the banner, in the simulator result, and now in
  **Home → Recent Alerts** as a **pending** alert. Consistency is the point.

**Tap the banner to acknowledge it.**

- The banner turns **green**: *"Alert acknowledged"*, and a confirmation message appears.
- Back in Home, Recent Alerts is empty (the alert moved to **Completed**).

Say: *"The clinician acknowledges the alert — it moves from Pending to Completed. The loop
is closed: detect → notify → acknowledge → act."*

### 5. Alerts Centre + reset — "keep control" ~1 min

**Tap "Alerts Center"**:

- Show the **Pending / Completed** filters.
- Open **All**: the alert you created is there as Completed with its risk and timestamp.
- Mention the **Clear all** button: *"One tap clears the alerts and puts every affected
  patient back to their original state — perfect for re-running the demo."*

**End.** Ask *"Any questions?"*

---

## 5-minute version

Cut sections 3 (Test Risk Analysis) and, optionally, part of 2. The flow becomes:
Home → critical patient → **Run Simulator → Create Alert → vibration + banner →
acknowledge (green)** → done. Everything else the same.

---

## 20-minute version

The 10-minute version, plus:

- After step 2, open a **Watch/yellow** and a **Stable/green** patient so audiences see the
  full colour spectrum and how calm patients look in the app.
- In the Alerts Centre, create **two** alerts back-to-back in the Simulator and show the
  priority list filling up, then **Clear all**.
- In Test Risk Analysis, type healthy values (use the toggle **off**) and show the model
  scores it low/stable — a before/after demo of model sensitivity.
- Spend more time on "why flagged" and "recommended actions" per patient.

---

## Advanced tips for a smoother demo

- **Re-run safely:** to run the Simulator again after an alert, first **Clear all** in the
  Alerts Centre (or Reset in the Simulator). This restores the 16 patients to their
  original risk so you get a stable low-risk patient to deteriorate again.
- **Vibration reliability:** keep the phone on loud/vibrate and ensure the app is onscreen
  when you tap Create Alert. The banner + vibration fire the instant the alert is created.
- **Live polling:** the app refreshes itself every few seconds; you don't need to shake or
  reload during the presentation.
- **If the app disconnects mid-demo:** the phone shows "Connection unavailable — retrying".
  It reconnects automatically when the laptop/phone rejoin the same Wi-Fi. See
  [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

---

## What to say if asked "is this real?"

Honest, one-line answers:

| Question | Answer |
|---|---|
| "Is this a real product?" | "It's a **research prototype** — a demonstration of a concept." |
| "Are the patients real?" | "The 16 profiles come from **real** (historical, anonymised) hospital observations, but you're watching a **simulation** of them being monitored." |
| "Is the AI real?" | "Yes — two machine-learning models trained on a **real hospital deterioration dataset**." But it is a research model, not clinically validated. |
| "Would this work in my hospital?" | "A real deployment would additionally need live connections to hospital systems, doctor authentication, validated/approved AI, and real push-notification infrastructure." |

Full details in the **[Technical overview](TECHNICAL.md)**.