/**
 * Station Challenge 2026 — Configuration
 * Fill in your QUIP details below.
 */
const CONFIG = {
  // QUIP API token — get from https://quip-amazon.com/dev/token
  QUIP_TOKEN: 'VEtQOU1BdEszcXY=|1808578678|Ognriu/R2BXbEUk+fFcmmSqop9tKTiON66PmEduPQsg=',

  // QUIP base URL — use your Amazon QUIP domain
  QUIP_API: 'https://platform.quip-amazon.com/1',

  // Thread IDs of your 2 spreadsheets
  MATCHES_THREAD: 'oPOBAONaazXq',
  PREDICTIONS_THREAD: 'oPOBAONaazXq',

  // Scoring
  POINTS_EXACT: 5,
  POINTS_WINNER: 2,
  WINNERS: { night: 5, early: 3, late: 2 }
};
