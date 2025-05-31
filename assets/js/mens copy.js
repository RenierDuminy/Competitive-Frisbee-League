// assets/js/mens-copy.js

// ──────────────────────────────────────────
// 1. Constants & Global State
// ──────────────────────────────────────────
const STORAGE_KEY = 'MatchLogging';
const API_URL     = 'https://script.google.com/macros/s/AKfycb...sYgAcWhD7zel5hwoydkkGY1LLYno6dpevg_P_bqjD7cv2cwhCTR1yhTe5/exec';

let sessionData   = null;    // { GameID, Date, logs: [...] }
let teamAScore = 0;
let teamBScore = 0;
let teamsData     = [];      // fetched from API
let currentEditID = null;
let countdownInterval;
let loadingInterval;
let isRunning     = false;
let endTime       = 0;       // millisecond timestamp
const MAX_OVERTIME = 20 * 60 * 1000; // 20 minutes in milliseconds

// ──────────────────────────────────────────
// 2. Fetch teams & build UI
// ──────────────────────────────────────────
async function fetchTeams() {
  try {
    const res = await fetch(API_URL);
    teamsData = await response.json();
    buildTeamSelectors();
    buildTeamLists();
  } catch (err) {
    console.error('fetchTeams error:', err);
    alert('Error loading team data.');
  }
}

// ──────────────────────────────────────────
// 3. Team selectors & lists
// ──────────────────────────────────────────
function buildTeamSelectors() {
  const selA = document.getElementById('teamA');
  const selB = document.getElementById('teamB');
  selA.innerHTML = '<option value="">Select Team A</option>';
  selB.innerHTML = '<option value="">Select Team B</option>';

  teamsData.forEach(team => {
    const o1 = document.createElement('option');
    o1.value       = team.name;
    o1.textContent = team.name;
    selA.appendChild(o1);
    selB.appendChild(o1.cloneNode(true));
  });

  selA.onchange = () => {
    buildTeamLists();
    refreshSessionGameID();
  };
  selB.onchange = () => {
    buildTeamLists();
    refreshSessionGameID();
  };
}

function buildTeamLists() {
  const ta = document.getElementById('teamAList');
  const tb = document.getElementById('teamBList');
  ta.value = '';
  tb.value = '';

  const aName = document.getElementById('teamA').value;
  const bName = document.getElementById('teamB').value;

  teamsData.forEach(team => {
    if (team.name === aName) ta.value = team.players.join('\n');
    if (team.name === bName) tb.value = team.players.join('\n');
  });
}

// ──────────────────────────────────────────
// 4. Session GameID handling
// ──────────────────────────────────────────
function refreshSessionGameID() {
  if (!sessionData) return;
  const a = document.getElementById('teamA').value;
  const b = document.getElementById('teamB').value;
  if (a && b) sessionData.GameID = `${a} vs ${b}`;
  saveSession();
}

// ──────────────────────────────────────────
// 5. Load or init fresh session
// ──────────────────────────────────────────
function loadSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    sessionData = JSON.parse(raw);

    // restore team selectors
    if (sessionData.GameID) {
      const [aName, bName] = sessionData.GameID.split(' vs ');
      document.getElementById('teamA').value = aName || '';
      document.getElementById('teamB').value = bName || '';
      buildTeamLists();
    }

    // restore session‐time into the "Time" input
    document.getElementById('time').value = sessionData.Date;

    // rebuild any saved score rows
    sessionData.logs.forEach(log => {
      const [teamAName] = sessionData.GameID.split(' vs ');
      const letter = log.Team === teamAName ? 'A' : 'B';
      appendScoreRow(log.scoreID, letter, log.Scorer, log.Assist);
    });
  } else {
    initFreshSession();
  }
}

function initFreshSession() {
  const now = new Date().toLocaleTimeString();
  sessionData = { GameID: '', Date: now, logs: [] };
  document.getElementById('time').value = now;
  saveSession();
}

function saveSession() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
}

