const express = require('express');
const { getDb } = require('../database');
const { authenticateAdmin, logAudit } = require('../middleware/antifraud');

const router = express.Router();

/**
 * POST /api/admin/login
 * Admin login with PIN
 */
router.post('/login', (req, res) => {
  const { login, pin } = req.body;
  const db = getDb();

  const admin = db.prepare('SELECT * FROM admins WHERE login = ? AND pin_hash = ?').get(login, pin);
  if (!admin) {
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }

  res.json({ success: true, token: admin.pin_hash, login: admin.login });
});

/**
 * POST /api/admin/associates
 * Bulk add associates
 */
router.post('/associates', authenticateAdmin, (req, res) => {
  const { associates } = req.body;
  if (!Array.isArray(associates)) {
    return res.status(400).json({ error: 'Associates must be an array.' });
  }

  const db = getDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO associates (login, badge_id, full_name, shift)
    VALUES (?, ?, ?, ?)
  `);

  const insertMany = db.transaction((list) => {
    let added = 0;
    for (const a of list) {
      if (!a.login || !a.fullName || !a.shift) continue;
      if (!['night', 'early', 'late'].includes(a.shift)) continue;
      const result = insert.run(a.login.toLowerCase().trim(), a.badgeId || null, a.fullName.trim(), a.shift);
      if (result.changes > 0) added++;
    }
    return added;
  });

  const added = insertMany(associates);
  res.json({ success: true, added, total: associates.length });
});

/**
 * POST /api/admin/matches
 * Add matches
 */
router.post('/matches', authenticateAdmin, (req, res) => {
  const { matches } = req.body;
  if (!Array.isArray(matches)) {
    return res.status(400).json({ error: 'Matches must be an array.' });
  }

  const db = getDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO matches (match_code, team_a, team_b, group_stage, match_date, venue)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((list) => {
    let added = 0;
    for (const m of list) {
      if (!m.matchCode || !m.teamA || !m.teamB || !m.matchDate) continue;
      const result = insert.run(m.matchCode, m.teamA, m.teamB, m.groupStage || null, m.matchDate, m.venue || null);
      if (result.changes > 0) added++;
    }
    return added;
  });

  const added = insertMany(matches);
  res.json({ success: true, added, total: matches.length });
});

/**
 * PUT /api/admin/matches/:id/result
 * Record match result and calculate points
 */
router.put('/matches/:id/result', authenticateAdmin, (req, res) => {
  const { scoreA, scoreB } = req.body;
  const matchId = req.params.id;

  if (scoreA === undefined || scoreB === undefined) {
    return res.status(400).json({ error: 'Both scores are required.' });
  }

  const db = getDb();
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!match) {
    return res.status(404).json({ error: 'Match not found.' });
  }

  const parsedA = parseInt(scoreA, 10);
  const parsedB = parseInt(scoreB, 10);

  // Determine actual winner
  let actualWinner;
  if (parsedA > parsedB) actualWinner = match.team_a;
  else if (parsedB > parsedA) actualWinner = match.team_b;
  else actualWinner = 'draw';

  // Update match
  db.prepare(`
    UPDATE matches
    SET actual_result_a = ?, actual_result_b = ?, actual_winner = ?, is_completed = 1, is_locked = 1
    WHERE id = ?
  `).run(parsedA, parsedB, actualWinner, matchId);

  // Score all predictions for this match
  const predictions = db.prepare('SELECT * FROM predictions WHERE match_id = ?').all(matchId);

  const updatePrediction = db.prepare('UPDATE predictions SET points_earned = ? WHERE id = ?');

  const scorePredictions = db.transaction(() => {
    for (const pred of predictions) {
      let points = 0;

      // Exact score match = 5 points
      if (pred.predicted_score_a === parsedA && pred.predicted_score_b === parsedB) {
        points = 5;
      }
      // Correct winner = 2 points
      else if (pred.predicted_winner === actualWinner) {
        points = 2;
      }

      updatePrediction.run(points, pred.id);
    }
  });

  scorePredictions();

  // Rebuild leaderboard
  rebuildLeaderboard(db);

  logAudit('MATCH_RESULT', null,
    `Match ${match.match_code}: ${match.team_a} ${parsedA} - ${parsedB} ${match.team_b} (${actualWinner})`,
    null);

  res.json({
    success: true,
    match: {
      id: matchId,
      teamA: match.team_a,
      teamB: match.team_b,
      scoreA: parsedA,
      scoreB: parsedB,
      winner: actualWinner
    },
    predictionsScored: predictions.length
  });
});

/**
 * PUT /api/admin/matches/:id/lock
 * Lock predictions for a match (before kickoff)
 */
router.put('/matches/:id/lock', authenticateAdmin, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE matches SET is_locked = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

/**
 * PUT /api/admin/matches/:id/unlock
 * Unlock predictions for a match
 */
router.put('/matches/:id/unlock', authenticateAdmin, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE matches SET is_locked = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

/**
 * GET /api/admin/audit
 * View audit log
 */
router.get('/audit', authenticateAdmin, (req, res) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const logs = db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?').all(limit);
  res.json({ logs });
});

/**
 * GET /api/admin/fraud-report
 * Suspicious activity report
 */
router.get('/fraud-report', authenticateAdmin, (req, res) => {
  const db = getDb();

  // Devices linked to multiple associates
  const sharedDevices = db.prepare(`
    SELECT device_fingerprint, GROUP_CONCAT(DISTINCT associate_id) as associate_ids, COUNT(DISTINCT associate_id) as count
    FROM device_registry
    GROUP BY device_fingerprint
    HAVING count > 1
  `).all();

  // IPs with multiple associates
  const sharedIps = db.prepare(`
    SELECT ip_address, GROUP_CONCAT(DISTINCT associate_id) as associate_ids, COUNT(DISTINCT associate_id) as count
    FROM predictions
    GROUP BY ip_address
    HAVING count > 3
  `).all();

  // Suspicious audit events
  const suspiciousEvents = db.prepare(`
    SELECT * FROM audit_log
    WHERE event_type IN ('CROSS_DEVICE_ATTEMPT', 'CROSS_LOGIN_ATTEMPT', 'FINGERPRINT_MISMATCH', 'RATE_LIMIT')
    ORDER BY created_at DESC
    LIMIT 50
  `).all();

  res.json({
    sharedDevices,
    sharedIps,
    suspiciousEvents
  });
});

/**
 * Rebuild the leaderboard table from predictions
 */
function rebuildLeaderboard(db) {
  db.exec(`
    DELETE FROM leaderboard;

    INSERT INTO leaderboard (associate_id, total_points, exact_scores, correct_winners, total_predictions, last_updated)
    SELECT
      p.associate_id,
      COALESCE(SUM(p.points_earned), 0) as total_points,
      COALESCE(SUM(CASE WHEN p.points_earned = 5 THEN 1 ELSE 0 END), 0) as exact_scores,
      COALESCE(SUM(CASE WHEN p.points_earned = 2 THEN 1 ELSE 0 END), 0) as correct_winners,
      COUNT(*) as total_predictions,
      CURRENT_TIMESTAMP
    FROM predictions p
    JOIN matches m ON p.match_id = m.id
    WHERE m.is_completed = 1
    GROUP BY p.associate_id;
  `);
}

module.exports = router;
