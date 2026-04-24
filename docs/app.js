/**
 * Station Challenge 2026 — Self-Registration Flow
 * Associates scan QR → enter their info → predict → data auto-populates QUIP
 */

// ─── State ───
let state = {
  user: JSON.parse(localStorage.getItem('sc_user') || 'null'),
  fingerprint: null,
  matches: [],
  predictions: {},
  leaderboard: [],
  matchFilter: 'upcoming',
  shiftFilter: 'all',
  selectedMatch: null
};

// ─── Device Fingerprint ───
async function getFingerprint() {
  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    state.fingerprint = result.visitorId;
  } catch {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fp2026', 2, 2);
    const raw = [navigator.userAgent, navigator.language, screen.width+'x'+screen.height,
      screen.colorDepth, new Date().getTimezoneOffset(), navigator.hardwareConcurrency,
      c.toDataURL()].join('|');
    let h = 0;
    for (let i = 0; i < raw.length; i++) { h = ((h << 5) - h) + raw.charCodeAt(i); h &= h; }
    state.fingerprint = 'fb_' + Math.abs(h).toString(36);
  }
}

// ─── API ───
async function api(action, data = {}) {
  if (!CONFIG.API_URL || CONFIG.API_URL.includes('YOUR_')) {
    throw new Error('Backend not configured yet. Admin needs to set up Google Apps Script.');
  }
  const payload = { action, fingerprint: state.fingerprint, ...data };
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload)
  });
  const result = await res.json();
  if (result.error) throw new Error(result.error);
  return result;
}

// ─── Flags ───
const FLAGS = {
  'USA':'🇺🇸','Mexico':'🇲🇽','Canada':'🇨🇦','Brazil':'🇧🇷','Argentina':'🇦🇷',
  'France':'🇫🇷','England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Germany':'🇩🇪','Spain':'🇪🇸','Portugal':'🇵🇹',
  'Netherlands':'🇳🇱','Belgium':'🇧🇪','Italy':'🇮🇹','Japan':'🇯🇵','South Korea':'🇰🇷',
  'Australia':'🇦🇺','Morocco':'🇲🇦','Senegal':'🇸🇳','Croatia':'🇭🇷','Uruguay':'🇺🇾',
  'Colombia':'🇨🇴','Switzerland':'🇨🇭','Denmark':'🇩🇰','Poland':'🇵🇱','Serbia':'🇷🇸'
};
function flag(t) { return FLAGS[t] || (t && t.startsWith('TBD') ? '🏳️' : '⚽'); }

// ─── Screens ───
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ─── Registration / Login ───
async function handleLogin(e) {
  e.preventDefault();
  const login = document.getElementById('login-input').value.trim().toLowerCase();
  const name = document.getElementById('name-input').value.trim();
  const shift = document.getElementById('shift-input').value;
  const err = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  if (!login || !name || !shift) {
    err.textContent = 'All fields are required.';
    err.style.display = 'block';
    return;
  }

  err.style.display = 'none';
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Signing in...';

  try {
    const result = await api('register', {
      login, fullName: name, shift, fingerprint: state.fingerprint
    });

    state.user = { login: result.login, fullName: result.fullName, shift: result.shift };
    localStorage.setItem('sc_user', JSON.stringify(state.user));
    initMain();
  } catch (error) {
    err.textContent = error.message;
    err.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = "Let's Go";
  }
}

function logout() {
  state.user = null;
  state.predictions = {};
  localStorage.removeItem('sc_user');
  show('login-screen');
}

// ─── Main App ───
function initMain() {
  show('main-screen');
  document.getElementById('user-name').textContent = state.user.fullName;
  const s = document.getElementById('user-shift');
  s.textContent = state.user.shift;
  s.className = 'shift-badge ' + state.user.shift;
  loadMatches();
}

