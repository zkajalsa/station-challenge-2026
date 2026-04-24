/**
 * ═══════════════════════════════════════════════════════════════
 * STATION CHALLENGE 2026 — Google Apps Script Backend
 * ═══════════════════════════════════════════════════════════════
 *
 * Self-registration flow. Only 2 QUIP spreadsheets needed:
 *
 * 1. MATCHES — You pre-fill this with World Cup fixtures
 *    Columns: MatchCode | TeamA | TeamB | Group | MatchDate | Venue | Status | ResultA | ResultB
 *
 * 2. PREDICTIONS — Starts empty, auto-fills as associates vote
 *    Columns: Login | FullName | Shift | MatchCode | ScoreA | ScoreB | PredictedWinner | Fingerprint | Timestamp | Points
 *
 * The Predictions sheet IS the database. Associates + their votes
 * all live in one place. Leaderboard is calculated on the fly.
 *
 * SETUP:
 * 1. Get QUIP token: https://quip.com/dev/token
 * 2. Create 2 spreadsheets, note their Thread IDs
 * 3. Fill in QUIP_CONFIG below
 * 4. Deploy as Web App → Anyone can access
 */

// ═══ FILL THESE IN ═══
const QUIP_CONFIG = {
  TOKEN: 'YOUR_QUIP_API_TOKEN',
  MATCHES_THREAD: 'YOUR_MATCHES_THREAD_ID',
  PREDICTIONS_THREAD: 'YOUR_PREDICTIONS_THREAD_ID'
};

const QUIP_API = 'https://platform.quip.com/1';

// ─── Entry Points ───

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    let result;

    switch (data.action) {
      case 'register':     result = handleRegister(data); break;
      case 'getMatches':   result = handleGetMatches(); break;
      case 'getMyPredictions': result = handleGetMyPredictions(data.login); break;
      case 'submitPrediction': result = handleSubmitPrediction(data); break;
      case 'getLeaderboard':   result = handleGetLeaderboard(); break;
      case 'recordResult':     result = handleRecordResult(data); break;
      default: result = { error: 'Unknown action' };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({ status: 'ok', app: 'Station Challenge 2026' })
  ).setMimeType(ContentService.MimeType.JSON);
}

// ─── QUIP Helpers ───

function quipGet(path) {
  const r = UrlFetchApp.fetch(QUIP_API + path, {
    headers: { 'Authorization': 'Bearer ' + QUIP_CONFIG.TOKEN },
    muteHttpExceptions: true
  });
  return JSON.parse(r.getContentText());
}

function quipPost(path, payload) {
  const r = UrlFetchApp.fetch(QUIP_API + path, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + QUIP_CONFIG.TOKEN, 'Content-Type': 'application/json' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  return JSON.parse(r.getContentText());
}

function parseSheet(threadId) {
  const thread = quipGet('/threads/' + threadId);
  const html = thread.html || '';
  const rows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rm, headers = [], first = true;

  while ((rm = rowRe.exec(html)) !== null) {
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cm, cells = [];
    while ((cm = cellRe.exec(rm[1])) !== null) {
      cells.push(cm[1].replace(/<[^>]*>/g, '').trim());
    }
    if (!cells.length) continue;
    if (first) { headers = cells; first = false; }
    else {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = cells[i] || ''; });
      rows.push(obj);
    }
  }
  return { rows, headers };
}

function addRow(threadId, cells) {
  const html = '<tr>' + cells.map(c => '<td>' + esc(String(c || '')) + '</td>').join('') + '</tr>';
  return quipPost('/threads/edit-document', {
    thread_id: threadId, format: 'html', content: html, location: 2
  });
}

