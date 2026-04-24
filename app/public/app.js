/**
 * Station Challenge 2026 — Frontend Application
 * Mobile-first prediction app with anti-fraud device fingerprinting
 */

const API = window.location.origin + '/api';

// ─── State ───
let state = {
  token: localStorage.getItem('sc_token'),
  associate: JSON.parse(localStorage.getItem('sc_associate') || 'null'),
  fingerprint: null,
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
  } catch (err) {
    // Fallback: generate a pseudo-fingerprint from browser properties
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);
    const canvasData = canvas.toDataURL();

    const raw = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency,
      canvasData
    ].join('|');

    // Simple hash
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    state.fingerprint = 'fb_' + Math.abs(hash).toString(36);
  }
}

// ─── API Helpers ───
async function apiCall(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (state.token) {
    headers['X-Session-Token'] = state.token;
  }
  if (state.fingerprint) {
    headers['X-Device-Fingerprint'] = state.fingerprint;
  }

  const response = await fetch(API + endpoint, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data;
}

// ─── Country Flag Emoji Helper ───
const countryFlags = {
  'USA': '🇺🇸', 'Mexico': '🇲🇽', 'Canada': '🇨🇦', 'Brazil': '🇧🇷',
  'Argentina': '🇦🇷', 'France': '🇫🇷', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Germany': '🇩🇪',
  'Spain': '🇪🇸', 'Portugal': '🇵🇹', 'Netherlands': '🇳🇱', 'Belgium': '🇧🇪',
  'Italy': '🇮🇹', 'Japan': '🇯🇵', 'South Korea': '🇰🇷', 'Australia': '🇦🇺',
  'Saudi Arabia': '🇸🇦', 'Qatar': '🇶🇦', 'Morocco': '🇲🇦', 'Senegal': '🇸🇳',
  'Ghana': '🇬🇭', 'Cameroon': '🇨🇲', 'Nigeria': '🇳🇬', 'Uruguay': '🇺🇾',
  'Colombia': '🇨🇴', 'Ecuador': '🇪🇨', 'Chile': '🇨🇱', 'Peru': '🇵🇪',
  'Croatia': '🇭🇷', 'Serbia': '🇷🇸', 'Switzerland': '🇨🇭', 'Denmark': '🇩🇰',
  'Poland': '🇵🇱', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Iran': '🇮🇷', 'Tunisia': '🇹🇳',
  'Costa Rica': '🇨🇷', 'Panama': '🇵🇦', 'Honduras': '🇭🇳', 'Jamaica': '🇯🇲',
  'TBD': '🏳️', 'draw': '🤝'
};

function getFlag(team) {
  if (!team) return '🏳️';
  return countryFlags[team] || (team.startsWith('TBD') ? '🏳️' : '⚽');
}

// ─── Screen Management ───
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// ─── Login ───
async function handleLogin(e) {
  e.preventDefault();
  const loginInput = document.getElementById('login-input');
  const badgeInput = document.getElementById('badge-input');
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  errorEl.style.display = 'none';
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Signing in...';

  try {
    const data = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        login: loginInput.value.trim(),
        badgeId: badgeInput.value.trim() || undefined,
        deviceFingerprint: state.fingerprint
      })
    });

    state.token = data.token;
    state.associate = data.associate;
    localStorage.setItem('sc_token', data.token);
    localStorage.setItem('sc_associate', JSON.stringify(data.associate));

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
  apiCall('/auth/logout', { method: 'POST' }).catch(() => {});
  state.token = null;
  state.associate = null;
  localStorage.removeItem('sc_token');
  localStorage.removeItem('sc_associate');
  showScreen('login-screen');
}

// ─── Check Session ───
async function checkSession() {
  if (!state.token) return false;
  try {
    const data = await apiCall('/auth/me');
    state.associate = data.associate;
    localStorage.setItem('sc_associate', JSON.stringify(data.associate));
    return true;
  } catch {
    state.token = null;
    state.associate = null;
    localStorage.removeItem('sc_token');
    localStorage.removeItem('sc_associate');
    return false;
  }
}

// ─── Main App Init ───
function initMainApp() {
  showScreen('main-screen');

  // Set user info in header
  document.getElementById('user-name').textContent = state.associate.fullName || state.associate.login;
  const shiftEl = document.getElementById('user-shift');
  shiftEl.textContent = state.associate.shift;
  shiftEl.className = 'shift-badge ' + state.associate.shift;

  // Load initial data
  loadMatches();
  loadLeaderboard();
  loadWinners();
}