// ──────────────────────────────────────────
// 6. Popup open/close
// ──────────────────────────────────────────
function openPopup(teamLetter) {
  currentEditID = null;
  const overlay = document.getElementById('overlay');
  const popup   = document.getElementById('scorePopup');
  overlay.style.display    = 'block';
  popup.style.display      = 'block';
  popup.dataset.team       = teamLetter;
  document.getElementById('popupTitle').textContent  = 'Add Score';
  document.getElementById('popupButton').value       = 'Add Score';
  buildPlayerDropdowns(teamLetter);
}

function closePopup() {
  document.getElementById('overlay').style.display    = 'none';
  document.getElementById('scorePopup').style.display = 'none';
}

// ──────────────────────────────────────────
// 7. Build scorer/assist dropdowns
// ──────────────────────────────────────────
function buildPlayerDropdowns(teamLetter) {
  const ddSc = document.getElementById('scorer');
  const ddAs = document.getElementById('assist');
  ddSc.innerHTML = '<option value="">Select Scorer</option>';
  ddAs.innerHTML = '<option value="">Select Assist</option>';

  const teamName = teamLetter === 'A'
    ? document.getElementById('teamA').value
    : document.getElementById('teamB').value;

  const players = teamsData.find(t => t.name === teamName)?.players || [];
  players.forEach(p => {
    const o1 = document.createElement('option');
    o1.value       = p;
    o1.textContent = p;
    ddSc.appendChild(o1);
    ddAs.appendChild(o1.cloneNode(true));
  });

  ['N/A','‼️ CALLAHAN ‼️'].forEach(label => {
    const opt = document.createElement('option');
    opt.value       = label;
    opt.textContent = label;
    ddAs.appendChild(opt);
  });
}

// ──────────────────────────────────────────
// 8. Build a log entry object
// ──────────────────────────────────────────
function makeLog(id, teamLetter, scorer, assist) {
  const [teamAName, teamBName] = sessionData.GameID.split(' vs ');
  return {
    scoreID: id,
    GameID:  sessionData.GameID,
    Time:    new Date().toLocaleTimeString(),
    Team:    teamLetter === 'A' ? teamAName : teamBName,
    Scorer:  scorer,
    Assist:  assist
  };
}

// ──────────────────────────────────────────
// 9. Save (add or edit) a score
// ──────────────────────────────────────────
function saveScore() {
  const pop        = document.getElementById('scorePopup');
  const teamLetter = pop.dataset.team;
  const scorer     = document.getElementById('scorer').value;
  const assist     = document.getElementById('assist').value;

  if (!scorer) {
    alert('Please select a scorer');
    return;
  }

  if (currentEditID == null) {
    // add
    const id  = Date.now();
    const log = makeLog(id, teamLetter, scorer, assist);
    sessionData.logs.push(log);
    appendScoreRow(id, teamLetter, scorer, assist);
  } else {
    // update
    const idx = sessionData.logs.findIndex(l => l.scoreID === currentEditID);
    sessionData.logs[idx].Scorer = scorer;
    sessionData.logs[idx].Assist = assist;
    updateScoreRow(currentEditID, scorer, assist, teamLetter);
  }

  saveSession();
  closePopup();
}

// ──────────────────────────────────────────
// 10. Append & update table rows
// ──────────────────────────────────────────
function appendScoreRow(id, teamLetter, scorer, assist) {
  const tbody = document.getElementById('scoringTableBody');
  const r = tbody.insertRow();
  r.dataset.scoreId = id;

  if (teamLetter === 'A') {
    r.insertCell().textContent = scorer;
    r.insertCell().textContent = assist;
    r.insertCell(); // “Total” placeholder
    r.insertCell(); r.insertCell();
  } else {
    r.insertCell(); r.insertCell(); r.insertCell();
    r.insertCell().textContent = scorer;
    r.insertCell().textContent = assist;
  }

  const editCell = r.insertCell();
  const btn = document.createElement('button');
  btn.textContent = 'Edit';
  btn.onclick   = () => editScore(id);
  editCell.appendChild(btn);
}

function updateScoreRow(id, scorer, assist, teamLetter) {
  const row = document.querySelector(`tr[data-score-id="${id}"]`);
  if (!row) return;
  const offset = teamLetter === 'A' ? 0 : 3;
  row.cells[offset].textContent     = scorer;
  row.cells[offset + 1].textContent = assist;
}

