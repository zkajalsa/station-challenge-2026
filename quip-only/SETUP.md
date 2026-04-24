# Setup — 10 Minutes Total

## Step 1: Create the Prediction Sheet (3 min)

1. Open QUIP → **+ New** → **Spreadsheet**
2. Name it: `⚽ Station Challenge 2026 — Predictions`
3. In row 1, type these headers across columns A through L:

| A | B | C | D | E | F | G | H | I | J | K | L |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Login | Full Name | Shift | Match Code | Team A | Team B | Your Score A | Your Score B | Status | Actual A | Actual B | Points |

4. In rows 2-4, add the example rows (so people see the format):
   - Row 2: `EXAMPLE-jsmith | John Smith | night | GS-A1 | USA | TBD-A2 | 2 | 1 | open | | |`
   - Row 3: `EXAMPLE-jdoe | Jane Doe | early | GS-A1 | USA | TBD-A2 | 1 | 1 | open | | |`
   - Row 4: `EXAMPLE-mbrown | Mike Brown | late | GS-B1 | Mexico | TBD-B2 | 3 | 0 | open | | |`

5. Share the document: Click **Share** → **Anyone at Amazon with the link can edit**

## Step 2: Create the Leaderboard (2 min)

1. **+ New** → **Spreadsheet**
2. Name it: `🏆 Station Challenge 2026 — Leaderboard`
3. Row 1 headers:

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| Rank | Login | Full Name | Shift | Total Points | Exact Scores | Correct Winners |

4. Share: **Anyone at Amazon with the link can view** (view only — only you edit this)

## Step 3: Create the Main Hub (3 min)

1. **+ New** → **Document**
2. Name it: `⚽ Station Challenge — FIFA World Cup 2026`
3. Copy the content from `quip-only/1-MAIN-HUB.md` and paste it in
4. Replace the two `[PASTE YOUR ... LINK HERE]` placeholders with actual QUIP links to your Prediction Sheet and Leaderboard
5. Share: **Anyone at Amazon with the link can view**

## Step 4: Share (1 min)

Generate a QR code for the Main Hub QUIP link at any QR generator.
Print it. Post it at the station.

Or just share the QUIP link on Chime / email / station TV.

---

## After Each Match — How to Score (2 min per match)

1. Open the **Prediction Sheet**
2. Change **Status** to `locked` for that match code (so people know it's done)
3. Fill in **Actual A** and **Actual B** columns with the real score
4. Fill in **Points** for each row with that match code:
   - `5` — if Your Score A = Actual A AND Your Score B = Actual B (exact match)
   - `2` — if they got the winner right but wrong score
   - `0` — wrong prediction
5. Update the **Leaderboard** — sort by total points, update ranks

## How to Determine Winner for Scoring

- If Actual A > Actual B → Team A wins
- If Actual B > Actual A → Team B wins
- If Actual A = Actual B → Draw
- Compare to what the associate predicted:
  - Their Score A > Their Score B → they predicted Team A wins
  - Their Score B > Their Score A → they predicted Team B wins
  - Their Score A = Their Score B → they predicted Draw
- If both predicted the same outcome (same winner or both draw) → 2 points
- If exact scores match → 5 points

---

## That's It!

No website. No hosting. No APIs. Just QUIP.
