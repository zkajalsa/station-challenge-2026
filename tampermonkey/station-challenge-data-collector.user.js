// ==UserScript==
// @name         Station Challenge 2026 — Associate Data Collector
// @namespace    https://station-challenge-2026.local
// @version      1.0.0
// @description  Collects associate login, shift, and badge data from Amazon internal tools to auto-populate the Station Challenge prediction app.
// @author       Station Challenge Admin
// @match        https://fclm-portal.amazon.com/*
// @match        https://fc-roster.amazon.com/*
// @match        https://aftlite-portal.amazon.com/*
// @match        https://aftlite-na.amazon.com/*
// @match        https://picking.aft.amazon.com/*
// @match        https://trans-logistics.amazon.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @connect      localhost
// @connect      *
// ==/UserScript==

(function () {
  'use strict';

  // ─── Configuration ───
  // Change this to your actual Station Challenge server URL
  const CHALLENGE_SERVER = 'http://localhost:3000';

  // ─── Extract Associate Data from Page ───
  function extractAssociateData() {
    const data = {
      login: null,
      badgeId: null,
      fullName: null,
      shift: null,
      source: window.location.hostname
    };

    // Method 1: FCLM Portal — look for logged-in user info
    const userElement = document.querySelector('[data-username], .user-name, #user-login, .nav-user');
    if (userElement) {
      data.login = userElement.textContent.trim() || userElement.getAttribute('data-username');
    }

    // Method 2: Check page title or header for login
    const headerLogin = document.querySelector('.login-display, .associate-login, #associate-id');
    if (headerLogin) {
      data.login = headerLogin.textContent.trim();
    }

    // Method 3: Look for badge/shift info in roster pages
    const badgeElement = document.querySelector('[data-badge], .badge-id, #badge-number');
    if (badgeElement) {
      data.badgeId = badgeElement.textContent.trim() || badgeElement.getAttribute('data-badge');
    }

    // Method 4: Extract from URL parameters (some tools pass login in URL)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('login')) data.login = urlParams.get('login');
    if (urlParams.has('associateLogin')) data.login = urlParams.get('associateLogin');

    // Method 5: Look for shift information
    const shiftElement = document.querySelector('.shift-info, [data-shift], .schedule-shift');
    if (shiftElement) {
      const shiftText = (shiftElement.textContent || shiftElement.getAttribute('data-shift')).toLowerCase();
      if (shiftText.includes('night') || shiftText.includes('bhn') || shiftText.includes('fhn')) {
        data.shift = 'night';
      } else if (shiftText.includes('day') || shiftText.includes('bhd') || shiftText.includes('fhd') || shiftText.includes('early')) {
        data.shift = 'early';
      } else if (shiftText.includes('twi') || shiftText.includes('late') || shiftText.includes('eve')) {
        data.shift = 'late';
      }
    }

    // Method 6: Try to get name
    const nameElement = document.querySelector('.associate-name, .user-full-name, [data-fullname]');
    if (nameElement) {
      data.fullName = nameElement.textContent.trim() || nameElement.getAttribute('data-fullname');
    }

    return data;
  }

  // ─── Roster Scraper (for admin bulk import) ───
  function scrapeRosterTable() {
    const associates = [];
    const tables = document.querySelectorAll('table');

    for (const table of tables) {
      const rows = table.querySelectorAll('tbody tr');
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 3) continue;

        // Try to identify columns by header
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.toLowerCase().trim());

        const loginIdx = headers.findIndex(h => h.includes('login') || h.includes('alias'));
        const nameIdx = headers.findIndex(h => h.includes('name'));
        const badgeIdx = headers.findIndex(h => h.includes('badge'));
        const shiftIdx = headers.findIndex(h => h.includes('shift') || h.includes('schedule'));

        if (loginIdx >= 0 && cells[loginIdx]) {
          const login = cells[loginIdx].textContent.trim();
          const fullName = nameIdx >= 0 ? cells[nameIdx].textContent.trim() : login;
          const badgeId = badgeIdx >= 0 ? cells[badgeIdx].textContent.trim() : null;

          let shift = 'early'; // default
          if (shiftIdx >= 0) {
            const shiftText = cells[shiftIdx].textContent.toLowerCase();
            if (shiftText.includes('night') || shiftText.includes('bhn') || shiftText.includes('fhn')) shift = 'night';
            else if (shiftText.includes('twi') || shiftText.includes('late') || shiftText.includes('eve')) shift = 'late';
          }

          associates.push({ login, fullName, badgeId, shift });
        }
      }
    }

    return associates;
  }

  // ─── Send Data to Challenge Server ───
  function sendToServer(endpoint, data) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: `${CHALLENGE_SERVER}/api${endpoint}`,
        headers: {
          'Content-Type': 'application/json'
        },
        data: JSON.stringify(data),
        onload: function (response) {
          try {
            resolve(JSON.parse(response.responseText));
          } catch {
            resolve(response.responseText);
          }
        },
        onerror: function (err) {
          reject(err);
        }
      });
    });
  }

  // ─── UI: Floating Button ───
  function createUI() {
    const container = document.createElement('div');
    container.id = 'station-challenge-widget';
    container.innerHTML = `
      <style>
        #station-challenge-widget {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 99999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        #sc-fab {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #e94560;
          color: white;
          border: none;
          font-size: 24px;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(233,69,96,0.4);
          transition: transform 0.2s;
        }
        #sc-fab:hover { transform: scale(1.1); }
        #sc-panel {
          display: none;
          position: absolute;
          bottom: 70px;
          right: 0;
          width: 320px;
          background: #1a1a2e;
          border: 1px solid #2a2a45;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          color: #e8e8f0;
        }
        #sc-panel h3 { margin: 0 0 12px; font-size: 16px; }
        #sc-panel p { font-size: 13px; color: #8888a0; margin: 4px 0; }
        #sc-panel .sc-data { font-size: 13px; color: #74c69d; font-weight: 600; }
        #sc-panel button {
          width: 100%;
          padding: 10px;
          margin-top: 12px;
          background: #e94560;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        #sc-panel button:hover { background: #c73e54; }
        #sc-panel button.secondary {
          background: #2a2a45;
          margin-top: 8px;
        }
        #sc-panel button.secondary:hover { background: #3a3a55; }
        #sc-status { font-size: 12px; margin-top: 8px; text-align: center; }
      </style>
      <div id="sc-panel">
        <h3>⚽ Station Challenge</h3>
        <p>Detected associate data:</p>
        <div id="sc-detected-data"></div>
        <button id="sc-open-app">Open Prediction App</button>
        <button id="sc-scrape-roster" class="secondary">📋 Scrape Roster (Admin)</button>
        <div id="sc-status"></div>
      </div>
      <button id="sc-fab" title="Station Challenge 2026">⚽</button>
    `;

    document.body.appendChild(container);

    // Toggle panel
    document.getElementById('sc-fab').addEventListener('click', () => {
      const panel = document.getElementById('sc-panel');
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      if (panel.style.display === 'block') refreshDetectedData();
    });

    // Open app
    document.getElementById('sc-open-app').addEventListener('click', () => {
      const data = extractAssociateData();
      let url = CHALLENGE_SERVER;
      if (data.login) {
        url += `?login=${encodeURIComponent(data.login)}`;
        if (data.badgeId) url += `&badge=${encodeURIComponent(data.badgeId)}`;
      }
      window.open(url, '_blank');
    });

    // Scrape roster
    document.getElementById('sc-scrape-roster').addEventListener('click', async () => {
      const status = document.getElementById('sc-status');
      const associates = scrapeRosterTable();

      if (associates.length === 0) {
        status.innerHTML = '<span style="color:#e74c3c;">No roster data found on this page.</span>';
        return;
      }

      status.innerHTML = `Found ${associates.length} associates. Sending...`;

      try {
        // You'll need to set the admin token
        const adminToken = GM_getValue('sc_admin_token', '');
        if (!adminToken) {
          const token = prompt('Enter admin PIN for Station Challenge:');
          if (token) GM_setValue('sc_admin_token', token);
          else return;
        }

        const result = await sendToServer('/admin/associates', {
          associates
        });

        status.innerHTML = `<span style="color:#74c69d;">✅ Imported ${result.added || 0} associates!</span>`;
      } catch (err) {
        status.innerHTML = `<span style="color:#e74c3c;">❌ Import failed. Check server connection.</span>`;
      }
    });
  }

  function refreshDetectedData() {
    const data = extractAssociateData();
    const container = document.getElementById('sc-detected-data');
    container.innerHTML = `
      <p>Login: <span class="sc-data">${data.login || 'Not detected'}</span></p>
      <p>Badge: <span class="sc-data">${data.badgeId || 'Not detected'}</span></p>
      <p>Name: <span class="sc-data">${data.fullName || 'Not detected'}</span></p>
      <p>Shift: <span class="sc-data">${data.shift || 'Not detected'}</span></p>
      <p style="font-size:11px;color:#666;">Source: ${data.source}</p>
    `;
  }

  // ─── Auto-store detected login for quick access ───
  function autoDetect() {
    const data = extractAssociateData();
    if (data.login) {
      GM_setValue('sc_last_login', data.login);
      GM_setValue('sc_last_badge', data.badgeId || '');
      GM_setValue('sc_last_name', data.fullName || '');
      GM_setValue('sc_last_shift', data.shift || '');
    }
  }

  // ─── Initialize ───
  // Wait for page to fully load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      createUI();
      autoDetect();
    });
  } else {
    createUI();
    autoDetect();
  }
})();