// ──────────────────────────────────────────
// 11. Edit an existing score
// ──────────────────────────────────────────
function editScore(id) {
  currentEditID = id;
  const log      = sessionData.logs.find(l => l.scoreID === id);
  const [teamAName] = sessionData.GameID.split(' vs ');
  const letter   = log.Team === teamAName ? 'A' : 'B';

  buildPlayerDropdowns(letter);
  document.getElementById('scorer').value = log.Scorer;
  document.getElementById('assist').value = log.Assist;

  const pop = document.getElementById('scorePopup');
  pop.dataset.team = letter;
  document.getElementById('popupTitle').textContent  = 'Edit Score';
  document.getElementById('popupButton').value       = 'Update Score';
  document.getElementById('overlay').style.display   = 'block';
  pop.style.display                                 = 'block';
}

// ──────────────────────────────────────────
// 12. Submit & clear after 5s
// ──────────────────────────────────────────
async function submitScore() {
  if (!sessionData.logs.length) {
    alert('No scores to submit.');
    return;
  }
  startLoading();
  try {
    await fetch(API_URL, {
      method:  'POST',
      mode:    'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(sessionData)
    });
    stopLoading();
    document.getElementById('successMessage').style.display       = 'block';
    document.getElementById('loggedDataContainer').style.display  = 'block';

    setTimeout(() => {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }, 5000);

  } catch (err) {
    stopLoading();
    alert('Submit error: ' + err);
  }
}

// ──────────────────────────────────────────
// 13. Loading animation
// ──────────────────────────────────────────
function startLoading() {
  const el   = document.getElementById('loadingAnimation');
  const dots = document.getElementById('dots');
  loadingInterval = setInterval(() => {
    dots.textContent = dots.textContent.length < 3 ? dots.textContent + '.' : '';
  }, 500);
  el.style.display = 'block';
}

function stopLoading() {
  clearInterval(loadingInterval);
  document.getElementById('loadingAnimation').style.display = 'none';
  document.getElementById('dots').textContent               = '';
}

// ──────────────────────────────────────────
// 14. Timer: reset, toggle & display
// ──────────────────────────────────────────
function resetCountdown() {
  clearInterval(countdownInterval);
  const mins = parseInt(document.getElementById('countdownTime').value, 10) || 20;
  endTime = Date.now() + mins * 60000;
  isRunning = false;
  updateTimerDisplay();
  localStorage.setItem('timerEnd', endTime);
  localStorage.setItem('timerRun', isRunning);
}

function toggleTimer() {
  isRunning = !isRunning;
  const btn = document.getElementById('playPauseBtn');
  btn.textContent = isRunning ? 'Pause' : 'Play';

  if (isRunning) {
    countdownInterval = setInterval(() => {
      updateTimerDisplay();
      // Stop if past max overtime
      if (Date.now() >= endTime + MAX_OVERTIME) {
        clearInterval(countdownInterval);
        isRunning = false;
        btn.textContent = 'Play';
      }
    }, 500);
  } else {
    clearInterval(countdownInterval);
  }

  localStorage.setItem('timerEnd', endTime);
  localStorage.setItem('timerRun', isRunning);
}

function updateTimerDisplay() {
  const diff = endTime - Date.now();
  // Clamp to max overtime
  const clamped = diff < 0 ? Math.max(diff, -MAX_OVERTIME) : diff;
  const sign    = clamped < 0 ? '-' : '';
  const absMs   = Math.abs(clamped);
  const m       = String(Math.floor(absMs / 60000)).padStart(2, '0');
  const s       = String(Math.floor((absMs % 60000) / 1000)).padStart(2, '0');
  document.getElementById('timerDisplay').textContent = `${sign}${m}:${s}`;
}

// ──────────────────────────────────────────
// 15. Initialize on page load
// ──────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await fetchTeams();

  if (localStorage.getItem(STORAGE_KEY)) {
    loadSession();
  } else {
    initFreshSession();
  }

  // restore timer state
  const te = localStorage.getItem('timerEnd');
  endTime  = te ? +te : Date.now() + 20 * 60000;
  isRunning = localStorage.getItem('timerRun') === 'true';
  updateTimerDisplay();
  if (isRunning) toggleTimer();
});
