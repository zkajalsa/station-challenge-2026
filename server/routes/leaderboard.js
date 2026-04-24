const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

/**
 * Scoring system:
 * - Exact score prediction: 5 points
 * - Correct winner/draw (wrong score): 2 points
 * - Wrong prediction: 0 points
 */

/**
 * GET /api/leaderboard
 * Overall leaderboard with shift filtering
 */
router.get('/', (req, res) => {
  const db = getDb();
  const { shift, limit } = req.query;
  const maxResults = Math.min(parseInt(limit, 10) || 50, 200);

  let query = `
    SELECT
      a.login,
      a.full_name,
      a.shift,
      COALESCE(l.total_points, 0) as total_points,
      COALESCE(l.exact_scores, 0) as exact_scores,
      COALESCE(l.correct_winners, 0) as correct_winners,
      COALESCE(l.total_predictions, 0) as total_predictions,
      COALESCE(l.current_streak, 0) as current_streak,
      COALESCE(l.best_streak, 0) as best_streak
    FROM associates a
    LEFT JOIN leaderboard l ON a.id = l.associate_id
    WHERE a.is_active = 1
  `;

  const params = [];

  if (shift && ['night', 'early', 'late'].includes(shift)) {
    query += ' AND a.shift = ?';
    params.push(shift);
  }

  query += ' ORDER BY total_points DESC, exact_scores DESC, correct_winners DESC LIMIT ?';
  params.push(maxResults);

  const rows = db.prepare(query).all(...params);

  // Add rank
  const leaderboard = rows.map((row, index) => ({
    rank: index + 1,
    ...row
  }));

  res.json({ leaderboard });
});

/**
 * GET /api/leaderboard/winners
 * Get the current top winners per shift
 */
router.get('/winners', (req, res) => {
  const db = getDb();

  const getTopByShift = (shift, count) => {
    return db.prepare(`
      SELECT
        a.login,
        a.full_name,
        a.shift,
        COALESCE(l.total_points, 0) as total_points,
        COALESCE(l.exact_scores, 0) as exact_scores,
        COALESCE(l.correct_winners, 0) as correct_winners,
        COALESCE(l.total_predictions, 0) as total_predictions
      FROM associates a
      LEFT JOIN leaderboard l ON a.id = l.associate_id
      WHERE a.is_active = 1 AND a.shift = ?
      ORDER BY total_points DESC, exact_scores DESC, correct_winners DESC
      LIMIT ?
    `).all(shift, count);
  };

  const winners = {
    night: getTopByShift('night', 5),
    early: getTopByShift('early', 3),
    late: getTopByShift('late', 2)
  };

  res.json({ winners });
});

/**
 * GET /api/leaderboard/stats
 * Overall participation stats
 */
router.get('/stats', (req, res) => {
  const db = getDb();

  const totalAssociates = db.prepare('SELECT COUNT(*) as count FROM associates WHERE is_active = 1').get().count;
  const totalPredictions = db.prepare('SELECT COUNT(*) as count FROM predictions').get().count;
  const totalMatches = db.prepare('SELECT COUNT(*) as count FROM matches').get().count;
  const completedMatches = db.prepare('SELECT COUNT(*) as count FROM matches WHERE is_completed = 1').get().count;

  const participationByShift = db.prepare(`
    SELECT a.shift, COUNT(DISTINCT p.associate_id) as participants
    FROM predictions p
    JOIN associates a ON p.associate_id = a.id
    GROUP BY a.shift
  `).all();

  const shiftCounts = db.prepare(`
    SELECT shift, COUNT(*) as total FROM associates WHERE is_active = 1 GROUP BY shift
  `).all();

  res.json({
    stats: {
      totalAssociates,
      totalPredictions,
      totalMatches,
      completedMatches,
      participationByShift,
      shiftCounts
    }
  });
});

module.exports = router;
