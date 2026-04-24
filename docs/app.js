/**
 * Station Challenge 2026 — Frontend (GitHub Pages + Google Apps Script + QUIP)
 * Pure static site. All data flows through Google Apps Script → QUIP.
 */

// ─── State ───
let state = {
  associate: JSON.parse(localStorage.getItem('sc_associate') || 'null'),
  fingerprint: null,
  matches: [],
  predictions: {},       // matchCode → prediction object
  leaderboard: [],
  currentMatchFilter: 'upcoming',
  currentShiftFilter: 'all',
  selectedMatch: null
};

// ─── Device Fingerprint ───
async function getFingerprint() {
  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    state.fingerprint = result.visitorId;
  } catch {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fp2026', 2, 2);
    const raw = [
      navigator.userAgent, navigator.language,
      screen.width + 'x' + screen.height, screen.colorDepth,
      new Date().getTimezoneOffset(), navigator.hardwareConcurrency,
      canvas.toDataURL()
    ].join('|');
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash = hash & hash;
    }
    state.fingerprint = 'fb_' + Math.abs(hash).toString(36);
  }
}

// ─── API Call to Google Apps Script ───
async function api(action, data = {}) {
  if (CONFIG.API_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
    throw new Error('App not configured yet. Admin needs to set up the Google Apps Script backend. See SETUP-GUIDE.md');
  }

  const payload = { action, ...data };
  if (state.fingerprint) payload.fingerprint = state.fingerprint;
  if (state.associate) payload.login = state.associate.login;

  const response = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // Apps Script needs this for CORS
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (result.error) throw new Error(result.error);
  return result;
}

// ─── Country Flags ───
const flags = {
  'USA':'🇺🇸','Mexico':'🇲🇽','Canada':'🇨🇦','Brazil':'🇧🇷','Argentina':'🇦🇷',
  'France':'🇫🇷','England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Germany':'🇩🇪','Spain':'🇪🇸','Portugal':'🇵🇹',
  'Netherlands':'🇳🇱','Belgium':'🇧🇪','Italy':'🇮🇹','Japan':'🇯🇵','South Korea':'🇰🇷',
  'Australia':'🇦🇺','Morocco':'🇲🇦','Senegal':'🇸🇳','Croatia':'🇭🇷','Uruguay':'🇺🇾',
  'Colombia':'🇨🇴','Switzerland':'🇨🇭','Denmark':'🇩🇰','Poland':'🇵🇱','Serbia':'🇷🇸',
  'TBD':'🏳️','draw':'🤝'
};
function getFlag(t) { return flags[t] || (t && t.startsWith('TBD') ? '🏳️' : '⚽'); }

// ─── Screen Management ───
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ─── Login ───
async function handleLogin(e) {
  e.preventDefault();
  const loginVal = document.getElementById('login-input').value.trim().toLowerCase();
  const badgeVal = document.getElementById('badge-input').value.trim();
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  if (!loginVal) return;
  errorEl.style.display = 'none';
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Signing in...';

  try {
    const result = await api('login', {
      login: loginVal,
      badgeId: badgeVal,
      fingerprint: state.fingerprint
    });

    state.associate = result.associate;
    localStorage.setItem('sc_associate', JSON.stringify(result.associate));
    initMainApp();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Sign In';
  }
}

function handleLogout() {
  state.associate = null;
  state.predictions = {};
  localStorage.removeItem('sc_associate');
  showScreen('login-screen');
}

// ─── Main App ───
function initMainApp() {
  showScreen('main-screen');
  document.getElementById('user-name').textContent = state.associate.fullName || state.associate.login;
  const shiftEl = document.getElementById('user-shift');
  shiftEl.textContent = state.associate.shift;
  shiftEl.className = 'shift-badge ' + state.associate.shift;

  loadMatches();
  loadLeaderboard();
  loadWinners();
}

