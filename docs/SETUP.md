# Setup Guide — Install and Run SentinelCare

Everything you need to get SentinelCare running on your own computer and phone, the very
first time. Read it top to bottom once, then use [Step 8](#step-8-start-the-app-and-connect-your-phone)
every time you want to run a demo.

> **Time:** about 30–45 minutes the first time, mostly installing software.
> **You will not write any code.** You follow the steps and copy-paste short commands.

---

## What you need

| Item | Requirement |
|---|---|
| A computer | Windows or macOS. Any reasonably modern laptop works. |
| An Android phone | The app runs on Android (via the **Expo Go** app). |
| Internet | Needed only the **first time** (to install software and download the project). |
| Same Wi-Fi | The computer and the phone must be on the **same Wi-Fi network** during the demo. |

You will talk to your computer using **Terminal** (macOS) or **Command Prompt / PowerShell**
(Windows). From now on we call it "the terminal". When a command is shown like this:

```bash
python3 --version
```

you copy the text, paste it into the terminal, and press **Enter**.

---

## Step 1 — Install the software on the computer

### 1a. Python 3.12

1. Go to <https://www.python.org/downloads> and download Python **3.12** for your system.
2. Run the installer.
   - **Windows:** tick **"Add Python to PATH"** at the bottom of the first screen, then install.
   - **macOS:** just follow the installer.
3. Check it worked. Open the terminal and run:

   ```bash
   python3 --version
   ```

   You should see `Python 3.12.x`.

   > If it prints nothing or says "command not found", try `python --version` instead
   > (Windows often uses `python`). Use whichever works from now on.

### 1b. Node.js

1. Go to <https://nodejs.org> and install the **LTS** version.
2. Check it worked:

   ```bash
   node --version
   ```

   You should see a version number like `v20.x` or newer.

---

## Step 2 — Install the "Expo Go" app on the phone

1. Open the **Google Play Store** on the phone.
2. Search for **"Expo Go"** (developer: Expo Project) and install it.

### ⚠️ Very important — matching version

This project was built with **Expo SDK 51**. Expo Go from the Play Store only supports the
**newest** SDK, so depending on your phone and the store version you may see one of two
things when you scan the QR code later:

- **It works** — great, nothing to do.
- **It shows an error** like *"SDK 54 is not supported"* or *"Incompatible SDK"* — then the
  installed Expo Go is too new. Fix: download the **SDK 51 version** of Expo Go:

  1. On the phone's browser, go to <https://expo.dev/go>.
  2. Choose **SDK 51** from the version selector.
  3. Choose **Android**, and tap **Download** (it downloads an `.apk` file).
  4. Open the downloaded file. Your phone will ask to allow **"install from unknown
     sources"** — allow it, install, and you now have the correct Expo Go.

Whether it works from the store or you sideload the APK, remember **which Expo Go you used**
— from now on, always open that one.

---

## Step 3 — Put the project on your computer

You need all the SentinelCare files on your computer. Two ways:

**Easiest (recommended for first time):**
1. Download the project as a ZIP file (from GitHub → **Code ▾ → Download ZIP**).
2. Unzip it. You should see a folder called `SentinelCare` with a `README.md` inside.
3. Open a terminal and go into that folder. The fastest way on **macOS** is to type `cd `,
   then drag the folder onto the terminal window, then press Enter.

**If you are comfortable with Git:**
```bash
git clone <repository-url>
cd SentinelCare
```

From here on, "the project folder" means the folder that contains `README.md`, `backend/`,
and `mobile/`.

---

## Step 4 — Install the backend software packages

In the terminal, make sure you are inside the project folder, then run (one time only):

```bash
python3 -m pip install -r requirements.txt
```

This downloads and installs the Python libraries the backend needs. It takes a few minutes.
When it finishes, you should see no errors (many "Successfully installed …" lines are fine).

Next, the mobile app's libraries (one time only):

```bash
cd mobile
npm install
```

This also takes a few minutes. When it's done, go back to the project folder:

```bash
cd ..
```

---

## Step 5 — Start the backend (the "brain")

The backend is the server that holds the patient data and runs the AI. It must be running
for the app to work. Two commands, and it stays running until you close it.

```bash
cd backend
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000
```

You should see lines ending with:

```
Uvicorn running on http://0.0.0.0:8000
Application startup complete.
```

> **Leave this terminal window open.** If you close it, the backend stops.
> The first start can take several seconds while the AI models load — that's normal.

---

## Step 6 — Find your computer's address on the Wi-Fi

The phone needs to find the computer on the Wi-Fi, so you need the computer's **IP
address** — a number that looks like `192.168.1.34`.

**macOS:** open a new terminal window and run:

```bash
ipconfig getifaddr en0
```

(If nothing shows, try `ipconfig getifaddr en1`.)

**Windows:** in the terminal run:

```bash
ipconfig
```

and look for the line **IPv4 Address** under your Wi-Fi adapter. It looks like
`192.168.x.x`.

Write this number down — you'll need it in the next step. Example: `192.168.1.34`.

---

## Step 7 — Point the app at your computer

The app needs to know where your backend lives. Open the file

```
mobile/src/theme.js
```

with any text editor (Notepad on Windows, TextEdit on macOS). Find this line near the top:

```js
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.31.123:8000/api';
```

Replace the number inside the quotes (the `192.168.31.123` part) with **your** IP address
from Step 6, keeping the format exactly:

```js
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.34:8000/api';
```

Save the file. (You will only ever change this when you switch to a different Wi-Fi network
or a different computer.)

> **Alternative for the technical:** instead of editing the file, you can start Expo with
> `EXPO_PUBLIC_API_URL=http://192.168.1.34:8000/api npx expo start`.

---

## Step 8 — Start the app and connect your phone

1. Make sure the **backend terminal (Step 5) is still running**.
2. Open a **new** terminal window, go into the `mobile` folder, and start the app:

   ```bash
   cd mobile
   npx expo start
   ```

   A few seconds later you'll see a **QR code** in the terminal, plus a line like
   `Metro waiting on exp://192.168.1.34:8081`.

3. On the **phone**, make sure it's on the **same Wi-Fi** as the computer.
4. Open **Expo Go**, and scan the QR code:
   - **Android:** in Expo Go, tap the scan icon (or use the phone's camera app pointed at
     the QR code — Android offers "Open in Expo Go").
5. The app starts loading. You should first see a "Connecting to SentinelCare backend…"
   screen, then the **Home dashboard** with 16 patients.

> If the phone takes more than ~30 seconds or says "Connection unavailable", the most
> common causes are (1) it's on a different Wi-Fi, (2) your IP changed, or (3) a firewall
> is blocking port 8000. The full list of fixes is in **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**.

---

## ✅ You're ready

The app is loaded and talking to the backend. Open the Home screen — you should see the
dashboard, priority patients, and quick-action buttons.

Follow the presenter flow in **[DEMO.md](DEMO.md)** to give the demonstration.

---

## On notifications (important to understand first)

SentinelCare "notifies the doctor" two ways:

1. **In-app alarm banner + vibration** — when a patient's risk spikes, a red banner
   immediately slides down from the top of the phone screen **and the phone vibrates**.
   This works every time and needs no special setup. It is the main way the demo shows an
   alert.
2. **System notification** — the app also schedules a phone notification. In Expo Go this
   works reliably only while the app is open/foregrounded; a backgrounded Expo Go session
   may delay or hide it. **This is expected and fine** — for a demo, the banner + vibration
   is the alert, and the notification is a bonus.

There is **nothing to configure** on your end. The phone will ask for notification
permission the first time the app runs — tap **Allow**.

---

## Running it again tomorrow (after the first setup)

Only two commands in two terminals (and your phone already has Expo Go):

```bash
# Terminal 1 — backend
cd backend
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000
```

```bash
# Terminal 2 — app
cd mobile
npx expo start
```

Then scan the QR code with Expo Go again. If the computer's IP changed since last time
(re-joining a different Wi-Fi often changes it), redo [Step 6](#step-6-find-your-computers-address-on-the-wi-fi)
and [Step 7](#step-7-point-the-app-at-your-computer), then press `r` in the app terminal to
reload.

---

## Shutting down

- In the **app terminal**, press `Ctrl` + `C`.
- In the **backend terminal**, press `Ctrl` + `C`.
- You can press the phone's home button to exit the app.

---

## Did something go wrong?

Check **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** first — it covers the 8 most common
problems and their fixes.