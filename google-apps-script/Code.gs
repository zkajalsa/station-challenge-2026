/**
 * STATION CHALLENGE 2026 — Google Apps Script Backend
 * 
 * This is the ONLY place your QUIP token lives. It's safe here.
 * Deploy as: Web App → Execute as Me → Anyone can access
 *
 * QUIP Spreadsheets:
 * 1. MATCHES  → MatchCode | TeamA | TeamB | Group | MatchDate | Venue | Status | ResultA | ResultB
 * 2. PREDICTIONS → Login | FullName | Shift | MatchCode | ScoreA | ScoreB | PredictedWinner | Fingerprint | Timestamp | Points
 */

// ═══ YOUR QUIP CREDENTIALS (fill these in) ═══
const QUIP_TOKEN = 'YOUR_QUIP_TOKEN_HERE';
const MATCHES_THREAD = 'YOUR_MATCHES_THREAD_ID';
const PREDICTIONS_THREAD = 'YOUR_PREDICTIONS_THREAD_ID';
const QUIP_API = 'https://platform.quip-amazon.com/1';

// ─── Entry Points ───

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var result;
    switch (data.action) {
      case 'register': result = doRegister(data); break;
      case 'getMatches': result = doGetMatches(); break;
      case 'getMyPredictions': result = doGetMyPredictions(data.login); break;
      case 'submitPrediction': result = doSubmitPrediction(data); break;
      case 'getLeaderboard': result = doGetLeaderboard(); break;
      default: result = { error: 'Unknown action' };
    }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  // Handle GET requests with payload parameter (fallback for CORS)
  if (e && e.parameter && e.parameter.payload) {
    try {
      var data = JSON.parse(e.parameter.payload);
      var result;
      switch (data.action) {
        case 'register': result = doRegister(data); break;
        case 'getMatches': result = doGetMatches(); break;
        case 'getMyPredictions': result = doGetMyPredictions(data.login); break;
        case 'submitPrediction': result = doSubmitPrediction(data); break;
        case 'getLeaderboard': result = doGetLeaderboard(); break;
        default: result = { error: 'Unknown action' };
      }
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ error: err.message })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
}

// ─── QUIP Helpers ───

function qGet(path) {
  var r = UrlFetchApp.fetch(QUIP_API + path, { headers: { 'Authorization': 'Bearer ' + QUIP_TOKEN }, muteHttpExceptions: true });
  return JSON.parse(r.getContentText());
}

function qPost(path, payload) {
  var r = UrlFetchApp.fetch(QUIP_API + path, {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + QUIP_TOKEN, 'Content-Type': 'application/json' },
    payload: JSON.stringify(payload), muteHttpExceptions: true
  });
  return JSON.parse(r.getContentText());
}

function getRows(threadId) {
  var thread = qGet('/threads/' + threadId);
  var html = thread.html || '';
  var rows = [], rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi, rm, headers = [], first = true;
  while ((rm = rowRe.exec(html)) !== null) {
    var cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi, cm, cells = [];
    while ((cm = cellRe.exec(rm[1])) !== null) cells.push(cm[1].replace(/<[^>]*>/g, '').trim());
    if (!cells.length) continue;
    if (first) { headers = cells; first = false; }
    else { var o = {}; for (var i = 0; i < headers.length; i++) o[headers[i]] = cells[i] || ''; rows.push(o); }
  }
  return rows;
}

function addRow(threadId, cells) {
  var html = '<tr>' + cells.map(function(c) { return '<td>' + String(c||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</td>'; }).join('') + '</tr>';
  return qPost('/threads/edit-document', { thread_id: threadId, format: 'html', content: html, location: 2 });
}

// ─── Actions ───

function doRegister(data) {
  if (!data.login || !data.fullName || !data.shift) return { error: 'All fields required.' };
  var rows = getRows(PREDICTIONS_THREAD);
  var existing = null;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].Login && rows[i].Login.toLowerCase() === data.login.toLowerCase()) { existing = rows[i]; break; }
  }
  if (existing) {
    if (existing.Fingerprint && existing.Fingerprint !== data.fingerprint) {
      return { error: 'This login is registered on a different device.' };
    }
    return { login: existing.Login, fullName: existing.FullName, shift: existing.Shift };
  }
  for (var j = 0; j < rows.length; j++) {
    if (rows[j].Fingerprint === data.fingerprint && rows[j].Login.toLowerCase() !== data.login.toLowerCase()) {
      return { error: 'This device is already registered to ' + rows[j].Login };
    }
  }
  return { login: data.login.toLowerCase(), fullName: data.fullName, shift: data.shift };
}

