const { getDb } = require('../database');

/**
 * Anti-fraud middleware
 * - Validates session token
 * - Checks device fingerprint consistency
 * - Logs suspicious activity
 */
function authenticateSession(req, res, next) {
  const token = req.headers['x-session-token'];
  if (!token) {
    return res.status(401).json({ error: 'Session token required. Please log in.' });
  }

  const db = getDb();
  const session = db.prepare(`
    SELECT s.*, a.login, a.full_name, a.shift, a.badge_id, a.is_active
    FROM sessions s
    JOIN associates a ON s.associate_id = a.id
    WHERE s.token = ? AND s.is_valid = 1 AND s.expires_at > datetime('now')
  `).get(token);

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  if (!session.is_active) {
    return res.status(403).json({ error: 'Account is deactivated. Contact your manager.' });
  }

  // Attach associate info to request
  req.associate = {
    id: session.associate_id,
    login: session.login,
    fullName: session.full_name,
    shift: session.shift,
    badgeId: session.badge_id,
    sessionFingerprint: session.device_fingerprint
  };

  next();
}

/**
 * Validate device fingerprint matches the session
 * Prevents token theft / session hijacking
 */
function validateDevice(req, res, next) {
  const fingerprint = req.headers['x-device-fingerprint'];
  if (!fingerprint) {
    logAudit('MISSING_FINGERPRINT', req.associate?.id, 'No device fingerprint provided', getClientIp(req));
    return res.status(400).json({ error: 'Device verification failed.' });
  }

  if (req.associate && req.associate.sessionFingerprint !== fingerprint) {
    logAudit('FINGERPRINT_MISMATCH', req.associate.id,
      `Expected: ${req.associate.sessionFingerprint}, Got: ${fingerprint}`,
      getClientIp(req), fingerprint);
    return res.status(403).json({ error: 'Device mismatch detected. Please log in again from this device.' });
  }

  req.deviceFingerprint = fingerprint;
  next();
}

/**
 * Check if a device fingerprint is already registered to a different associate
 * Prevents one person voting on behalf of another
 */
function checkDeviceOwnership(req, res, next) {
  const fingerprint = req.headers['x-device-fingerprint'];
  const associateId = req.associate?.id;

  if (!fingerprint || !associateId) {
    return next();
  }

  const db = getDb();
  const existingDevice = db.prepare(`
    SELECT associate_id FROM device_registry
    WHERE device_fingerprint = ? AND associate_id != ?
    LIMIT 1
  `).get(fingerprint, associateId);

  if (existingDevice) {
    logAudit('CROSS_DEVICE_ATTEMPT', associateId,
      `Device ${fingerprint} already registered to associate ${existingDevice.associate_id}`,
      getClientIp(req), fingerprint);
    return res.status(403).json({
      error: 'This device is already registered to another associate. Use your own device to participate.'
    });
  }

  next();
}

/**
 * Rate limiting per IP — simple in-memory store
 */
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 30; // max requests per window

function rateLimit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();

  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return next();
  }

  const entry = rateLimitStore.get(ip);
  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + RATE_LIMIT_WINDOW;
    return next();
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    logAudit('RATE_LIMIT', null, `IP ${ip} exceeded rate limit`, ip);
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  next();
}

// Cleanup rate limit store every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(ip);
  }
}, 5 * 60 * 1000);

/**
 * Admin authentication via PIN
 */
function authenticateAdmin(req, res, next) {
  const adminToken = req.headers['x-admin-token'];
  if (!adminToken) {
    return res.status(401).json({ error: 'Admin authentication required.' });
  }

  const db = getDb();
  // Simple token check — in production use proper hashing
  const admin = db.prepare('SELECT * FROM admins WHERE pin_hash = ?').get(adminToken);
  if (!admin) {
    return res.status(403).json({ error: 'Invalid admin credentials.' });
  }

  req.admin = admin;
  next();
}

// Helpers
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.connection?.remoteAddress
    || req.ip
    || 'unknown';
}

function logAudit(eventType, associateId, details, ip, fingerprint) {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO audit_log (event_type, associate_id, details, ip_address, device_fingerprint)
      VALUES (?, ?, ?, ?, ?)
    `).run(eventType, associateId, details, ip, fingerprint || null);
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

module.exports = {
  authenticateSession,
  validateDevice,
  checkDeviceOwnership,
  rateLimit,
  authenticateAdmin,
  getClientIp,
  logAudit
};
