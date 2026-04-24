const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { rateLimit, getClientIp, logAudit } = require('../middleware/antifraud');

const router = express.Router();

/**
 * POST /api/auth/login
 * Associate logs in with their Amazon login + badge ID
 * Returns a session token tied to their device
 */
router.post('/login', rateLimit, (req, res) => {
  const { login, badgeId, deviceFingerprint } = req.body;

  if (!login || !deviceFingerprint) {
    return res.status(400).json({ error: 'Login and device verification are required.' });
  }

  const db = getDb();
  const cleanLogin = login.trim().toLowerCase();

  // Find associate
  const associate = db.prepare(
    'SELECT * FROM associates WHERE LOWER(login) = ?'
  ).get(cleanLogin);

  if (!associate) {
    logAudit('LOGIN_FAILED', null, `Unknown login: ${cleanLogin}`, getClientIp(req), deviceFingerprint);
    return res.status(404).json({
      error: 'Login not found. Make sure you are registered for the Station Challenge.'
    });
  }

  if (!associate.is_active) {
    return res.status(403).json({ error: 'Your account is deactivated. Contact your manager.' });
  }

  // Optional badge ID verification for extra security
  if (badgeId && associate.badge_id && associate.badge_id !== badgeId.trim()) {
    logAudit('BADGE_MISMATCH', associate.id, `Provided: ${badgeId}, Expected: ${associate.badge_id}`, getClientIp(req), deviceFingerprint);
    return res.status(401).json({ error: 'Badge ID does not match. Please try again.' });
  }

  // Check if this device is already registered to someone else
  const existingDevice = db.prepare(`
    SELECT associate_id FROM device_registry
    WHERE device_fingerprint = ? AND associate_id != ?
  `).get(deviceFingerprint, associate.id);

  if (existingDevice) {
    logAudit('CROSS_LOGIN_ATTEMPT', associate.id,
      `Device already belongs to associate ${existingDevice.associate_id}`,
      getClientIp(req), deviceFingerprint);
    return res.status(403).json({
      error: 'This device is already linked to another associate. Please use your own device.'
    });
  }

  // Invalidate old sessions for this associate
  db.prepare('UPDATE sessions SET is_valid = 0 WHERE associate_id = ?').run(associate.id);

  // Create new session
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

  db.prepare(`
    INSERT INTO sessions (associate_id, token, device_fingerprint, ip_address, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(associate.id, token, deviceFingerprint, getClientIp(req), expiresAt);

  // Register / update device
  const existingReg = db.prepare(
    'SELECT id FROM device_registry WHERE associate_id = ? AND device_fingerprint = ?'
  ).get(associate.id, deviceFingerprint);

  if (existingReg) {
    db.prepare(
      'UPDATE device_registry SET last_seen = CURRENT_TIMESTAMP, ip_address = ? WHERE id = ?'
    ).run(getClientIp(req), existingReg.id);
  } else {
    db.prepare(`
      INSERT INTO device_registry (associate_id, device_fingerprint, ip_address, user_agent)
      VALUES (?, ?, ?, ?)
    `).run(associate.id, deviceFingerprint, getClientIp(req), req.headers['user-agent'] || '');
  }

  logAudit('LOGIN_SUCCESS', associate.id, 'Logged in successfully', getClientIp(req), deviceFingerprint);

  res.json({
    success: true,
    token,
    associate: {
      login: associate.login,
      fullName: associate.full_name,
      shift: associate.shift,
      badgeId: associate.badge_id
    }
  });
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  const token = req.headers['x-session-token'];
  if (token) {
    const db = getDb();
    db.prepare('UPDATE sessions SET is_valid = 0 WHERE token = ?').run(token);
  }
  res.json({ success: true });
});

/**
 * GET /api/auth/me
 * Check current session validity
 */
router.get('/me', (req, res) => {
  const token = req.headers['x-session-token'];
  if (!token) {
    return res.status(401).json({ error: 'Not logged in.' });
  }

  const db = getDb();
  const session = db.prepare(`
    SELECT a.login, a.full_name, a.shift, a.badge_id
    FROM sessions s
    JOIN associates a ON s.associate_id = a.id
    WHERE s.token = ? AND s.is_valid = 1 AND s.expires_at > datetime('now') AND a.is_active = 1
  `).get(token);

  if (!session) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  res.json({
    loggedIn: true,
    associate: {
      login: session.login,
      fullName: session.full_name,
      shift: session.shift,
      badgeId: session.badge_id
    }
  });
});

module.exports = router;
