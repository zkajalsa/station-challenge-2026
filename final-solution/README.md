# ⚽ Station Challenge 2026 — Final Solution

## Microsoft Forms + Excel + QUIP

| Component | Purpose |
|-----------|---------|
| **Microsoft Forms** | Associates scan QR → submit predictions |
| **Excel** | Auto-collects responses, calculates points |
| **QUIP** | Graphical leaderboard displayed at station |

## Flow
1. You create a Form for each match day (5 min per form)
2. Associates scan QR code → fill in predictions on their phone
3. Responses auto-flow into Excel
4. You enter actual results → Excel calculates points
5. You copy top scorers into the QUIP leaderboard

## Anti-Fraud
- Microsoft Forms logs the respondent's email/identity
- "One response per person" setting prevents duplicates
- You control when the form opens and closes (lock at kickoff)
- Excel timestamps every submission
