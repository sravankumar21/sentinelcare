# The Story Behind SentinelCare

> This is a **story**, written to explain *why* SentinelCare exists and *what it does* — the
> sort of opening you can tell a client, a lecturer, or a demo audience in 2–3 minutes.
> It uses a made-up hospital visit to make the idea concrete. The statistics quoted are
> **real** (sources at the end); the hospital, doctors and patients are a **scenario** to
> help you picture it — not a real case.

---

## Act 1 — A busy hospital, and one doctor with too many beds

Let's walk into a busy hospital. Let's call it **Gandhi Hospital, Hyderabad** — a busy
general hospital, the kind where the corridors are full, every bed in every ward is taken,
and a single junior doctor is juggling a dozen patients who were admitted overnight, at
different times, to different wards — the ICU, Ward A, Ward B, Ward C.

Here's the reality that doctor is living with. India's national average is about **one
doctor for every 811 people** — that's the Union Health Ministry's own number, and it
*looks* good because the World Health Organization's recommended minimum is 1:1000. But
averages hide the truth: doctors cluster in cities, so in some states the real number is
closer to **one doctor for every 13,000 people**, and roughly **70% of doctors work in
urban areas that hold only about 30% of the population**.

So this one doctor is covering a lot of beds. Each of those 12 patients is connected to a
monitor — the kind with the ECG trace — that quietly reports **oxygen level, heart rate,
breathing rate, blood pressure, temperature**. Twelve patients, twelve screens, fifty-odd
numbers ticking every second.

No human being can truly watch fifty numbers at once. So things get missed.

---

## Act 2 — The danger that hides in the numbers

Here's the scariest part, and it's a well-documented medical finding: **in-hospital
cardiac arrests rarely come out of nowhere.** Research shows that **up to about 70% of
patients who have a cardiac arrest in hospital had clear warning signs — abnormal vital
signs — in the hours before it happened.**

Hours. Not minutes.

The oxygen creeps down. The heart starts beating a little faster to compensate. Breathing
quickens. Blood pressure edges down. By themselves each change looks tiny, normal even.
But together, they are the body quietly signalling: *something is wrong — the organs are
starting to struggle.*

If nothing is done, deterioration can roll on — sometimes to a coma, sometimes to death.
But if a doctor catches it in those hours, it's often treatable: oxygen, fluids, a
medication, moving the patient to a higher level of care. **The difference between a
routine fix and a catastrophe is noticing — early.**

And that's exactly what a tired, busy doctor with fifty numbers on twelve screens can
struggle to do.

---

## Act 3 — What if the machine watched the numbers for us?

That's the question SentinelCare answers.

What if we gave the machine — the computer — the job of watching every single number, every
second, for every patient, and learning what "getting worse" looks like? Then the doctor
isn't trying to watch fifty numbers. The machine watches them all, and it **raises its hand
only when something is actually wrong** — a moment a doctor can act on.

That's the whole idea in one line:

> **SentinelCare learns the subtle pattern of deterioration from real hospital data, and
> tells the doctor the moment a patient's risk starts to climb — while there is still time
> to do something about it.**

---

## Act 4 — The machine we built: two "brains", one score

Under the hood, SentinelCare doesn't guess. It uses **machine learning** — two models
trained on a **real hospital deterioration dataset** of roughly **418,000 hourly
observations from 10,000 patients**, including patients who genuinely deteriorated and
patients who did not.

| Brain | What it does |
|---|---|
| **Time-series model** | Learns from the patient's **recent history** — the trend of their oxygen, heart rate, breathing, blood pressure *over the last few hours*. Catch the *direction* of change. |
| **Point-in-time model** | Looks at the patient's **current readings** as a snapshot — their vitals, labs, age, and context *right now*. Catch the *level* of risk. |
| **Combined score** | The system takes the **higher of the two** as the final risk score (a deliberate safety choice — err on the side of alarm). |

Out pops a **risk score from 0% to 100%** for every patient, every few seconds. Low is
healthy. High is deteriorating.

The models are evaluated honestly against data they never trained on:
- the combined model reaches a **test ROC-AUC of about 0.95** — it separates who is
  deteriorating from who isn't far better than chance;
- and one honest limitation we publish openly: it alerts *around* the time of
  deterioration but is **not consistently early** yet — that's future work, not a claim we
  make today.

---

## Act 5 — The catch, and the app that fixes it

