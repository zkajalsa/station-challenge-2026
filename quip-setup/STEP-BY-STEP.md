# Station Challenge 2026 — Setup (15 min total)

## How It Works Now
- No pre-registration needed
- Associate scans QR → enters login, name, shift → predicts
- Their data auto-populates in QUIP on first prediction
- Leaderboard builds itself from the predictions data
- Only **2 QUIP spreadsheets** needed

---

## Step 1: Create 2 QUIP Spreadsheets (5 min)

### Spreadsheet 1: MATCHES
1. Open QUIP → **+ New** → **Spreadsheet**
2. Name it: `Station Challenge - Matches`
3. Open the file `quip-setup/2-MATCHES.csv` in this project
4. Select all content → Copy → Paste into the QUIP spreadsheet
5. Note the **Thread ID** from the URL:
   - URL: `https://quip-amazon.com/ABcDeFgHiJkL/...`
   - Thread ID = `ABcDeFgHiJkL`

### Spreadsheet 2: PREDICTIONS
1. **+ New** → **Spreadsheet** → Name: `Station Challenge - Predictions`
2. Type or paste this header row only:
   ```
   Login | FullName | Shift | MatchCode | ScoreA | ScoreB | PredictedWinner | Fingerprint | Timestamp | Points
   ```
3. Leave it empty below the header — it fills automatically when people vote
4. Note the **Thread ID**

---

## Step 2: Get QUIP API Token (1 min)

1. Go to **https://quip-amazon.com/dev/token** (or https://quip.com/dev/token)
2. Generate a token → Copy it

---

## Step 3: Deploy Google Apps Script (5 min)

1. Go to **https://script.google.com** → **New project**
2. Delete the default code
3. Open `google-apps-script/Code.gs` from this project → Copy all → Paste
4. Fill in your values at the top:
```javascript
const QUIP_CONFIG = {
  TOKEN: 'your_quip_token',
  MATCHES_THREAD: 'your_matches_thread_id',
  PREDICTIONS_THREAD: 'your_predictions_thread_id'
};
```
5. Save (Ctrl+S)
6. **Deploy** → **New deployment** → ⚙️ **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Click **Deploy** → Authorize when prompted
8. **Copy the Web App URL**

---

## Step 4: Connect Frontend (2 min)

1. Go to: https://github.com/zkajalsa/station-challenge-2026/edit/main/docs/config.js
2. Replace `YOUR_GOOGLE_APPS_SCRIPT_URL_HERE` with your URL from Step 3
3. Click **Commit changes**

---

## Step 5: Done!

Your app is live at: **https://zkajalsa.github.io/station-challenge-2026/**

Generate a QR code for that URL → Print → Post at station.

---

## After Each Match

1. In the QUIP **Matches** spreadsheet:
   - Change **Status** to `completed`
   - Fill in **ResultA** and **ResultB**

2. In the QUIP **Predictions** spreadsheet:
   - For each row with that MatchCode, fill the **Points** column:
     - `5` = exact score match
     - `2` = correct winner, wrong score
     - `0` = wrong prediction

The leaderboard updates automatically.

---

## What You Need to Write Down

| Item | Your Value |
|------|-----------|
| QUIP Token | |
| Matches Thread ID | |
| Predictions Thread ID | |
| Apps Script URL | |