function doGetMatches() {
  var rows = getRows(MATCHES_THREAD);
  var matches = rows.map(function(r) {
    return { matchCode: r.MatchCode||'', teamA: r.TeamA||'', teamB: r.TeamB||'', group: r.Group||'',
      matchDate: r.MatchDate||'', venue: r.Venue||'', status: (r.Status||'open').toLowerCase(),
      resultA: r.ResultA||'', resultB: r.ResultB||'' };
  });
  return { matches: matches };
}

function doGetMyPredictions(login) {
  if (!login) return { error: 'Login required.' };
  var preds = getRows(PREDICTIONS_THREAD);
  var matches = getRows(MATCHES_THREAD);
  var mm = {};
  for (var i = 0; i < matches.length; i++) mm[matches[i].MatchCode] = matches[i];
  var mine = [];
  for (var j = 0; j < preds.length; j++) {
    var p = preds[j];
    if (p.Login && p.Login.toLowerCase() === login.toLowerCase()) {
      var m = mm[p.MatchCode] || {};
      mine.push({ matchCode: p.MatchCode, teamA: m.TeamA||'', teamB: m.TeamB||'', group: m.Group||'',
        matchDate: m.MatchDate||'', scoreA: p.ScoreA, scoreB: p.ScoreB,
        resultA: m.ResultA||'', resultB: m.ResultB||'', points: p.Points });
    }
  }
  return { predictions: mine };
}

function doSubmitPrediction(data) {
  if (!data.login || !data.matchCode || data.scoreA === undefined || data.scoreB === undefined) return { error: 'All fields required.' };
  var matches = getRows(MATCHES_THREAD);
  var match = null;
  for (var i = 0; i < matches.length; i++) { if (matches[i].MatchCode === data.matchCode) { match = matches[i]; break; } }
  if (!match) return { error: 'Match not found.' };
  if ((match.Status||'').toLowerCase() !== 'open') return { error: 'Predictions for this match are closed.' };

  var preds = getRows(PREDICTIONS_THREAD);
  for (var j = 0; j < preds.length; j++) {
    if (preds[j].Login && preds[j].Login.toLowerCase() === data.login.toLowerCase() && preds[j].MatchCode === data.matchCode) {
      return { error: 'You already predicted this match.' };
    }
  }
  for (var k = 0; k < preds.length; k++) {
    if (preds[k].Fingerprint === data.fingerprint && preds[k].Login.toLowerCase() !== data.login.toLowerCase()) {
      return { error: 'This device belongs to ' + preds[k].Login };
    }
  }

  var a = parseInt(data.scoreA), b = parseInt(data.scoreB);
  var winner = a > b ? match.TeamA : b > a ? match.TeamB : 'draw';
  addRow(PREDICTIONS_THREAD, [data.login.toLowerCase(), data.fullName||data.login, data.shift||'', data.matchCode, String(a), String(b), winner, data.fingerprint, new Date().toISOString(), '']);
  return { success: true };
}

function doGetLeaderboard() {
  var preds = getRows(PREDICTIONS_THREAD);
  var scores = {};
  for (var i = 0; i < preds.length; i++) {
    var p = preds[i];
    if (!p.Login) continue;
    var k = p.Login.toLowerCase();
    if (!scores[k]) scores[k] = { login: p.Login, fullName: p.FullName||p.Login, shift: (p.Shift||'').toLowerCase(), totalPoints: 0, exactScores: 0, correctWinners: 0, total: 0 };
    scores[k].total++;
    if (p.Points !== '' && p.Points !== undefined && p.Points !== null) {
      var pts = parseInt(p.Points) || 0;
      scores[k].totalPoints += pts;
      if (pts === 5) scores[k].exactScores++;
      if (pts === 2) scores[k].correctWinners++;
    }
  }
  var leaderboard = [];
  for (var key in scores) leaderboard.push(scores[key]);
  leaderboard.sort(function(a, b) { return b.totalPoints - a.totalPoints || b.exactScores - a.exactScores || b.correctWinners - a.correctWinners; });
  return { leaderboard: leaderboard };
}