// ─── Matches ───
async function loadMatches() {
  const el = document.getElementById('matches-list');
  el.innerHTML = '<div class="empty-state">Loading matches...</div>';
  try {
    const data = await api('getMatches');
    state.matches = data.matches || [];
    // Load my predictions
    try {
      const pd = await api('getMyPredictions', { login: state.user.login });
      state.predictions = {};
      (pd.predictions || []).forEach(p => { state.predictions[p.matchCode] = p; });
    } catch {}
    renderMatches();
  } catch (error) {
    el.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
}

function renderMatches() {
  const el = document.getElementById('matches-list');
  const f = state.matchFilter;
  const list = state.matches.filter(m => {
    if (f === 'upcoming') return m.status === 'open';
    if (f === 'locked') return m.status === 'locked';
    if (f === 'completed') return m.status === 'completed';
    return true;
  });

  if (!list.length) { el.innerHTML = '<div class="empty-state">No matches for this filter.</div>'; return; }

  el.innerHTML = list.map(m => {
    const p = state.predictions[m.matchCode];
    const d = new Date(m.matchDate);
    const ds = d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
    const ts = d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});

    let action = '';
    if (m.status === 'completed') {
      action = `<span class="match-score">${m.resultA} - ${m.resultB}</span>`;
    } else if (m.status === 'locked') {
      action = p ? `<span class="prediction-badge locked">Locked: ${p.scoreA}-${p.scoreB}</span>`
                  : `<span class="prediction-badge locked">Closed</span>`;
    } else if (p) {
      action = `<span class="prediction-badge submitted">✓ ${p.scoreA}-${p.scoreB}</span>`;
    } else {
      action = `<button class="btn-predict" onclick="openModal('${m.matchCode}','${m.teamA}','${m.teamB}')">Predict</button>`;
    }

    return `<div class="match-card">
      <div class="match-card-header">
        <span class="match-group">${m.group || m.matchCode}</span>
        <span class="match-date">${ds} · ${ts}</span>
      </div>
      <div class="match-teams">
        <div class="match-team"><span>${flag(m.teamA)}</span><span class="match-team-name">${m.teamA}</span></div>
        <span class="match-vs">VS</span>
        <div class="match-team"><span>${flag(m.teamB)}</span><span class="match-team-name">${m.teamB}</span></div>
      </div>
      <div class="match-card-footer">
        <span class="match-venue">📍 ${m.venue || 'TBD'}</span>
        ${action}
      </div>
    </div>`;
  }).join('');
}