function esc(t) { return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ─── REGISTER ───
// First time: store login+fingerprint. Returning user: verify fingerprint.

function handleRegister(data) {
  const { login, fullName, shift, fingerprint } = data;
  if (!login || !fullName || !shift) return { error: 'All fields are required.' };
  if (!['night','early','late'].includes(shift)) return { error: 'Invalid shift.' };

  const preds = parseSheet(QUIP_CONFIG.PREDICTIONS_THREAD);

  // Check if this login already exists
  const existing = preds.rows.find(r => r.Login && r.Login.toLowerCase() === login.toLowerCase());

  if (existing) {
    // Returning user — verify fingerprint
    if (existing.Fingerprint && existing.Fingerprint !== fingerprint) {
      return { error: 'This login is already registered on a different device. Use your original device or contact your manager.' };
    }
    // Welcome back
    return { login: existing.Login, fullName: existing.FullName, shift: existing.Shift };
  }

  // New user — check if this device fingerprint is already used by someone else
  const deviceUsed = preds.rows.find(r => r.Fingerprint === fingerprint && r.Login.toLowerCase() !== login.toLowerCase());
  if (deviceUsed) {
    return { error: 'This device is already registered to ' + deviceUsed.Login + '. One device per person.' };
  }

  // All good — they'll be added to the sheet on their first prediction
  return { login: login.toLowerCase(), fullName, shift };
}

// ─── GET MATCHES ───

function handleGetMatches() {
  const sheet = parseSheet(QUIP_CONFIG.MATCHES_THREAD);
  const matches = sheet.rows.map(r => ({
    matchCode: r.MatchCode || '',
    teamA: r.TeamA || '',
    teamB: r.TeamB || '',
    group: r.Group || '',
    matchDate: r.MatchDate || '',
    venue: r.Venue || '',
    status: (r.Status || 'open').toLowerCase(),
    resultA: r.ResultA || '',
    resultB: r.ResultB || ''
  }));
  return { matches };
}

// ─── GET MY PREDICTIONS ───

function handleGetMyPredictions(login) {
  if (!login) return { error: 'Login required.' };

  const preds = parseSheet(QUIP_CONFIG.PREDICTIONS_THREAD);
  const matches = parseSheet(QUIP_CONFIG.MATCHES_THREAD);
  const matchMap = {};
  matches.rows.forEach(m => { matchMap[m.MatchCode] = m; });

  const myPreds = preds.rows
    .filter(p => p.Login && p.Login.toLowerCase() === login.toLowerCase())
    .map(p => {
      const m = matchMap[p.MatchCode] || {};
      return {
        matchCode: p.MatchCode,
        teamA: m.TeamA || '', teamB: m.TeamB || '',
        group: m.Group || '', matchDate: m.MatchDate || '',
        scoreA: p.ScoreA, scoreB: p.ScoreB,
        predictedWinner: p.PredictedWinner,
        resultA: m.ResultA || '', resultB: m.ResultB || '',
        points: p.Points
      };
    });

  return { predictions: myPreds };
}

// ─── SUBMIT PREDICTION ───

function handleSubmitPrediction(data) {
  const { login, fullName, shift, matchCode, scoreA, scoreB, fingerprint } = data;
  if (!login || !matchCode || scoreA === undefined || scoreB === undefined) {
    return { error: 'All fields required.' };
  }

  // Verify match is open
  const matches = parseSheet(QUIP_CONFIG.MATCHES_THREAD);
  const match = matches.rows.find(m => m.MatchCode === matchCode);
  if (!match) return { error: 'Match not found.' };
  if ((match.Status || '').toLowerCase() !== 'open') {
    return { error: 'Predictions for this match are closed.' };
  }

  // Check duplicate
  const preds = parseSheet(QUIP_CONFIG.PREDICTIONS_THREAD);
  const dup = preds.rows.find(p =>
    p.Login && p.Login.toLowerCase() === login.toLowerCase() && p.MatchCode === matchCode
  );
  if (dup) return { error: 'You already predicted this match.' };

  // Check device not used by another person
  const deviceUsed = preds.rows.find(p =>
    p.Fingerprint === fingerprint && p.Login.toLowerCase() !== login.toLowerCase()
  );
  if (deviceUsed) {
    return { error: 'This device belongs to ' + deviceUsed.Login + '. Use your own device.' };
  }

  // Determine winner
  const a = parseInt(scoreA), b = parseInt(scoreB);
  const winner = a > b ? match.TeamA : b > a ? match.TeamB : 'draw';

  // Write to QUIP — this row IS the associate record + prediction in one
  addRow(QUIP_CONFIG.PREDICTIONS_THREAD, [
    login.toLowerCase(), fullName || login, shift || '',
    matchCode, String(a), String(b), winner,
    fingerprint, new Date().toISOString(), ''
  ]);

  return { success: true };
}

// ─── LEADERBOARD ───
// Built on the fly from predictions that have Points filled in

function handleGetLeaderboard() {
  const preds = parseSheet(QUIP_CONFIG.PREDICTIONS_THREAD);

  const scores = {};
  preds.rows.forEach(p => {
    if (!p.Login) return;
    const key = p.Login.toLowerCase();
    if (!scores[key]) {
      scores[key] = {
        login: p.Login, fullName: p.FullName || p.Login, shift: (p.Shift || '').toLowerCase(),
        totalPoints: 0, exactScores: 0, correctWinners: 0, totalPredictions: 0
      };
    }
    scores[key].totalPredictions++;
    if (p.Points !== '' && p.Points !== undefined) {
      const pts = parseInt(p.Points) || 0;
      scores[key].totalPoints += pts;
      if (pts === 5) scores[key].exactScores++;
      if (pts === 2) scores[key].correctWinners++;
    }
  });

  const leaderboard = Object.values(scores);
  leaderboard.sort((a, b) =>
    b.totalPoints - a.totalPoints ||
    b.exactScores - a.exactScores ||
    b.correctWinners - a.correctWinners
  );

  return { leaderboard };
}

// ─── ADMIN: Record Result ───
// Call this manually or build a simple admin page
// After updating the Matches sheet with ResultA/ResultB/Status=completed,
// run this to score all predictions for that match.

function handleRecordResult(data) {
  // This is a helper — in practice you'll update the Matches sheet in QUIP directly
  // and then update Points in the Predictions sheet
  return {
    message: 'To score: 1) Update Matches sheet with ResultA, ResultB, Status=completed. ' +
             '2) In Predictions sheet, fill Points column: 5=exact score, 2=correct winner, 0=wrong.'
  };
}

// ─── Utility: Score all predictions for a match (run manually) ───
function scoreMatch(matchCode, actualA, actualB) {
  const preds = parseSheet(QUIP_CONFIG.PREDICTIONS_THREAD);
  const actualWinner = actualA > actualB ? 'teamA' : actualB > actualA ? 'teamB' : 'draw';

  let scored = 0;
  preds.rows.forEach(p => {
    if (p.MatchCode !== matchCode) return;
    const predA = parseInt(p.ScoreA), predB = parseInt(p.ScoreB);
    let points = 0;
    if (predA === actualA && predB === actualB) points = 5;
    else if (p.PredictedWinner === actualWinner) points = 2;
    // Note: To update Points in QUIP you'd need the cell's section_id
    // For simplicity, update Points manually in the QUIP spreadsheet
    scored++;
    Logger.log(p.Login + ': ' + points + ' points');
  });

  return scored;
}
