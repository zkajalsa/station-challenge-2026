# ⚽ FIFA World Cup 2026 — Station Challenge

## Amazon Delivery Station Engagement Activity

A digital prediction challenge for 200 sortation associates across all shifts. Associates scan a QR code, submit their match predictions, and compete for top spots on a live leaderboard.

### Winners by Shift
| Shift | Winners |
|-------|---------|
| Night Shift | 5 |
| Early Shift | 3 |
| Late Shift | 2 |

---

## System Components

### 1. Web Application (`/app`)
- QR code-based access for associates
- Login via Amazon Login (badge ID)
- Match prediction submission
- Device fingerprinting + IP tracking to prevent duplicate votes
- Responsive mobile-first design

### 2. Backend Server (`/server`)
- Node.js + Express API
- SQLite database (portable, no infra needed)
- Anti-fraud: device fingerprint, IP lock, one-vote-per-match enforcement
- Admin panel for managing matches and viewing results

### 3. Tampermonkey Script (`/tampermonkey`)
- Runs on internal Amazon tools
- Gathers associate login, shift, and badge data
- Auto-populates the prediction app with verified identity

### 4. QUIP Leaderboard (`/quip`)
- Script to push winner data to a QUIP spreadsheet
- Updates login and win count after each match day
- Shift-segmented leaderboard

---

## Quick Start

```bash
# Install dependencies
cd server
npm install

# Start the server
npm start

# Open http://localhost:3000 in browser
# Scan QR code or navigate directly
```

## QR Code
Generate a QR code pointing to your server URL. Each associate scans it on their personal device to participate.

---

## Tech Stack
- **Frontend**: Vanilla HTML/CSS/JS (no build step, runs anywhere)
- **Backend**: Node.js, Express, SQLite3, better-sqlite3
- **Anti-Fraud**: FingerprintJS, IP tracking, session tokens
- **Leaderboard**: QUIP API integration
- **Data Collection**: Tampermonkey userscript
