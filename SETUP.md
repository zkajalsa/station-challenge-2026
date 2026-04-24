# ⚽ Station Challenge 2026 — Setup Guide

## Prerequisites

### 1. Install Node.js
Download and install Node.js (v18 or later) from:
**https://nodejs.org/en/download**

Choose the Windows installer (.msi). After installation, restart your terminal.

Verify installation:
```bash
node --version
npm --version
```

---

## Quick Start (5 minutes)

### Step 1: Install Dependencies
```bash
cd server
npm install
```

### Step 2: Seed the Database
This creates 200 sample associates, World Cup matches, and an admin account.
```bash
npm run seed
```

### Step 3: Start the Server
```bash
npm start
```

The app will be running at **http://localhost:3000**

### Step 4: Access the Admin Panel
Go to **http://localhost:3000/admin.html**
- Login: `admin`
- PIN: `station2026`

### Step 5: Generate & Print the QR Code
In the admin panel, generate a QR code pointing to your server URL. Print it and post it at the station.

---

## Importing Your Real Associates

### Option A: Admin Panel (JSON)
Go to the admin panel and paste a JSON array:
```json
[
  {"login": "jsmith", "fullName": "John Smith", "shift": "night", "badgeId": "BADGE001"},
  {"login": "jdoe", "fullName": "Jane Doe", "shift": "early", "badgeId": "BADGE002"},
  {"login": "mbrown", "fullName": "Mike Brown", "shift": "late", "badgeId": "BADGE003"}
]
```

Valid shifts: `night`, `early`, `late`

### Option B: Tampermonkey Script (Auto-scrape)
1. Install Tampermonkey browser extension
2. Create a new script and paste the contents of `tampermonkey/station-challenge-data-collector.user.js`
3. Update the `CHALLENGE_SERVER` URL in the script
4. Navigate to your FC roster tool — the script will detect associate data
5. Click the ⚽ floating button → "Scrape Roster" to bulk import

---

## How It Works

### For Associates
1. Scan the QR code with their phone
2. Log in with their Amazon login (and optionally badge ID)
3. Browse upcoming matches and submit score predictions
4. One prediction per match, one device per person
5. Check the leaderboard to see their ranking

### For Admins
1. Before each match: predictions auto-lock (or manually lock via admin panel)
2. After each match: enter the final score in the admin panel
3. Points are calculated automatically:
   - **5 points** — Exact score prediction
   - **2 points** — Correct winner/draw (wrong score)
   - **0 points** — Wrong prediction
4. Leaderboard updates instantly

### Anti-Fraud Protection
- **Device fingerprinting**: Each associate is tied to their device
- **One device per person**: Can't log in from someone else's device
- **One prediction per match**: No changing or duplicate submissions
- **IP tracking**: Flags suspicious patterns
- **Session tokens**: 24-hour expiry, device-locked
- **Audit log**: Every action is logged for review
- **Fraud report**: Admin panel shows shared devices and suspicious activity

---

## Winners

At the end of the World Cup, the top scorers per shift win:

| Shift | Winners |
|-------|---------|
| Night Shift 🌙 | Top 5 |
| Early Shift 🌅 | Top 3 |
| Late Shift 🌇 | Top 2 |

View current standings anytime in the **Winners** tab or admin dashboard.

---

## QUIP Leaderboard Sync

To push the leaderboard to a QUIP spreadsheet:

1. Get a QUIP API token: https://quip.com/dev/token
2. Create a QUIP spreadsheet and note the thread ID (from the URL)
3. Run:
```bash
QUIP_TOKEN=your_token QUIP_THREAD_ID=your_thread_id npm run quip-sync
```

Or on Windows:
```powershell
$env:QUIP_TOKEN="your_token"
$env:QUIP_THREAD_ID="your_thread_id"
npm run quip-sync
```

Without QUIP credentials, it generates a local console report instead.

---

## Network Setup

For associates to access the app from their phones, the server needs to be reachable on the local network:

1. Find your computer's IP: `ipconfig` → look for IPv4 Address (e.g., `192.168.1.50`)
2. Start the server: `npm start`
3. QR code should point to: `http://192.168.1.50:3000`
4. Make sure your firewall allows port 3000

For a more permanent setup, consider deploying to an internal server or using a tool like ngrok.

---

## File Structure

```
├── app/public/          # Frontend (HTML/CSS/JS)
│   ├── index.html       # Main prediction app
│   ├── admin.html       # Admin dashboard
│   ├── styles.css       # Styles
│   └── app.js           # Frontend logic
├── server/              # Backend (Node.js)
│   ├── index.js         # Express server
│   ├── database.js      # SQLite setup
│   ├── seed.js          # Database seeder
│   ├── quip-sync.js     # QUIP integration
│   ├── routes/          # API routes
│   │   ├── auth.js      # Login/logout/session
│   │   ├── matches.js   # Match listing
│   │   ├── predictions.js # Submit predictions
│   │   ├── leaderboard.js # Rankings
│   │   ├── admin.js     # Admin operations
│   │   └── qr.js        # QR code generation
│   └── middleware/
│       └── antifraud.js  # Security middleware
├── tampermonkey/        # Browser userscript
│   └── station-challenge-data-collector.user.js
├── README.md
└── SETUP.md             # This file
```
