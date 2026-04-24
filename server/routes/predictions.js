const express = require('express');
const { getDb } = require('../database');
const {
  authenticateSession,
  validateDevice,
  checkDeviceOwnership,
  rateLimit,
  getClientIp,
  logAudit
} = require('../middleware/antifraud');

const router = express.Router();

/**
 * POST /api/predictions
 * Submit a prediction for a match
 * 
 * Anti-fraud layers:
 * 1. Session token validation
 * 2. Device fingerprint match
 * 3. Device ownership check (no cross-voting)
 * 4. One prediction per associate per match (DB unique constraint)
 * 5. Match must not be locked
 * 6. Rate limiting
 */
router.post('/',
  rateLimit,
  authenticateSession,
  validateDevice,
  checkDeviceOwnership,
  (req, res) => {
    const { matchId, scoreA, scoreB } = req.body;

    // Validate input
    if (matchId === undefined || scoreA === undefined || scoreB === undefined) {
      return res.status(400).json({ error: 'Match ID and both scores are required.' });
    }

    const parsedScoreA = parseInt(scoreA, 10);
    const parsedScoreB = parseInt(scoreB, 10);

    if (isNaN(parsedScoreA) || isNaN(parsedScoreB) || parsedScoreA < 0 || parsedScoreB < 0 || parsedScoreA > 20 || parsedScoreB > 20) {
      return res.status(400).json({ error: 'Scores must be numbers between 0 and 20.' });
    }

    const db = getDb();

    // Check match exists and is open
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
    if (!match) {
      return res.status(404).json({ error: 'Match not found.' });
    }

    if (match.is_locked) {
      return res.status(403).json({ error: 'Predictions for this match are locked. The match is about to start or has started.' });
    }

    if (match.is_completed) {
      return res.status(403).json({ error: 'This match has already been completed.' });
    }

    // Determine predicted winner
    let predictedWinner;
    if (parsedScoreA > parsedScoreB) {
      predictedWinner = match.team_a;
    } else if (parsedScoreB > parsedScoreA) {
      predictedWinner = match.team_b;
    } else {
      predictedWinner = 'draw';
    }

    // Check for existing prediction
    const existing = db.prepare(
      'SELECT id FROM predictions WHERE associate_id = ? AND match_id = ?'
    ).get(req.associate.id, matchId);

    if (existing) {
      logAudit('DUPLICATE_PREDICTION', req.associate.id,
        `Attempted duplicate prediction for match ${matchId}`,
        getClientIp(req), req.deviceFingerprint);
      return res.status(409).json({
        error: 'You have already submitted a prediction for this match. One prediction per match.'
      });
    }

    // Insert prediction
    try {
      db.prepare(`
        INSERT INTO predictions (associate_id, match_id, predicted_score_a, predicted_score_b, predicted_winner, device_fingerprint, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.associate.id,
        matchId,
        parsedScoreA,
        parsedScoreB,
        predictedWinner,
        req.deviceFingerprint,
        getClientIp(req),
        req.headers['user-agent'] || ''
      );

      logAudit('PREDICTION_SUBMITTED', req.associate.id,
        `Match ${matchId}: ${parsedScoreA}-${parsedScoreB} (${predictedWinner})`,
        getClientIp(req), req.deviceFingerprint);

      res.json({
        success: true,
        prediction: {
          matchId,
          scoreA: parsedScoreA,
          scoreB: parsedScoreB,
          predictedWinner,
          teamA: match.team_a,
          teamB: match.team_b
        }
      });
    } catch (err) {
      if (err.message.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: 'Prediction already exists for this match.' });
      }
      console.error('Prediction error:', err);
      res.status(500).json({ error: 'Failed to submit prediction. Please try again.' });
    }
  }
);

/**
 * GET /api/predictions/my
 * Get all predictions for the logged-in associate
 */
router.get('/my', authenticateSession, validateDevice, (req, res) => {
  const db = getDb();
  const predictions = db.prepare(`
    SELECT p.*, m.team_a, m.team_b, m.match_date, m.match_code, m.group_stage,
           m.actual_result_a, m.actual_result_b, m.actual_winner, m.is_completed
    FROM predictions p
    JOIN matches m ON p.match_id = m.id
    WHERE p.associate_id = ?
    ORDER BY m.match_date ASC
  `).all(req.associate.id);

  res.json({ predictions });
});

module.exports = router;
