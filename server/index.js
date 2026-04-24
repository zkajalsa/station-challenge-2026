const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./database');
const authRoutes = require('./routes/auth');
const matchRoutes = require('./routes/matches');
const predictionRoutes = require('./routes/predictions');
const leaderboardRoutes = require('./routes/leaderboard');
const adminRoutes = require('./routes/admin');
const qrRoutes = require('./routes/qr');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy for accurate IP detection behind load balancers
app.set('trust proxy', true);

// Serve static frontend
app.use(express.static(path.join(__dirname, '..', 'app', 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/qr', qrRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'app', 'public', 'index.html'));
  }
});

// Initialize DB on startup and auto-seed if empty
const db = getDb();
const count = db.prepare('SELECT COUNT(*) as c FROM associates').get().c;
if (count === 0) {
  console.log('🌱 First run detected — seeding database...');
  require('./seed-auto');
}

app.listen(PORT, () => {
  console.log(`\n⚽ Station Challenge 2026 running on http://localhost:${PORT}`);
  console.log(`📱 Share the QR code with your associates!\n`);
});

module.exports = app;
