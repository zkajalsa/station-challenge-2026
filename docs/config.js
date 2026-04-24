/**
 * Station Challenge 2026 — Configuration
 * Fill in your QUIP details below.
 */
const CONFIG = {
  // QUIP API token — get from https://quip-amazon.com/dev/token
  QUIP_TOKEN: 'YOUR_QUIP_TOKEN_HERE',

  // QUIP base URL — use your Amazon QUIP domain
  QUIP_API: 'https://platform.quip-amazon.com/1',

  // Thread IDs of your 2 spreadsheets
  MATCHES_THREAD: 'YOUR_MATCHES_THREAD_ID',
  PREDICTIONS_THREAD: 'YOUR_PREDICTIONS_THREAD_ID',

  // Scoring
  POINTS_EXACT: 5,
  POINTS_WINNER: 2,
  WINNERS: { night: 5, early: 3, late: 2 }
};