Here's the honest catch in a research project: **we can't afford the advanced bedside
monitors and live hospital feeds that a real hospital would use to pump live data into the
model.** A real deployment would plug into hospital monitoring and electronic health record
systems worth millions. For a demo — and to *prove the idea works* — we needed a way to
send the model real, realistic patient data to watch in real time.

So we built the **SentinelCare phone app**. It plays two roles:

1. **It is the "live monitor" stand-in.** It starts from **16 real patient profiles**
   (actual patients from the same dataset, with their real observations). The app includes
   a **Simulator** that fabricates "the next few hours" of a patient's vitals — the oxygen
   creeping down, the heart speeding up — exactly the way a real deteriorated patient's
   monitor would. That feeds the real model, which computes real risk in real time.
2. **It is the doctor's screen.** It shows every patient's risk on a colour-coded
   dashboard, lets you drill into one patient to see *why* they were flagged and what to
   do, and — the key moment — **raises an alert the instant a simulated patient's risk
   crosses the danger threshold**: the phone vibrates, a red alarm banner drops in, and the
   alert is logged, ready to be acknowledged, exactly like a real clinical alert workflow.

So the demo tells the whole story end to end: *a patient deteriorates, the model sees it
in the numbers, and the doctor is told — in time.*

---

## Act 6 — The demo in "real time"

In the ~3-minute demonstration you watch this happen live:

1. **Home screen** — the whole "hospital" at a glance: every patient colour-coded, a
   priority queue of the sickest, and a live risk bar and trend arrow for each.
2. **Open a critical patient** — vitals, a risk meter, the natural-language reason they
   were flagged ("SpO₂ down, heart rate up"), and recommended next steps.
3. **Run Simulator → Create Alert** — pick a patient who looks fine (risk ~8%), start the
   simulation, and watch the risk climb in front of the audience: 8% → 24% → 51%. The
   instant it crosses the alert line, **the phone vibrates and a red alert banner drops**.
4. **Acknowledge** — tap the banner; the alert moves from Pending to Completed, the loop
   closed: *detect → notify → acknowledge → act*.
5. **Test Risk Analysis** — type in any vitals, tap "Use risky values", and watch the model
   score an obviously-sick profile at ~91% CRITICAL and explain why.

---

## The honest bottom line

- **The AI is real.** Real models, trained on a real hospital deterioration dataset.
- **The living hospital is simulated.** The 16 patient profiles are real people from that
  dataset, but the "hours passing" in the simulator are generated so you can watch an alert
  being created live.
- **It is a research/educational prototype, not a medical device.** Risk scores must never
  be used to make clinical decisions. A real hospital would additionally need live feeds
  from its monitoring/EMR systems, genuine clinician authentication and roles,
  regulatorily-validated AI, and real push-notification infrastructure.

**SentinelCare is a proving-ground for one idea:** that a machine, watching the numbers a
busy doctor can't watch, can flag deterioration early enough to make a difference.

---

## The statistics used (real — with sources)

| Statistic | Figure | Source |
|---|---|---|
| India's doctor-to-population ratio | ~**1 : 811** (national average, 80%-availability assumption) | Union Health Ministry statement to Parliament (Lok Sabha / Rajya Sabha), reported by PTI & major outlets (2024–2026) |
| WHO recommended minimum | **1 : 1,000** | World Health Organization workforce norm |
| Urban vs rural doctor distribution | ~**70% of doctors** in urban areas holding ~**30%** of the population | India Today analysis of Ministry data, Dec 2025 |
| Worst-state doctor availability | ~**1 : 13,000+** (e.g. Nagaland ~1:13,514) vs ~1:335 (Goa) | India Today state-wise analysis, 2024 projected populations |
| Patients with warning signs **before** in-hospital cardiac arrest | **up to ~70%** showed abnormal vital signs in the **hours before** | Reviews of in-hospital cardiac-arrest data (e.g. reported across clinical deterioration literature / nurse.com summary citing U-Conn. dissertation; many other studies report similar 60–70% ranges) |

> **Why we keep the hospital "made-up":** the scenario is imaginary on purpose — we never
> claim real Gandhi-Hospital patients or real monitor feeds. Only the **statistics** and the
> **training dataset** are real. This keeps the story honest with clients and lecturers.

---

- Next: see **[TLDR.md](TLDR.md)** for the 1-page "clone, run, see" handover, or
  **[DEMO.md](DEMO.md)** for the exact presentation script.