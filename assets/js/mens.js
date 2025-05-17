/* -------------------------------
   Score logging & timer script
   ------------------------------- */

// ---------- Global state ----------
let teamAScore = 0;
let teamBScore = 0;
let currentEditID = null;
let countdownInterval;
let isRunning = false;
let endTime = 0; // absolute end timestamp (ms)

// ---------- Add Score ----------
function addScore(team) {
  const popup = document.getElementById('scorePopup');
  popup.dataset.team = team;                // "A" or "B"
  document.getElementById('overlay').style.display = 'block';
  popup.style.display = 'block';
  document.getElementById('popupTitle').textContent = 'Add Score';
  document.getElementById('popupButton').value = 'Save Score';

  // Reset form fields
  document.getElementById('scorer').value = '';
  document.getElementById('assist').value = '';
  currentEditID = null;

  // Build dropdowns for the correct team
  buildPlayerDropdowns(team);
}

// ---------- Build scorer / assist dropdowns ----------
function buildPlayerDropdowns(teamLetter) {
  const scorer = document.getElementById('scorer');
  const assist = document.getElementById('assist');
  scorer.innerHTML = '<option value="">Select Scorer</option>';
  assist.innerHTML = '<option value="">Select Assist</option>';

  const playersText = document.getElementById(
    teamLetter === 'A' ? 'teamAList' : 'teamBList'
  ).value;
  const players = playersText.split('\n').filter(p => p.trim() !== '');

  players.forEach(p => {
    const sOpt = document.createElement('option');
    sOpt.value = p;
    sOpt.textContent = p;
    scorer.appendChild(sOpt);

    const aOpt = document.createElement('option');
    aOpt.value = p;
    aOpt.textContent = p;
    assist.appendChild(aOpt);
  });

  // Special assist options
  ['N/A', '‼️ CALLAHAN ‼️'].forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    assist.appendChild(opt);
  });
}

// ---------- Save Score (add or edit) ----------
function saveScore() {
  const popup = document.getElementById('scorePopup');
  const teamLetter = popup.dataset.team;    // "A" | "B"
  const scorer = document.getElementById('scorer').value;
  const assist = document.getElementById('assist').value;

  if (!scorer) {
    alert('Please select a scorer.');
    return;
  }

  let scoreLogs = JSON.parse(localStorage.getItem('scoreLogs')) || [];

  if (currentEditID === null) {
    // New entry
    const scoreID = Date.now();
    scoreLogs.push(createLogObject(scoreID, teamLetter, scorer, assist));
    appendScoreRow(scoreID, teamLetter, scorer, assist);
    (teamLetter === 'A' ? teamAScore++ : teamBScore++);
  } else {
    // Edit existing
    const idx = scoreLogs.findIndex(l => l.scoreID === currentEditID);
    if (idx === -1) {
      alert('Could not find score log to edit!');
      return;
    }
    scoreLogs[idx].Scorer = scorer;
    scoreLogs[idx].Assist = assist;
    updateScoreRow(currentEditID, scorer, assist, teamLetter);
  }

  localStorage.setItem('scoreLogs', JSON.stringify(scoreLogs));
  updateScoreboardDisplay();
  closePopup();
}

// ---------- Create log object ----------
function createLogObject(id, teamLetter, scorer, assist) {
  const teamA = document.getElementById('teamA').value;
  const teamB = document.getElementById('teamB').value;

  return {
    scoreID: id,
    GameID: `${teamA} vs ${teamB}`,
    Time: new Date().toLocaleString(),
    Team: teamLetter === 'A' ? teamA : teamB,
    Scorer: scorer,
    Assist: assist
  };
}

// ---------- Append / update table rows ----------
function appendScoreRow(id, teamLetter, scorer, assist) {
  const body = document.getElementById('scoreTable').tBodies[0];
  const row = body.insertRow();
  row.dataset.scoreId = id;

  if (teamLetter === 'A') {
    row.insertCell(0).textContent = scorer;
    row.insertCell(1).textContent = assist;
    row.insertCell(2).textContent = '';
    row.insertCell(3).textContent = '';
  } else {
    row.insertCell(0).textContent = '';
    row.insertCell(1).textContent = '';
    row.insertCell(2).textContent = scorer;
    row.insertCell(3).textContent = assist;
  }

  const edit = row.insertCell(4);
  const btn = document.createElement('button');
  btn.textContent = 'Edit';
  btn.onclick = () => editScore(id);
  edit.appendChild(btn);
}

function updateScoreRow(id, scorer, assist, teamLetter) {
  const row = document.querySelector(`tr[data-score-id="${id}"]`);
  if (!row) return;

  if (teamLetter === 'A') {
    row.cells[0].textContent = scorer;
    row.cells[1].textContent = assist;
  } else {
    row.cells[2].textContent = scorer;
    row.cells[3].textContent = assist;
  }
}

