# ⚽ Station Challenge 2026 — Setup Guide

## Architecture
```
Associates scan QR → GitHub Pages (frontend) → Google Apps Script (free API) → QUIP (database)
```
**Total cost: $0**

---

## Step 1: Create 4 QUIP Spreadsheets

Create these 4 spreadsheets in QUIP. The **first row must be the header row exactly as shown**.

### Spreadsheet 1: Associates
| Login | FullName | Shift | BadgeID | Fingerprint |
|-------|----------|-------|---------|-------------|
| jsmith | John Smith | night | BADGE001 | |
| jdoe | Jane Doe | early | BADGE002 | |

### Spreadsheet 2: Matches
| MatchCode | TeamA | TeamB | Group | MatchDate | Venue | Status | ResultA | ResultB |
|-----------|-------|-------|-------|-----------|-------|--------|---------|---------|
| GS-A1 | USA | TBD-A2 | Group A | 2026-06-11 18:00 | MetLife Stadium | open | | |

### Spreadsheet 3: Predictions
| Login | MatchCode | ScoreA | ScoreB | PredictedWinner | Fingerprint | Timestamp | Points |
|-------|-----------|--------|--------|-----------------|-------------|-----------|--------|

### Spreadsheet 4: Leaderboard
| Login | FullName | Shift | TotalPoints | ExactScores | CorrectWinners | TotalPredictions |
|-------|----------|-------|-------------|-------------|----------------|------------------|

**Note the Thread ID** from each spreadsheet URL. Example:
`https://quip.com/ABcDeFgHiJkL` → Thread ID is `ABcDeFgHiJkL`

---

## Step 2: Get QUIP API Token

1. Go to https://quip.com/dev/token
2. Click **Generate Token**
3. Copy and save the token

---

## Step 3: Deploy Google Apps Script

1. Go to https://script.google.com
2. Click **New Project**
3. Delete the default code
4. Paste the entire contents of `google-apps-script/Code.gs`
5. Fill in your QUIP config at the top:
   ```javascript
   const QUIP_CONFIG = {
     TOKEN: 'your_quip_token_here',
     ASSOCIATES_THREAD: 'thread_id_from_step_1',
     MATCHES_THREAD: 'thread_id_from_step_1',
     PREDICTIONS_THREAD: 'thread_id_from_step_1',
     LEADERBOARD_THREAD: 'thread_id_from_step_1'
   };
   ```
6. Click **Deploy** → **New deployment**
7. Type: **Web app**
8. Execute as: **Me**
9. Who has access: **Anyone**
10. Click **Deploy**
11. **Copy the Web App URL** (looks like `https://script.google.com/macros/s/ABC.../exec`)

---

## Step 4: Update Frontend Config

Edit `docs/config.js` in your GitHub repo:
```javascript
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
  ...
};
```

Push the change:
```bash
git add docs/config.js
git commit -m "Add API URL"
git push
```

---

## Step 5: Enable GitHub Pages

1. Go to your repo: https://github.com/zkajalsa/station-challenge-2026
2. Click **Settings** → **Pages** (left sidebar)
3. Source: **Deploy from a branch**
4. Branch: **main**, folder: **/docs**
5. Click **Save**

Your site will be live at:
**https://zkajalsa.github.io/station-challenge-2026/**

---

## Step 6: Generate QR Code & Share

Go to any QR code generator (e.g., https://www.qr-code-generator.com/) and create a QR for:
```
https://zkajalsa.github.io/station-challenge-2026/
```

Print it and post it at the station.

---

## Populating Your 200 Associates

In the QUIP Associates spreadsheet, add all 200 associates with columns:
- **Login**: Their Amazon login (lowercase)
- **FullName**: Display name
- **Shift**: `night`, `early`, or `late`
- **BadgeID**: Optional
- **Fingerprint**: Leave blank (auto-filled on first login)

---

## Managing Matches

In the QUIP Matches spreadsheet:
- **Status** column controls predictions:
  - `open` — Associates can predict
  - `locked` — Predictions closed (set before kickoff)
  - `completed` — Match finished
- After a match, update **ResultA**, **ResultB**, and set Status to `completed`

---

## Scoring Predictions

After recording a result, update the **Points** column in the Predictions spreadsheet:
- **5** — Exact score match
- **2** — Correct winner/draw, wrong score
- **0** — Wrong prediction

---

## Winners

| Shift | Winners |
|-------|---------|
| Night 🌙 | Top 5 by points |
| Early 🌅 | Top 3 by points |
| Late 🌇 | Top 2 by points |
