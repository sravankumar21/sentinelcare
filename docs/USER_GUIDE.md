# User Guide — SentinelCare App

A plain-language tour of every screen and feature in the mobile app. Read this once and
you'll know what the audience is looking at during the demo.

---

## Colour code for risk (used everywhere)

The app always uses the same four colours:

| Colour | Status | Meaning |
|---|---|---|
| 🟢 Green | **Stable** | Low risk (model score ≤ 24%) |
| 🟡 Yellow | **Watch** | Watch closely (25–49%) |
| 🟠 Orange | **High Risk** | Needs attention (50–74%) |
| 🔴 Red | **Critical** | Urgent — critical review (75%+) |

The **risk score** is a number from 0–100% that the AI model assigns to a patient based on
their vitals and history. 0% = healthy as far as the model can tell; 100% = highest risk.

> The app refreshes everything **by itself every few seconds** — you never need to reload
> during a demo.

---

## 1. Home (Command Center)

The dashboard you land on. It's the "overview of the whole hospital".

- **Header** — total patients monitored and how many are critical.
- **Stat cards** — how many patients are Stable / Watch / High / Critical right now.
- **"N patients requiring attention"** — all High and Critical patients, most urgent first.
  Tap a patient card to open their detail page. Each card shows the patient's bed, risk
  percentage, a small **risk bar**, and a **trend arrow** (`↑↑` risk is rising fast, `↑`
  rising, `→` stable, `↓` improving).
- **Recent Alerts** — the newest **pending** alerts. Tap one to open that patient. "See all"
  takes you to the Alerts Centre.
- **Quick Actions** — three big buttons: **Test Risk Analysis**, **Run Simulator**, and
  **Alerts Center**.
- If the phone can't reach the backend, a banner shows "Connection unavailable — retrying",
  and it recovers automatically.

---

## 2. Patient Detail

Open a patient from home, the simulator, or an alert. It tells the full story of one patient.

- **Header** — patient number, ward, bed, age and gender.
- **Deterioration Risk** — the big risk percentage and status pill, plus a plain-language
  trend line ("Risk is getting worse fast / getting worse / improving / steady").
- **Current Observations** — the six vital signs. Readings turn **orange or red** when they
  are outside normal ranges.
- **Risk Trajectory** — a simple **risk bar** (like a battery meter) showing how far risk has
  climbed, with a Safe/Watch/High/Critical scale underneath.
- **Why This Patient Was Flagged** — the vitals that changed most recently and in which
  direction (e.g. "Heart Rate ↑ 14 change — HIGH"). This is the app "explaining itself".
- **Recommended Actions** — suggested next steps for the care team, highest priority first,
  each with a priority badge (Critical / High / Medium / Low).
- A clinical-review note at the bottom of the page.

---

## 3. Alerts Centre

Every alert the system has raised, newest first.

- **Filters** — All / Pending / Completed.
- **Alert card** — bed + ward, status badge, the alert message, the risk percentage, the
  risk change since the previous reading (e.g. `↑ 49%`), and the timestamp.
- **Acknowledge** — each pending alert has a green **Acknowledge** button. Tap it to confirm
  the alert was seen; it moves to Completed and stays in the list for the record.
- **Clear all** (top right) — removes every alert **and returns all affected patients to
  their original state**. This is the cleanest way to prepare for a fresh demo.

---

## 4. Run Simulator

The demonstration tool. It simulates "the next few hours" of a real patient being watched,
and lets you **watch an alert being created live**.

- The screen lists patients **without an active alert**.
- Tap **Create Alert** on a patient. The sim runs hour by hour; you'll see a live
  **"Risk climbing… 8 % → 24 % → 51 %"** line.
- The moment the risk crosses the alert threshold (50%), the phone **vibrates**, a red
  **alert banner** drops from the top, and the alert appears in `Home → Recent Alerts` and
  the Alerts Centre. The **same risk percentage** is shown everywhere — by design.
- The patient card then shows a result line: *"Alert created — Risk 51%. Matches the alert
  shown in Home."*
- Patients marked **Stable** (green) can't be simulated (button shows "Stable") — they are
  already at low risk; simulate one of the Watch patients instead.
- **Reset** (top right) — restores every patient to their original state and empties the
  alerts, so you can run the simulator again from the start.

> Realistic note to remember: the simulator is **simulated future data** — the AI model is
> real, the "hours passing" are produced by the simulator.

---

## 5. Test Risk Analysis

A calculator style tool: type in **any** vitals and labs and see the AI score the patient
instantly. No simulator, no pre-saved patients — pure model.

- **"Use risky values"** switch — fills the form with a deterioration profile (produces
  roughly a 91% CRITICAL score). Switch it off for healthy values.
- Fields are grouped: Vital Signs, Oxygen Support, Laboratory Values (lactate, WBC,
  creatinine, CRP, hemoglobin), and Patient Context (age, comorbidities, sepsis risk,
  mobility, …).
- **Analyze Risk** runs the model and shows:
  - a live **bedside monitor** (ECG waveform + HR / SpO₂ / RR / NIBP / TEMP / RISK reads),
  - the risk score and a plain-language verdict ("Very high risk — needs urgent review."),
  - the **contributing factors** (which values pushed risk up or down, and by how much),
  - **recommended actions**.
- If the computed risk is High or Critical, a **"Simulate for Patient"** box appears. Tap it
  to write these values onto a (chosen) patient and — if risk ≥ 50% — an **alert is created**
  exactly like the simulator produces (banner + vibration + pending alert in Home).

---

## 6. The alert banner & notifications

When an alert is created, two things happen:

1. **Alert banner (always)** — a red banner slides down from the top with the patient, risk
   %, and key vitals; the **phone vibrates**. Tap the banner to **acknowledge** it — it
   turns green ("Alert acknowledged") with a confirmation message before sliding away. If
   the acknowledgement can't reach the server, the banner says so and lets you retry.
2. **System notification (bonus)** — the phone also schedules a notification. Inside Expo Go
   this is reliable while the app is open; when the app is backgrounded it may be delayed or
   hidden. That's expected — the banner + vibration is the real alert.

Permission: the first time the app runs, allow notifications when the phone asks.

---

## Not covered in the app (by design)

Some capabilities exist in the **backend** only and are not shown in the phone app in this
handover build (e.g. clinical notes with sentiment, per-hospital/doctor views). They are
documented for developers in [TECHNICAL.md](TECHNICAL.md). The mobile app's features above
are the complete demo surface.