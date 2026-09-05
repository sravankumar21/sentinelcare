# Troubleshooting — SentinelCare

The most common problems, what they look like, and what to do.

---

### 1. "Connection unavailable — retrying" in the app

**Cause:** the phone can't reach the backend over Wi-Fi.

Check in this order:
1. **Same Wi-Fi?** Both phone and computer must be on the same network (including the same
   5 GHz/2.4 GHz — some routers split them as different networks).
2. **IP changed?** Re-run the IP command and compare with `mobile/src/theme.js`:
   - macOS: `ipconfig getifaddr en0` · Windows: `ipconfig` (look for IPv4).
   - The file must have `http://<that-IP>:8000/api`. Edit it, save, then press `r` in the
     app terminal.
3. **Backend actually running?** Look at the backend terminal — you should see
   `Uvicorn running on http://0.0.0.0:8000`. If the window was closed, restart it.
4. **Firewall/security software?** Some security software blocks incoming connections on
   port 8000. Temporarily allow it, or try a different network.
5. **Test from the phone's browser:** type `http://<computer-IP>:8000/api/system/status`
   into the phone's browser. If you see a JSON response, the network path is fine and the
   problem is the app's IP setting.

---

### 2. Expo Go shows "SDK … is not supported" / "Incompatible SDK"

**Cause:** the Expo Go app from the Play Store is newer than this project's SDK (51).

**Fix:** download the **SDK 51** version of Expo Go from <https://expo.dev/go>
(version selector → SDK 51 → Android → download APK), allow "install from unknown sources",
and install it. Always launch that Expo Go.

---

### 3. QR code does nothing when scanned

1. Make sure the phone and computer are on the **same Wi-Fi**.
2. Scan with **Expo Go itself** (Android: open Expo Go → scan icon), not only the camera app.
3. If the QR looks too small in the terminal, the terminal may need a **wider window**.
4. If you're using a terminal window that shows a long URL instead of a QR, press
   `Shift` + `I` to switch to interactive mode (`?` in Metro shows the key map), or press
   `enter`.
5. Sometimes pressing `r` in the app terminal re-prints the QR.

---

### 4. Backend won't start / "Address already in use"

**Cause:** port 8000 is already occupied (usually a previous backend still running).

**Fix:**
- macOS: find and stop it: `lsof -iTCP:8000 -sTCP:LISTEN` gives a PID, then
  `kill <PID>`.
- Windows: `netstat -ano | findstr :8000`, then `taskkill /PID <PID> /F`.
- Or run the backend on another port: `python3 -m uvicorn app:app --host 0.0.0.0 --port 8001`
  — and remember to also change the port in `mobile/src/theme.js`.

---

### 5. Backend starts but takes a long time / seems stuck

On the **first start** the AI models load into memory (this can take 10–20 seconds). Wait
for a line like `Application startup complete.` It is also normal for the app to show a
"Connecting to SentinelCare backend…" spinner for a few seconds.

---

### 6. "Command not found: python3" / "node" / "npm"

**Python:** you installed Python but it isn't on PATH (common on Windows). Try `python`
instead of `python3`, or re-run the installer and tick **"Add Python to PATH"**.

**Node/npm:** Node didn't install correctly, or you need to close and reopen the terminal
after installing. Reinstall Node LTS and reopen the terminal.

---

### 7. `npm install` fails

- Make sure you're **inside the `mobile` folder** when running it.
- Upgrade npm first: `npm install -g npm@latest`, then try again.
- If it complains about Microsoft/network certificates, check your internet connection /
  firewall. Retry once — downloads are flaky over some networks.

---

### 8. Alerts don't appear / no vibration / no banner

1. Are you using **Run Simulator → Create Alert** on a patient? The alert fires only when
   risk crosses the threshold (it visibly climbs to 50%+ first).
2. The red **banner + vibration** is the reliable path and needs no settings. The phone
   must be **on loud/vibrate**.
3. If the banner doesn't drop, make sure the app is in the foreground when you tap
   **Create Alert**.
4. System notifications may be delayed/hidden while the app is backgrounded inside Expo Go —
   that's expected; the banner is the demo's alert mechanism.
5. First launch asks for notification permission — tap **Allow** (Settings → Apps → Expo Go →
   Notifications if you declined earlier).

---

### 9. Everything worked yesterday, today the phone can't connect

Your computer probably got a new **IP address** (happens on reconnecting to Wi-Fi).
Re-run the IP command and update `mobile/src/theme.js`, then press `r` to reload — see
[SETUP.md Step 6 & 7](SETUP.md#step-6-find-your-computers-address-on-the-wi-fi).

---

### 10. The simulator says all patients are "Stable" / no patient has "Create Alert"

The pool contains only a few runnable patients, and they reset only when alerts are
cleared. Fix: in the **Simulator**, tap **Reset** (top right) to restore all patients to
their original state, then pick a patient showing a **Create Alert** button. This is the
documented way to re-run.

---

### 11. App shows errors / white screen / "SentinelCare hit an issue"

The app has a built-in error screen with a **Retry** button — tap Retry first. If it
persists: stop the app in Expo Go (shake → "Reload", or close and reopen Expo Go), and if
that doesn't help, restart both `npx expo start` and the backend once.

---

### 12. I moved the project to another computer / copied only some folders

The app needs these present: `backend/` (especially `demo_pool.json`), `data/models/`
(trained models + `feature_columns.json` + `static_feature_columns.json`), `mobile/`,
`ml/`, and `requirements.txt`. If model files are missing, the backend falls back to
placeholder risk values and the demo won't look right — copy the whole folder.

---

If none of these help, you can ask the developer for a hand with:
- the exact error text from the terminal (photo is fine),
- which step in [SETUP.md](SETUP.md) it breaks at,
- the output of the IP command and the line in `mobile/src/theme.js`.