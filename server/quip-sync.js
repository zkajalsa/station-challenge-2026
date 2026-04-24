/**
 * QUIP Leaderboard Sync Script
 *
 * Pushes the current leaderboard data to a QUIP spreadsheet.
 * Run manually or on a schedule: npm run quip-sync
 *
 * Setup:
 * 1. Create a QUIP spreadsheet with columns:
 *    Rank | Login | Name | Shift | Points | Exact Scores | Correct Winners | Predictions
 * 2. Set environment variables:
 *    QUIP_TOKEN=your_quip_api_token
 *    QUIP_THREAD_ID=your_spreadsheet_thread_id
 *
 * QUIP API docs: https://quip.com/dev/automation/documentation
 */

const https = require('https');
const { getDb } = require('./database');

const QUIP_TOKEN = process.env.QUIP_TOKEN || 'YOUR_QUIP_TOKEN_HERE';
const QUIP_THREAD_ID = process.env.QUIP_THREAD_ID || 'YOUR_THREAD_ID_HERE';
const QUIP_API_BASE = 'https://platform.quip.com';

// ─── QUIP API Helper ───
function quipRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'platform.quip.com',
      path: `/1${path}`,
      method,
      headers: {
        'Authorization': `Bearer ${QUIP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── Build Leaderboard HTML for QUIP ───
function buildLeaderboardHtml(leaderboardData, shiftLabel, winnerCount) {
  const rows = leaderboardData.map((row, i) => {
    const isWinner = i < winnerCount;
    const style = isWinner ? ' style="background-color: #fff3cd;"' : '';
    return `<tr${style}>
      <td>${i + 1}</td>
      <td>${row.login}</td>
      <td>${row.full_name}</td>
      <td>${row.shift}</td>
      <td><b>${row.total_points}</b></td>
      <td>${row.exact_scores}</td>
      <td>${row.correct_winners}</td>
      <td>${row.total_predictions}</td>
      ${isWinner ? '<td>🏆 WINNER</td>' : '<td></td>'}
    </tr>`;
  }).join('\n');

  return `
    <h2>🏆 ${shiftLabel} — Top ${winnerCount} Winners</h2>
    <table>
      <tr>
        <th>Rank</th>
        <th>Login</th>
        <th>Name</th>
        <th>Shift</th>
        <th>Points</th>
        <th>🎯 Exact</th>
        <th>✓ Winner</th>
        <th>Predictions</th>
        <th>Status</th>
      </tr>
      ${rows}
    </table>
  `;
}

// ─── Main Sync ───
async function syncToQuip() {
  console.log('📊 Starting QUIP leaderboard sync...\n');

  if (QUIP_TOKEN === 'YOUR_QUIP_TOKEN_HERE') {
    console.log('⚠️  QUIP_TOKEN not configured. Set the QUIP_TOKEN environment variable.');
    console.log('   Get your token at: https://quip.com/dev/token\n');
    console.log('Generating local report instead...\n');
    generateLocalReport();
    return;
  }

  const db = getDb();

  const shifts = [
    { name: 'night', label: 'Night Shift', winners: 5 },
    { name: 'early', label: 'Early Shift', winners: 3 },
    { name: 'late', label: 'Late Shift', winners: 2 }
  ];

  let fullHtml = '<h1>⚽ Station Challenge 2026 — Leaderboard</h1>';
  fullHtml += `<p>Last updated: ${new Date().toLocaleString()}</p>`;

  // Stats
  const totalPredictions = db.prepare('SELECT COUNT(*) as c FROM predictions').get().c;
  const completedMatches = db.prepare('SELECT COUNT(*) as c FROM matches WHERE is_completed = 1').get().c;
  fullHtml += `<p>Total predictions: ${totalPredictions} | Completed matches: ${completedMatches}</p><br>`;

  for (const shift of shifts) {
    const data = db.prepare(`
      SELECT
        a.login, a.full_name, a.shift,
        COALESCE(l.total_points, 0) as total_points,
        COALESCE(l.exact_scores, 0) as exact_scores,
        COALESCE(l.correct_winners, 0) as correct_winners,
        COALESCE(l.total_predictions, 0) as total_predictions
      FROM associates a
      LEFT JOIN leaderboard l ON a.id = l.associate_id
      WHERE a.is_active = 1 AND a.shift = ?
      ORDER BY total_points DESC, exact_scores DESC, correct_winners DESC
    `).all(shift.name);

    fullHtml += buildLeaderboardHtml(data, shift.label, shift.winners);
    fullHtml += '<br>';

    console.log(`  ${shift.label}: ${data.length} associates, top scorer: ${data[0]?.full_name || 'N/A'} (${data[0]?.total_points || 0} pts)`);
  }

  // Push to QUIP
  try {
    const result = await quipRequest('POST', '/threads/edit-document', {
      thread_id: QUIP_THREAD_ID,
      content: fullHtml,
      format: 'html',
      location: 0 // Replace entire document
    });

    console.log('\n✅ QUIP leaderboard updated successfully!');
    console.log(`   Thread: https://quip.com/${QUIP_THREAD_ID}`);

    // Log sync
    db.prepare(`INSERT INTO quip_sync_log (records_synced, status) VALUES (?, 'success')`)
      .run(totalPredictions);
  } catch (err) {
    console.error('\n❌ Failed to sync to QUIP:', err.message);
    db.prepare(`INSERT INTO quip_sync_log (records_synced, status) VALUES (0, ?)`)
      .run('error: ' + err.message);
  }
}

// ─── Local Report (when QUIP not configured) ───
function generateLocalReport() {
  const db = getDb();

  const shifts = [
    { name: 'night', label: 'Night Shift 🌙', winners: 5 },
    { name: 'early', label: 'Early Shift 🌅', winners: 3 },
    { name: 'late', label: 'Late Shift 🌇', winners: 2 }
  ];

  console.log('═══════════════════════════════════════════════');
  console.log('  ⚽ STATION CHALLENGE 2026 — LEADERBOARD');
  console.log('═══════════════════════════════════════════════\n');

  for (const shift of shifts) {
    const data = db.prepare(`
      SELECT
        a.login, a.full_name, a.shift,
        COALESCE(l.total_points, 0) as total_points,
        COALESCE(l.exact_scores, 0) as exact_scores,
        COALESCE(l.correct_winners, 0) as correct_winners,
        COALESCE(l.total_predictions, 0) as total_predictions
      FROM associates a
      LEFT JOIN leaderboard l ON a.id = l.associate_id
      WHERE a.is_active = 1 AND a.shift = ?
      ORDER BY total_points DESC, exact_scores DESC, correct_winners DESC
      LIMIT 20
    `).all(shift.name);

    console.log(`\n  ${shift.label} (Top ${shift.winners} win)`);
    console.log('  ' + '─'.repeat(60));

    data.forEach((row, i) => {
      const marker = i < shift.winners ? ' 🏆' : '';
      console.log(`  ${String(i + 1).padStart(3)}. ${row.full_name.padEnd(25)} ${String(row.total_points).padStart(4)} pts  (🎯${row.exact_scores} ✓${row.correct_winners})${marker}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════\n');
}

syncToQuip();
