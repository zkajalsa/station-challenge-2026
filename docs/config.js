/**
 * Station Challenge 2026 — Configuration
 * 
 * SETUP: After deploying the Google Apps Script, paste the web app URL below.
 * See SETUP-GUIDE.md for instructions.
 */
const CONFIG = {
  // Google Apps Script Web App URL (acts as your free backend/proxy to QUIP)
  // Replace this after deploying the Apps Script
  API_URL: 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE',

  // Scoring
  POINTS_EXACT: 5,    // Exact score match
  POINTS_WINNER: 2,   // Correct winner, wrong score
  POINTS_WRONG: 0,    // Wrong prediction

  // Winners per shift
  WINNERS: {
    night: 5,
    early: 3,
    late: 2
  }
};
