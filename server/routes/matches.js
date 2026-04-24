const express = require('express');
const { getDb } = require('../database');
const { authenticateSession, validateDevice } = require('../middleware/antifraud');

const router = express.Router();

/**
 * GET /api/matches
 * List all matches — public, no auth needed
 */
router.get('/', (req, res) => {
  const db = getDb();
  const { status, date } = req.query;

  let query = 'SELECT * FROM matches';
  const conditions = [];
  const params = [];

  if (status === 'upcoming') {
    conditions.push('is_completed = 0 AND is_locked = 0');
  } else if (status === 'locked') {
    conditions.push('is_locked = 1 AND is_completed = 0');
  } else if (status === 'completed') {
    conditions.push('is_completed = 1');
  }

  if (date) {
    conditions.push('DATE(match_date) = ?');
    params.push(date);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY match_date ASC';

  const matches = db.prepare(query).all(...params);
  res.json({ matches });
});

/**
 * GET /api/matches/:id
 * Single match detail
 */
router.get('/:id', (req, res) => {
  const db = getDb();
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);

  if (!match) {
    return res.status(404).json({ error: 'Match not found.' });
  }

  res.json({ match });
});

/**
 * GET /api/matches/:id/my-prediction
 * Get the logged-in associate's prediction for a match
 */
router.get('/:id/my-prediction', authenticateSession, validateDevice, (req, res) => {
  const db = getDb();
  const prediction = db.prepare(`
    SELECT predicted_score_a, predicted_score_b, predicted_winner, points_earned, submitted_at
    FROM predictions
    WHERE associate_id = ? AND match_id = ?
  `).get(req.associate.id, req.params.id);

  res.json({ prediction: prediction || null });
});

module.exports = router;
