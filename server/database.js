const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'station_challenge.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeDatabase();
  }
  return db;
}

function initializeDatabase() {
  db.exec(`
    -- Associates table: all 200 people
    CREATE TABLE IF NOT EXISTS associates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      badge_id TEXT UNIQUE,
      full_name TEXT NOT NULL,
      shift TEXT NOT NULL CHECK(shift IN ('night', 'early', 'late')),
      registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1
    );

    -- Matches table: World Cup 2026 fixtures
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_code TEXT UNIQUE NOT NULL,
      team_a TEXT NOT NULL,
      team_b TEXT NOT NULL,
      group_stage TEXT,
      match_date DATETIME NOT NULL,
      venue TEXT,
      actual_result_a INTEGER DEFAULT NULL,
      actual_result_b INTEGER DEFAULT NULL,
      actual_winner TEXT DEFAULT NULL,
      is_locked INTEGER DEFAULT 0,
      is_completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Predictions table: one per associate per match
    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      associate_id INTEGER NOT NULL,
      match_id INTEGER NOT NULL,
      predicted_score_a INTEGER NOT NULL,
      predicted_score_b INTEGER NOT NULL,
      predicted_winner TEXT NOT NULL,
      device_fingerprint TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      user_agent TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      points_earned INTEGER DEFAULT 0,
      FOREIGN KEY (associate_id) REFERENCES associates(id),
      FOREIGN KEY (match_id) REFERENCES matches(id),
      UNIQUE(associate_id, match_id)
    );

    -- Device registry: track devices to prevent cross-voting
    CREATE TABLE IF NOT EXISTS device_registry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      associate_id INTEGER NOT NULL,
      device_fingerprint TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      user_agent TEXT,
      first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (associate_id) REFERENCES associates(id)
    );

    -- Session tokens for authenticated access
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      associate_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      device_fingerprint TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      is_valid INTEGER DEFAULT 1,
      FOREIGN KEY (associate_id) REFERENCES associates(id)
    );

    -- Leaderboard cache
    CREATE TABLE IF NOT EXISTS leaderboard (
      associate_id INTEGER PRIMARY KEY,
      total_points INTEGER DEFAULT 0,
      exact_scores INTEGER DEFAULT 0,
      correct_winners INTEGER DEFAULT 0,
      total_predictions INTEGER DEFAULT 0,
      current_streak INTEGER DEFAULT 0,
      best_streak INTEGER DEFAULT 0,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (associate_id) REFERENCES associates(id)
    );

    -- Admin users
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      pin_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Audit log for anti-fraud
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      associate_id INTEGER,
      details TEXT,
      ip_address TEXT,
      device_fingerprint TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- QUIP sync tracking
    CREATE TABLE IF NOT EXISTS quip_sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      records_synced INTEGER DEFAULT 0,
      status TEXT DEFAULT 'success'
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_predictions_associate ON predictions(associate_id);
    CREATE INDEX IF NOT EXISTS idx_predictions_match ON predictions(match_id);
    CREATE INDEX IF NOT EXISTS idx_device_registry_fingerprint ON device_registry(device_fingerprint);
    CREATE INDEX IF NOT EXISTS idx_device_registry_associate ON device_registry(associate_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_associates_login ON associates(login);
    CREATE INDEX IF NOT EXISTS idx_associates_shift ON associates(shift);
  `);
}

module.exports = { getDb };