// ─── My Predictions ───
async function loadMyPredictions() {
  const el = document.getElementById('my-predictions-list');
  el.innerHTML = '<div class="empty-state">Loading...</div>';
  try {
    const data = await api('getMyPredictions', { login: state.user.login });
    const preds = data.predictions || [];
    if (!preds.length) { el.innerHTML = '<div class="empty-state">No predictions yet. Go to Matches!</div>'; return; }

    el.innerHTML = preds.map(p => {
      let badge;
      if (p.points !== '' && p.points !== undefined) {
        const pts = parseInt(p.points);
        const cls = pts===5?'pts-5':pts===2?'pts-2':'pts-0';
        const lbl = pts===5?'🎯 Exact!':pts===2?'✓ Winner':'✗ Wrong';
        badge = `<span class="points-badge ${cls}">${lbl} (+${pts})</span>`;
      } else {
        badge = `<span class="points-badge pending">⏳ Pending</span>`;
      }
      return `<div class="prediction-card">
        <div class="match-info">
          <span class="match-group">${p.group||p.matchCode}</span>
          <span class="match-date">${new Date(p.matchDate).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
        </div>
        <div class="your-pick">${flag(p.teamA)} ${p.teamA} ${p.scoreA} - ${p.scoreB} ${p.teamB} ${flag(p.teamB)}</div>
        ${p.resultA!==''&&p.resultA!==undefined?`<div class="actual-result">Actual: ${p.resultA} - ${p.resultB}</div>`:''}
        <div style="text-align:center">${badge}</div>
      </div>`;
    }).join('');
  } catch (error) {
    el.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
}

// ─── Leaderboard ───
async function loadLeaderboard() {
  const el = document.getElementById('leaderboard-table');
  el.innerHTML = '<div class="empty-state">Loading...</div>';
  try {
    const data = await api('getLeaderboard');
    state.leaderboard = data.leaderboard || [];
    renderLeaderboard();
  } catch (error) {
    el.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
}

function renderLeaderboard() {
  const el = document.getElementById('leaderboard-table');
  let list = state.leaderboard;
  if (state.shiftFilter !== 'all') list = list.filter(r => r.shift === state.shiftFilter);
  if (!list.length) { el.innerHTML = '<div class="empty-state">No scores yet.</div>'; return; }

  const me = state.user?.login?.toLowerCase();
  el.innerHTML = `<table class="leaderboard-table">
    <thead><tr><th>#</th><th>Associate</th><th>Shift</th><th>Pts</th><th>🎯</th><th>✓</th></tr></thead>
    <tbody>${list.map((r,i) => {
      const rank = i+1;
      const isMe = r.login?.toLowerCase() === me;
      const medal = rank<=3?['🥇','🥈','🥉'][rank-1]:rank;
      const rc = rank<=3?`rank-${rank}`:'';
      return `<tr class="${isMe?'highlight-row':''}">
        <td class="rank-cell ${rc}">${medal}</td>
        <td class="name-cell">${r.fullName}${isMe?' (You)':''}</td>
        <td><span class="shift-badge ${r.shift}">${r.shift}</span></td>
        <td class="points-cell">${r.totalPoints}</td>
        <td>${r.exactScores||0}</td>
        <td>${r.correctWinners||0}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

// ─── Winners ───
async function loadWinners() {
  const el = document.getElementById('winners-display');
  el.innerHTML = '<div class="empty-state">Loading...</div>';
  try {
    const data = await api('getLeaderboard');
    const all = data.leaderboard || [];
    const shifts = [
      {key:'night',label:'Night Shift',icon:'🌙',count:CONFIG.WINNERS.night},
      {key:'early',label:'Early Shift',icon:'🌅',count:CONFIG.WINNERS.early},
      {key:'late',label:'Late Shift',icon:'🌇',count:CONFIG.WINNERS.late}
    ];
    el.innerHTML = shifts.map(s => {
      const winners = all.filter(r=>r.shift===s.key).slice(0,s.count);
      const rows = winners.length
        ? winners.map((w,i)=>`<div class="winner-row">
            <span class="winner-rank">${i+1}</span>
            <div class="winner-info"><div class="winner-name">${w.fullName}</div><div class="winner-login">${w.login}</div></div>
            <span class="winner-points">${w.totalPoints} pts</span>
          </div>`).join('')
        : '<div class="empty-state" style="padding:16px">No scores yet</div>';
      return `<div class="winners-section">
        <h3>${s.icon} ${s.label}</h3>
        <div class="winner-count">Top ${s.count} winners</div>
        ${rows}
      </div>`;
    }).join('');
  } catch (error) {
    el.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
}

// ─── Modal ───
function openModal(code, teamA, teamB) {
  state.selectedMatch = {code, teamA, teamB};
  document.getElementById('modal-flag-a').textContent = flag(teamA);
  document.getElementById('modal-team-a').textContent = teamA;
  document.getElementById('modal-flag-b').textContent = flag(teamB);
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
  const a = +document.getElementById('modal-score-a').value;
  const b = +document.getElementById('modal-score-b').value;
  const m = state.selectedMatch;
  const el = document.getElementById('prediction-summary');
  el.textContent = a>b ? `${m.teamA} wins ${a}-${b}` : b>a ? `${m.teamB} wins ${b}-${a}` : `Draw ${a}-${b}`;
}

async function submitPrediction() {
  if (!state.selectedMatch) return;
  const scoreA = +document.getElementById('modal-score-a').value;
  const scoreB = +document.getElementById('modal-score-b').value;
  const err = document.getElementById('modal-error');
  const btn = document.getElementById('modal-submit');
  err.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    await api('submitPrediction', {
      login: state.user.login,
      fullName: state.user.fullName,
      shift: state.user.shift,
      matchCode: state.selectedMatch.code,
      scoreA, scoreB
    });
    state.predictions[state.selectedMatch.code] = {
      matchCode: state.selectedMatch.code,
      teamA: state.selectedMatch.teamA,
      teamB: state.selectedMatch.teamB,
      scoreA, scoreB
    };
    closeModal();
    renderMatches();
  } catch (error) {
    err.textContent = error.message;
    err.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Lock In Prediction';
  }
}

// ─── Events ───
function initEvents() {
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('logout-btn').addEventListener('click', logout);

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-'+tab.dataset.tab).classList.add('active');
      if (tab.dataset.tab==='my-predictions') loadMyPredictions();
      if (tab.dataset.tab==='leaderboard') loadLeaderboard();
      if (tab.dataset.tab==='winners') loadWinners();
    });
  });

  document.querySelectorAll('#tab-matches .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tab-matches .filter-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      state.matchFilter = btn.dataset.filter;
      renderMatches();
    });
  });

  document.querySelectorAll('#tab-leaderboard .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tab-leaderboard .filter-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      state.shiftFilter = btn.dataset.shift;
      renderLeaderboard();
    });
  });

  document.querySelectorAll('.score-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = document.getElementById(btn.dataset.target);
      let v = +t.value;
      if (btn.classList.contains('plus') && v<20) v++;
      if (btn.classList.contains('minus') && v>0) v--;
      t.value = v;
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
  if (state.user) { initMain(); } else { show('login-screen'); }
}
boot();