// ---------- Edit ----------
function editScore(id) {
  const logs = JSON.parse(localStorage.getItem('scoreLogs')) || [];
  const log = logs.find(l => l.scoreID === id);
  if (!log) {
    alert('Could not find score log to edit!');
    return;
  }

  currentEditID = id;
  const teamA = document.getElementById('teamA').value;
  const teamLetter = log.Team === teamA ? 'A' : 'B';

  buildPlayerDropdowns(teamLetter);

  const popup = document.getElementById('scorePopup');
  popup.dataset.team = teamLetter;
  document.getElementById('scorer').value = log.Scorer;
  document.getElementById('assist').value = log.Assist;
  document.getElementById('overlay').style.display = 'block';
  popup.style.display = 'block';
  document.getElementById('popupTitle').textContent = 'Edit Score';
  document.getElementById('popupButton').value = 'Update Score';
}

// ---------- Popup helper ----------
function closePopup() {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('scorePopup').style.display = 'none';
}

// ---------- Submit (export) ----------
async function submitScore() {
  const logs = JSON.parse(localStorage.getItem('scoreLogs')) || [];
  if (logs.length === 0) {
    alert('No scores have been logged.');
    return;
  }

  const [teamA, teamB] = logs[0].GameID.split(' vs ');
  const data = {
    GameID: logs[0].GameID,
    Date: new Date().toLocaleDateString(),
    logs
  };

  try {
    startLoadingAnimation();
    await fetch(
      'https://script.google.com/macros/s/AKfycbwQrVAvqtdsYgAcWhD7zel5hwoydkkGY1LLYno6dpevg_P_bqjD7cv2cwhCTR1yhTe5/exec',
      {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }
    );
    stopLoadingAnimation();
    document.getElementById('successMessage').textContent =
      'Data has been successfully exported!';
    document.getElementById('successMessage').style.display = 'block';

    // Wipe after 5 s
    setTimeout(() => {
      localStorage.removeItem('scoreLogs');
    }, 5000);
  } catch (err) {
    stopLoadingAnimation();
    alert('Error exporting data: ' + err.message);
  }
}

/* ============================================
   TIMER (Persists state in localStorage)
   ============================================ */
function loadTimerState() {
  const storedEnd = localStorage.getItem('timerEndTime');
  endTime = storedEnd ? parseInt(storedEnd, 10) : Date.now() + 20 * 60000;
  isRunning = localStorage.getItem('timerRunning') === 'true';
  updateTimerDisplay();
  if (isRunning) startCountdown();
}
function updateTimerDisplay() {
  const remain = endTime - Date.now();
  const m = Math.max(0, Math.floor(remain / 60000));
  const s = Math.max(0, Math.floor((remain % 60000) / 1000));
  document.getElementById('timer').textContent =
    `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
function startCountdown() {
  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    if (Date.now() >= endTime) {
      clearInterval(countdownInterval);
      isRunning = false;
    }
    updateTimerDisplay();
  }, 1000);
}
function startStopTimer() {
  if (isRunning) {
    isRunning = false;
    clearInterval(countdownInterval);
  } else {
    isRunning = true;
    endTime = Date.now() + 20 * 60000;
    startCountdown();
  }
  localStorage.setItem('timerEndTime', endTime.toString());
  localStorage.setItem('timerRunning', isRunning);
}

/* ============================================
   NEW ► Load previous score log (if any)
   ============================================ */
function loadPreviousLogs() {
  const logs = JSON.parse(localStorage.getItem('scoreLogs')) || [];
  if (logs.length === 0) return;

  // Refill team names
  const [teamAName, teamBName] = logs[0].GameID.split(' vs ');
  document.getElementById('teamA').value = teamAName;
  document.getElementById('teamB').value = teamBName;

  // Re-create every row & recalc scores
  teamAScore = 0;
  teamBScore = 0;
  logs.forEach(l => {
    const teamLetter = l.Team === teamAName ? 'A' : 'B';
    appendScoreRow(l.scoreID, teamLetter, l.Scorer, l.Assist);
    teamLetter === 'A' ? teamAScore++ : teamBScore++;
  });
  updateScoreboardDisplay();
}

// ---------- Scoreboard display helper ----------
function updateScoreboardDisplay() {
  const a = document.getElementById('scoreA');
  const b = document.getElementById('scoreB');
  if (a) a.textContent = teamAScore;
  if (b) b.textContent = teamBScore;
}

/* ============================================
   Loading animation
   ============================================ */
let loadingInterval;
function startLoadingAnimation() {
  const wrap = document.getElementById('loadingAnimation');
  const dots = document.getElementById('dots');
  let n = 0;
  wrap.style.display = 'inline-block';
  loadingInterval = setInterval(() => {
    n = (n + 1) % 4;
    dots.textContent = '.'.repeat(n);
  }, 500);
}
function stopLoadingAnimation() {
  clearInterval(loadingInterval);
  document.getElementById('dots').textContent = '';
  document.getElementById('loadingAnimation').style.display = 'none';
}

// ---------- Initial page load ----------
window.addEventListener('load', () => {
  loadTimerState();
  loadPreviousLogs();           // ← new automatic restoration
});
