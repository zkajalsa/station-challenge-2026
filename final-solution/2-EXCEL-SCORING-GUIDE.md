# Excel Scoring Template — Guide

## How Form Responses Work

When you create a Microsoft Form, responses automatically go into an Excel spreadsheet.
To access it: Open the Form → **Responses** tab → **Open in Excel**

The Excel file will have columns matching your form questions.

---

## Master Scoring Sheet

Create a NEW Excel sheet (tab) called **"Scoring"** in the same workbook.
Copy the response data into it with these columns:

| Column | Header | Source |
|--------|--------|--------|
| A | Login | From form |
| B | Full Name | From form |
| C | Shift | From form |
| D | Match Code | You type (e.g. GS-A1) |
| E | Team A | You type |
| F | Team B | You type |
| G | Predicted A | From form |
| H | Predicted B | From form |
| I | Actual A | You enter after match |
| J | Actual B | You enter after match |
| K | Points | FORMULA (see below) |

## Points Formula (Column K)

Paste this formula in cell K2 and drag down:

```
=IF(AND(I2="",J2=""), "", IF(AND(G2=I2, H2=J2), 5, IF(OR(AND(G2>H2, I2>J2), AND(H2>G2, J2>I2), AND(G2=H2, I2=J2)), 2, 0)))
```

**What it does:**
- If Actual scores are blank → shows nothing (match not played yet)
- If Predicted A = Actual A AND Predicted B = Actual B → **5 points** (exact)
- If predicted winner matches actual winner (or both draw) → **2 points**
- Otherwise → **0 points**

---

## Leaderboard Sheet

Create another tab called **"Leaderboard"**.

### Structure:

| Column | Header |
|--------|--------|
| A | Login |
| B | Full Name |
| C | Shift |
| D | Total Points |
| E | Exact Scores |
| F | Correct Winners |
| G | Matches Predicted |

### How to populate:

**Option A: Manual (simple)**
After each match day, sort the Scoring sheet by Login, sum up points per person, and update the Leaderboard tab.

**Option B: Pivot Table (automated)**
1. Select all data in the Scoring sheet
2. Insert → PivotTable
3. Rows: Login, Full Name, Shift
4. Values: SUM of Points, COUNT of Match Code
5. Sort by Total Points descending

**Option C: SUMIFS formulas**
In the Leaderboard sheet, if Login is in A2:

```
Total Points:     =SUMIFS(Scoring!K:K, Scoring!A:A, A2)
Exact Scores:     =COUNTIFS(Scoring!A:A, A2, Scoring!K:K, 5)
Correct Winners:  =COUNTIFS(Scoring!A:A, A2, Scoring!K:K, 2)
Matches Predicted:=COUNTIF(Scoring!A:A, A2)
```

---

## Shift-Based Winners

Filter or sort the Leaderboard by Shift column:

| Shift | Top N |
|-------|-------|
| Night Shift 🌙 | Top 5 |
| Early Shift 🌅 | Top 3 |
| Late Shift 🌇 | Top 2 |

Sort by Total Points DESC within each shift to find winners.