// ─── Matches ───
async function loadMatches() {
  const container = document.getElementById('matches-list');
  container.innerHTML = '<div class="empty-state">Loading matches...</div>';

  try {
    const data = await apiCall(`/matches?status=${state.currentMatchFilter}`);
    if (data.matches.length === 0) {
      container.innerHTML = '<div class="empty-state">No matches found for this filter.</div>';
      return;
    }

    // Get user's predictions for these matches
    let myPredictions = {};
    if (state.token) {
      try {
        const predData = await apiCall('/predictions/my');
        predData.predictions.forEach(p => {
          myPredictions[p.match_id] = p;
        });
      } catch {}
    }

    container.innerHTML = data.matches.map(match => {
      const pred = myPredictions[match.id];
      const matchDate = new Date(match.match_date);
      const dateStr = matchDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const timeStr = matchDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      let actionHtml = '';
      if (match.is_completed) {
        actionHtml = `<span class="match-score">${match.actual_result_a} - ${match.actual_result_b}</span>`;
      } else if (match.is_locked) {
        actionHtml = pred
          ? `<span class="prediction-badge locked">Locked: ${pred.predicted_score_a}-${pred.predicted_score_b}</span>`
          : `<span class="prediction-badge locked">Predictions Closed</span>`;
      } else if (pred) {
        actionHtml = `<span class="prediction-badge submitted">✓ ${pred.predicted_score_a}-${pred.predicted_score_b}</span>`;
      } else {
        actionHtml = `<button class="btn-predict" onclick="openPredictionModal(${match.id}, '${match.team_a}', '${match.team_b}')">Predict</button>`;
      }

      return `
        <div class="match-card">
          <div class="match-card-header">
            <span class="match-group">${match.group_stage || match.match_code}</span>
            <span class="match-date">${dateStr} · ${timeStr}</span>
          </div>
          <div class="match-teams">
            <div class="match-team">
              <span>${getFlag(match.team_a)}</span>
              <span class="match-team-name">${match.team_a}</span>
            </div>
            <span class="match-vs">VS</span>
            <div class="match-team">
              <span>${getFlag(match.team_b)}</span>
              <span class="match-team-name">${match.team_b}</span>
            </div>
          </div>
          <div class="match-card-footer">
            <span class="match-venue">📍 ${match.venue || 'TBD'}</span>
            ${actionHtml}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Failed to load matches: ${err.message}</div>`;
  }
}

// ─── My Predictions ───
async function loadMyPredictions() {
  const container = document.getElementById('my-predictions-list');
  container.innerHTML = '<div class="empty-state">Loading your predictions...</div>';

  try {
    const data = await apiCall('/predictions/my');
    if (data.predictions.length === 0) {
      container.innerHTML = '<div class="empty-state">You haven\'t made any predictions yet. Head to the Matches tab to get started!</div>';
      return;
    }

    container.innerHTML = data.predictions.map(pred => {
      let pointsHtml = '';
      if (pred.is_completed) {
        const cls = pred.points_earned === 5 ? 'pts-5' : pred.points_earned === 2 ? 'pts-2' : 'pts-0';
        const label = pred.points_earned === 5 ? '🎯 Exact Score!' : pred.points_earned === 2 ? '✓ Correct Winner' : '✗ Wrong';
        pointsHtml = `<span class="points-badge ${cls}">${label} (+${pred.points_earned} pts)</span>`;
      } else {
        pointsHtml = `<span class="points-badge pending">⏳ Pending</span>`;
      }

      return `
        <div class="prediction-card">
          <div class="match-info">
            <span class="match-group">${pred.group_stage || pred.match_code}</span>
            <span class="match-date">${new Date(pred.match_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>
          <div class="your-pick">
            ${getFlag(pred.team_a)} ${pred.team_a} ${pred.predicted_score_a} - ${pred.predicted_score_b} ${pred.team_b} ${getFlag(pred.team_b)}
          </div>
          ${pred.is_completed ? `<div class="actual-result">Actual: ${pred.actual_result_a} - ${pred.actual_result_b}</div>` : ''}
          <div style="text-align:center;">${pointsHtml}</div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Failed to load predictions: ${err.message}</div>`;
  }
}

// ─── Leaderboard ───
async function loadLeaderboard() {
  const container = document.getElementById('leaderboard-table');
  container.innerHTML = '<div class="empty-state">Loading leaderboard...</div>';

  try {
    const shiftParam = state.currentShiftFilter !== 'all' ? `?shift=${state.currentShiftFilter}` : '';
    const data = await apiCall(`/leaderboard${shiftParam}`);

    if (data.leaderboard.length === 0) {
      container.innerHTML = '<div class="empty-state">No scores yet. Predictions will be scored after matches complete.</div>';
      return;
    }

    const myLogin = state.associate?.login?.toLowerCase();

    container.innerHTML = `
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Associate</th>
            <th>Shift</th>
            <th>Pts</th>
            <th>🎯</th>
            <th>✓</th>
          </tr>
        </thead>
        <tbody>
          ${data.leaderboard.map(row => {
            const isMe = row.login?.toLowerCase() === myLogin;
            const rankClass = row.rank <= 3 ? `rank-${row.rank}` : '';
            return `
              <tr class="${isMe ? 'highlight-row' : ''}">
                <td class="rank-cell ${rankClass}">${row.rank <= 3 ? ['🥇','🥈','🥉'][row.rank-1] : row.rank}</td>
                <td class="name-cell">${row.full_name}${isMe ? ' (You)' : ''}</td>
                <td><span class="shift-badge ${row.shift}">${row.shift}</span></td>
                <td class="points-cell">${row.total_points}</td>
                <td>${row.exact_scores}</td>
                <td>${row.correct_winners}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Failed to load leaderboard: ${err.message}</div>`;
  }
}

// ─── Winners ───
async function loadWinners() {
  const container = document.getElementById('winners-display');
  container.innerHTML = '<div class="empty-state">Loading winners...</div>';

  try {
    const data = await apiCall('/leaderboard/winners');

    const shiftConfig = [
      { key: 'night', label: 'Night Shift', icon: '🌙', count: 5 },
      { key: 'early', label: 'Early Shift', icon: '🌅', count: 3 },
      { key: 'late', label: 'Late Shift', icon: '🌇', count: 2 }
    ];

    container.innerHTML = shiftConfig.map(shift => {
      const winners = data.winners[shift.key] || [];
      const rows = winners.length > 0
        ? winners.map((w, i) => `
            <div class="winner-row">
              <span class="winner-rank">${i + 1}</span>
              <div class="winner-info">
                <div class="winner-name">${w.full_name}</div>
                <div class="winner-login">${w.login}</div>
              </div>
              <span class="winner-points">${w.total_points} pts</span>
            </div>
          `).join('')
        : '<div class="empty-state" style="padding:16px;">No scores yet</div>';

      return `
        <div class="winners-section">
          <h3>${shift.icon} ${shift.label}</h3>
          <div class="winner-count">Top ${shift.count} winners</div>
          ${rows}
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Failed to load winners: ${err.message}</div>`;
  }
}

// ─── Prediction Modal ───
function openPredictionModal(matchId, teamA, teamB) {
  state.selectedMatch = { id: matchId, teamA, teamB };

  document.getElementById('modal-flag-a').textContent = getFlag(teamA);
  document.getElementById('modal-team-a').textContent = teamA;
  document.getElementById('modal-flag-b').textContent = getFlag(teamB);
  document.getElementById('modal-team-b').textContent = teamB;
  document.getElementById('modal-score-a').value = 0;
  document.getElementById('modal-score-b').value = 0;
  document.getElementById('modal-error').style.display = 'none';
  updatePredictionSummary();

  document.getElementById('prediction-modal').style.display = 'flex';
}

function closePredictionModal() {
  document.getElementById('prediction-modal').style.display = 'none';
  state.selectedMatch = null;
}

function updatePredictionSummary() {
  if (!state.selectedMatch) return;
  const a = parseInt(document.getElementById('modal-score-a').value);
  const b = parseInt(document.getElementById('modal-score-b').value);
  const summary = document.getElementById('prediction-summary');

  if (a > b) {
    summary.textContent = `You predict ${state.selectedMatch.teamA} wins ${a}-${b}`;
  } else if (b > a) {
    summary.textContent = `You predict ${state.selectedMatch.teamB} wins ${b}-${a}`;
  } else {
    summary.textContent = `You predict a ${a}-${b} draw`;
  }
}

async function submitPrediction() {
  if (!state.selectedMatch) return;

  const scoreA = parseInt(document.getElementById('modal-score-a').value);
  const scoreB = parseInt(document.getElementById('modal-score-b').value);
  const errorEl = document.getElementById('modal-error');
  const submitBtn = document.getElementById('modal-submit');

  errorEl.style.display = 'none';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    await apiCall('/predictions', {
      method: 'POST',
      body: JSON.stringify({
        matchId: state.selectedMatch.id,
        scoreA,
        scoreB
      })
    });

    closePredictionModal();
    loadMatches(); // Refresh to show submitted badge
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Lock In Prediction';
  }
}

// ─── Event Listeners ───
function initEventListeners() {
  // Login form
  document.getElementById('login-form').addEventListener('submit', handleLogin);

  // Logout
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  // Tab navigation
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');

      // Load data for the tab
      if (tab.dataset.tab === 'my-predictions') loadMyPredictions();
      if (tab.dataset.tab === 'leaderboard') loadLeaderboard();
      if (tab.dataset.tab === 'winners') loadWinners();
    });
  });

  // Match filter buttons
  document.querySelectorAll('#tab-matches .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tab-matches .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentMatchFilter = btn.dataset.filter;
      loadMatches();
    });
  });

  // Leaderboard shift filter
  document.querySelectorAll('#tab-leaderboard .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tab-leaderboard .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentShiftFilter = btn.dataset.shift;
      loadLeaderboard();
    });
  });

  // Score buttons in modal
  document.querySelectorAll('.score-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      let val = parseInt(target.value);
      if (btn.classList.contains('plus') && val < 20) val++;
      if (btn.classList.contains('minus') && val > 0) val--;
      target.value = val;
      updatePredictionSummary();
    });
  });

  // Modal controls
  document.getElementById('modal-close').addEventListener('click', closePredictionModal);
  document.getElementById('modal-cancel').addEventListener('click', closePredictionModal);
  document.getElementById('modal-submit').addEventListener('click', submitPrediction);
  document.querySelector('.modal-overlay').addEventListener('click', closePredictionModal);
}

// ─── App Boot ───
async function boot() {
  initEventListeners();
  await getFingerprint();

  const isLoggedIn = await checkSession();
  if (isLoggedIn) {
    initMainApp();
  } else {
    showScreen('login-screen');
  }
}

// Start
boot();