// ─── Matches ───
async function loadMatches() {
  const container = document.getElementById('matches-list');
  container.innerHTML = '<div class="empty-state">Loading matches...</div>';

  try {
    const data = await api('getMatches');
    state.matches = data.matches || [];

    // Also load user's predictions
    if (state.associate) {
      try {
        const predData = await api('getMyPredictions', { login: state.associate.login });
        state.predictions = {};
        (predData.predictions || []).forEach(p => {
          state.predictions[p.matchCode] = p;
        });
      } catch {}
    }

    renderMatches();
  } catch (err) {
    container.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

function renderMatches() {
  const container = document.getElementById('matches-list');
  const filter = state.currentMatchFilter;
  const now = new Date();

  let filtered = state.matches.filter(m => {
    if (filter === 'upcoming') return m.status === 'open';
    if (filter === 'locked') return m.status === 'locked';
    if (filter === 'completed') return m.status === 'completed';
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No matches for this filter.</div>';
    return;
  }

  container.innerHTML = filtered.map(match => {
    const pred = state.predictions[match.matchCode];
    const d = new Date(match.matchDate);
    const dateStr = d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });

    let actionHtml = '';
    if (match.status === 'completed') {
      actionHtml = `<span class="match-score">${match.resultA} - ${match.resultB}</span>`;
    } else if (match.status === 'locked') {
      actionHtml = pred
        ? `<span class="prediction-badge locked">Locked: ${pred.scoreA}-${pred.scoreB}</span>`
        : `<span class="prediction-badge locked">Predictions Closed</span>`;
    } else if (pred) {
      actionHtml = `<span class="prediction-badge submitted">✓ ${pred.scoreA}-${pred.scoreB}</span>`;
    } else {
      actionHtml = `<button class="btn-predict" onclick="openModal('${match.matchCode}','${match.teamA}','${match.teamB}')">Predict</button>`;
    }

    return `
      <div class="match-card">
        <div class="match-card-header">
          <span class="match-group">${match.group || match.matchCode}</span>
          <span class="match-date">${dateStr} · ${timeStr}</span>
        </div>
        <div class="match-teams">
          <div class="match-team">
            <span>${getFlag(match.teamA)}</span>
            <span class="match-team-name">${match.teamA}</span>
          </div>
          <span class="match-vs">VS</span>
          <div class="match-team">
            <span>${getFlag(match.teamB)}</span>
            <span class="match-team-name">${match.teamB}</span>
          </div>
        </div>
        <div class="match-card-footer">
          <span class="match-venue">📍 ${match.venue || 'TBD'}</span>
          ${actionHtml}
        </div>
      </div>`;
  }).join('');
}

// ─── My Predictions ───
async function loadMyPredictions() {
  const container = document.getElementById('my-predictions-list');
  container.innerHTML = '<div class="empty-state">Loading your predictions...</div>';

  try {
    const data = await api('getMyPredictions', { login: state.associate.login });
    const preds = data.predictions || [];

    if (preds.length === 0) {
      container.innerHTML = '<div class="empty-state">No predictions yet. Head to Matches to get started!</div>';
      return;
    }

    container.innerHTML = preds.map(p => {
      let pointsHtml;
      if (p.points !== undefined && p.points !== '') {
        const pts = parseInt(p.points);
        const cls = pts === 5 ? 'pts-5' : pts === 2 ? 'pts-2' : 'pts-0';
        const label = pts === 5 ? '🎯 Exact Score!' : pts === 2 ? '✓ Correct Winner' : '✗ Wrong';
        pointsHtml = `<span class="points-badge ${cls}">${label} (+${pts} pts)</span>`;
      } else {
        pointsHtml = `<span class="points-badge pending">⏳ Pending</span>`;
      }

      return `
        <div class="prediction-card">
          <div class="match-info">
            <span class="match-group">${p.group || p.matchCode}</span>
            <span class="match-date">${new Date(p.matchDate).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
          </div>
          <div class="your-pick">
            ${getFlag(p.teamA)} ${p.teamA} ${p.scoreA} - ${p.scoreB} ${p.teamB} ${getFlag(p.teamB)}
          </div>
          ${p.resultA !== undefined && p.resultA !== '' ? `<div class="actual-result">Actual: ${p.resultA} - ${p.resultB}</div>` : ''}
          <div style="text-align:center;">${pointsHtml}</div>
        </div>`;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

// ─── Leaderboard ───
async function loadLeaderboard() {
  const container = document.getElementById('leaderboard-table');
  container.innerHTML = '<div class="empty-state">Loading leaderboard...</div>';

  try {
    const data = await api('getLeaderboard');
    state.leaderboard = data.leaderboard || [];
    renderLeaderboard();
  } catch (err) {
    container.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

function renderLeaderboard() {
  const container = document.getElementById('leaderboard-table');
  let filtered = state.leaderboard;
  if (state.currentShiftFilter !== 'all') {
    filtered = filtered.filter(r => r.shift === state.currentShiftFilter);
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No scores yet. Predictions are scored after matches complete.</div>';
    return;
  }

  const myLogin = state.associate?.login?.toLowerCase();

  container.innerHTML = `
    <table class="leaderboard-table">
      <thead><tr><th>#</th><th>Associate</th><th>Shift</th><th>Pts</th><th>🎯</th><th>✓</th></tr></thead>
      <tbody>
        ${filtered.map((row, i) => {
          const isMe = row.login?.toLowerCase() === myLogin;
          const rank = i + 1;
          const rc = rank <= 3 ? `rank-${rank}` : '';
          const medal = rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : rank;
          return `<tr class="${isMe ? 'highlight-row' : ''}">
            <td class="rank-cell ${rc}">${medal}</td>
            <td class="name-cell">${row.fullName}${isMe ? ' (You)' : ''}</td>
            <td><span class="shift-badge ${row.shift}">${row.shift}</span></td>
            <td class="points-cell">${row.totalPoints}</td>
            <td>${row.exactScores || 0}</td>
            <td>${row.correctWinners || 0}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

// ─── Winners ───
async function loadWinners() {
  const container = document.getElementById('winners-display');
  container.innerHTML = '<div class="empty-state">Loading winners...</div>';

  try {
    const data = await api('getLeaderboard');
    const all = data.leaderboard || [];

    const shiftConfig = [
      { key: 'night', label: 'Night Shift', icon: '🌙', count: CONFIG.WINNERS.night },
      { key: 'early', label: 'Early Shift', icon: '🌅', count: CONFIG.WINNERS.early },
      { key: 'late', label: 'Late Shift', icon: '🌇', count: CONFIG.WINNERS.late }
    ];

    container.innerHTML = shiftConfig.map(shift => {
      const winners = all.filter(r => r.shift === shift.key).slice(0, shift.count);
      const rows = winners.length > 0
        ? winners.map((w, i) => `
            <div class="winner-row">
              <span class="winner-rank">${i + 1}</span>
              <div class="winner-info">
                <div class="winner-name">${w.fullName}</div>
                <div class="winner-login">${w.login}</div>
              </div>
              <span class="winner-points">${w.totalPoints} pts</span>
            </div>`).join('')
        : '<div class="empty-state" style="padding:16px;">No scores yet</div>';

      return `
        <div class="winners-section">
          <h3>${shift.icon} ${shift.label}</h3>
          <div class="winner-count">Top ${shift.count} winners</div>
          ${rows}
        </div>`;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

// ─── Prediction Modal ───
function openModal(matchCode, teamA, teamB) {
  state.selectedMatch = { matchCode, teamA, teamB };
  document.getElementById('modal-flag-a').textContent = getFlag(teamA);
  document.getElementById('modal-team-a').textContent = teamA;
  document.getElementById('modal-flag-b').textContent = getFlag(teamB);
  document.getElementById('modal-team-b').textContent = teamB;
  document.getElementById('modal-score-a').value = 0;
  document.getElementById('modal-score-b').value = 0;
  document.getElementById('modal-error').style.display = 'none';
  updateSummary();
  document.getElementById('prediction-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('prediction-modal').style.display = 'none';
  state.selectedMatch = null;
}

function updateSummary() {
  if (!state.selectedMatch) return;
  const a = parseInt(document.getElementById('modal-score-a').value);
  const b = parseInt(document.getElementById('modal-score-b').value);
  const el = document.getElementById('prediction-summary');
  const m = state.selectedMatch;
  if (a > b) el.textContent = `You predict ${m.teamA} wins ${a}-${b}`;
  else if (b > a) el.textContent = `You predict ${m.teamB} wins ${b}-${a}`;
  else el.textContent = `You predict a ${a}-${b} draw`;
}

async function submitPrediction() {
  if (!state.selectedMatch) return;
  const scoreA = parseInt(document.getElementById('modal-score-a').value);
  const scoreB = parseInt(document.getElementById('modal-score-b').value);
  const errorEl = document.getElementById('modal-error');
  const btn = document.getElementById('modal-submit');

  errorEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    await api('submitPrediction', {
      login: state.associate.login,
      matchCode: state.selectedMatch.matchCode,
      scoreA, scoreB,
      fingerprint: state.fingerprint
    });

    // Cache locally
    state.predictions[state.selectedMatch.matchCode] = {
      matchCode: state.selectedMatch.matchCode,
      teamA: state.selectedMatch.teamA,
      teamB: state.selectedMatch.teamB,
      scoreA, scoreB
    };

    closeModal();
    renderMatches();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Lock In Prediction';
  }
}

// ─── Event Listeners ───
function initEvents() {
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      if (tab.dataset.tab === 'my-predictions') loadMyPredictions();
      if (tab.dataset.tab === 'leaderboard') loadLeaderboard();
      if (tab.dataset.tab === 'winners') loadWinners();
    });
  });

  document.querySelectorAll('#tab-matches .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tab-matches .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentMatchFilter = btn.dataset.filter;
      renderMatches();
    });
  });

  document.querySelectorAll('#tab-leaderboard .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tab-leaderboard .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentShiftFilter = btn.dataset.shift;
      renderLeaderboard();
    });
  });

  document.querySelectorAll('.score-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      let val = parseInt(target.value);
      if (btn.classList.contains('plus') && val < 20) val++;
      if (btn.classList.contains('minus') && val > 0) val--;
      target.value = val;
      updateSummary();
    });
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-submit').addEventListener('click', submitPrediction);
  document.querySelector('.modal-overlay').addEventListener('click', closeModal);
}

// ─── Boot ───
async function boot() {
  initEvents();
  await getFingerprint();
  if (state.associate) {
    initMainApp();
  } else {
    showScreen('login-screen');
  }
}

boot();
