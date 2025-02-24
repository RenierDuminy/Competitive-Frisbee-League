// Initialize score variables
let teamAScore = 0;
let teamBScore = 0;

// Global variable to store team data
let teamsData = [];

// Variable for loading animation interval
let loadingInterval;

// Tracks if we're editing an existing score
// If null => adding new
// If set to an ID => editing
let currentEditID = null;

document.addEventListener("DOMContentLoaded", () => {
  // Set the current time
  document.getElementById('time').value = new Date().toLocaleString();
  fetchTeams();
});

// ------------- Fetch Teams -------------
async function fetchTeams() {
  const storedTeams = sessionStorage.getItem('teams');
  if (storedTeams) {
    teamsData = JSON.parse(storedTeams);
    populateTeamOptions(teamsData);
  } else {
    try {
      const response = await fetch(
        'https://script.google.com/macros/s/AKfycbzcg2i_dSDPwpgs5aHZz6glU4K0z2K6A3CfNxrinzDDff9rYQ6uSA35Btp2hUebFU4/exec'
      );
      const teams = await response.json();
      teamsData = teams;
      sessionStorage.setItem('teams', JSON.stringify(teams));
      populateTeamOptions(teams);
    } catch (error) {
      console.error('Error fetching team names:', error);
    }
  }
}

// ------------- Populate Team Options -------------
function populateTeamOptions(teams) {
  const teamASelect = document.getElementById('teamA');
  const teamBSelect = document.getElementById('teamB');

  const uniqueTeams = [...new Set(teams.map(item => item.teamA))];

  const fragmentA = document.createDocumentFragment();
  const fragmentB = document.createDocumentFragment();

  uniqueTeams.forEach(team => {
    const optionA = document.createElement('option');
    optionA.value = team;
    optionA.textContent = team;
    fragmentA.appendChild(optionA);

    const optionB = document.createElement('option');
    optionB.value = team;
    optionB.textContent = team;
    fragmentB.appendChild(optionB);
  });

  teamASelect.appendChild(fragmentA);
  teamBSelect.appendChild(fragmentB);

  teamASelect.addEventListener('change', () => updatePlayerList('teamA'));
  teamBSelect.addEventListener('change', () => updatePlayerList('teamB'));
}

// ------------- Update Player List -------------
function updatePlayerList(team) {
  const selectedTeam = document.getElementById(team).value;
  const playerListElement = document.getElementById(`${team}List`);

  const players = teamsData
    .filter(item => item.teamA === selectedTeam)
    .map(item => item.teamB)
    .sort();

  playerListElement.value = players.join('\n');
  playerListElement.style.height = 'auto';
  playerListElement.style.height = playerListElement.scrollHeight + 'px';
}

// ------------- Open Popup -------------
function openPopup(team) {
  currentEditID = null; // We're adding a new score

  // Show the popup
  document.getElementById('overlay').style.display = 'block';
  document.getElementById('scorePopup').style.display = 'block';

  // Popup title & button
  document.getElementById('popupTitle').textContent = 'Add Score';
  document.getElementById('popupButton').value = 'Add Score';

  // Store the team ("A" or "B") in the popup’s data attribute
  document.getElementById('scorePopup').dataset.team = team;

  // Clear out existing options in Scorer & Assist dropdowns
  const scorerDropdown = document.getElementById('scorer');
  const assistDropdown = document.getElementById('assist');
  scorerDropdown.innerHTML = '<option value="">Select Scorer</option>';
  assistDropdown.innerHTML = '<option value="">Select Assist</option>';

  // Read the relevant team’s textarea (teamAList or teamBList)
  const playersText = document.getElementById(
    team === 'A' ? 'teamAList' : 'teamBList'
  ).value;
  const players = playersText ? playersText.split('\n') : [];

  // Populate scorer/assist dropdowns with the team's players
  players.forEach(player => {
    const optionScorer = document.createElement('option');
    optionScorer.value = player;
    optionScorer.textContent = player;
    scorerDropdown.appendChild(optionScorer);

    const optionAssist = document.createElement('option');
    optionAssist.value = player;
    optionAssist.textContent = player;
    assistDropdown.appendChild(optionAssist);
  });

  // ------ FIX: Add "N/A" and "‼️ CALLAHAN ‼️" as separate options ------
  const naOptionScorer = document.createElement('option');
  naOptionScorer.value = 'N/A';
  naOptionScorer.textContent = 'N/A';
  scorerDropdown.appendChild(naOptionScorer);

  // For assist, first add N/A
  const naOptionAssist = document.createElement('option');
  naOptionAssist.value = 'N/A';
  naOptionAssist.textContent = 'N/A';
  assistDropdown.appendChild(naOptionAssist);

  // Then add a separate Callahan option
  const callahanOptionAssist = document.createElement('option');
  callahanOptionAssist.value = '‼️ CALLAHAN ‼️';
  callahanOptionAssist.textContent = '‼️ CALLAHAN ‼️';
  assistDropdown.appendChild(callahanOptionAssist);
}

// ------------- Save Score (Add or Edit) -------------
function saveScore() {
  const popup = document.getElementById('scorePopup');
  const team = popup.dataset.team; // "A" or "B"
  const scorer = document.getElementById('scorer').value;
  const assist = document.getElementById('assist').value;

  if (!scorer || !assist) {
    alert('Please select both scorer and assist.');
    return;
  }

  let scoreLogs = JSON.parse(sessionStorage.getItem('scoreLogs')) || [];

  if (!currentEditID) {
    // ----- ADD NEW -----
    if (team === 'A') teamAScore++;
    else teamBScore++;

    const newScoreID = Date.now().toString();
    const logEntry = createLogObject(newScoreID, team, scorer, assist);

    scoreLogs.push(logEntry);
    sessionStorage.setItem('scoreLogs', JSON.stringify(scoreLogs));

    // Add a new row
    const scoringTableBody = document.getElementById('scoringTableBody');
    const newRow = createScoreRow(logEntry);
    scoringTableBody.appendChild(newRow);

    closePopup();
  } else {
    // ----- EDIT EXISTING -----
    const index = scoreLogs.findIndex(log => log.scoreID === currentEditID);
    if (index === -1) {
      alert('Could not find this score log to edit.');
      return;
    }
    // We do NOT allow changing the team (only scorer/assist).
    scoreLogs[index].Score = scorer;
    scoreLogs[index].Assist = assist;
    sessionStorage.setItem('scoreLogs', JSON.stringify(scoreLogs));

    // Update the table row
    const row = document.querySelector(`tr[data-score-id="${currentEditID}"]`);
    if (row) {
      // If it's team A, the Score/Assist go in columns 0,1
      // If it's team B, columns 3,4
      const teamLetter = popup.dataset.team;
      if (teamLetter === 'A') {
        row.cells[0].textContent = scorer; 
        row.cells[1].textContent = assist;
      } else {
        row.cells[3].textContent = scorer; 
        row.cells[4].textContent = assist;
      }
    }

    closePopup();
  }
}

// ------------- Create Log Object -------------
function createLogObject(scoreID, teamLetter, scorer, assist) {
  const teamAName = document.getElementById('teamA').value;
  const teamBName = document.getElementById('teamB').value;
  const gameID = `${teamAName} vs ${teamBName}`;
  const teamName = (teamLetter === 'A') ? teamAName : teamBName;

  return {
    scoreID: scoreID,
    GameID: gameID,
    Time: new Date().toLocaleString(),
    Team: teamName,
    Score: scorer,
    Assist: assist
  };
}

// ------------- Create Score Row -------------
function createScoreRow(logEntry) {
  const teamAName = document.getElementById('teamA').value;
  const teamLetter = (logEntry.Team === teamAName) ? 'A' : 'B';
  const row = document.createElement('tr');

  row.setAttribute('data-score-id', logEntry.scoreID);

  // The scoreboard at the time of adding
  const scoreboard = `${teamAScore}:${teamBScore}`;

  if (teamLetter === 'A') {
    row.innerHTML = `
      <td>${logEntry.Score}</td>
      <td>${logEntry.Assist}</td>
      <td class="total">${scoreboard}</td>
      <td></td>
      <td></td>
      <td><button type="button" class="edit-btn">Edit</button></td>
    `;
  } else {
    row.innerHTML = `
      <td></td>
      <td></td>
      <td class="total">${scoreboard}</td>
      <td>${logEntry.Score}</td>
      <td>${logEntry.Assist}</td>
      <td><button type="button" class="edit-btn">Edit</button></td>
    `;
  }

  // Attach edit listener
  row.querySelector('.edit-btn').addEventListener('click', () => {
    editScore(logEntry.scoreID);
  });

  return row;
}

// ------------- Edit Score -------------
function editScore(scoreID) {
  let scoreLogs = JSON.parse(sessionStorage.getItem('scoreLogs')) || [];
  const logToEdit = scoreLogs.find(log => log.scoreID === scoreID);
  if (!logToEdit) {
    alert('Could not find score log to edit!');
    return;
  }

  // Store this ID so saveScore() knows we're editing
  currentEditID = scoreID;

  // Show the popup in "Edit" mode
  document.getElementById('overlay').style.display = 'block';
  document.getElementById('scorePopup').style.display = 'block';
  document.getElementById('popupTitle').textContent = 'Edit Score';
  document.getElementById('popupButton').value = 'Update Score';

  // Determine if it's Team A or B
  const teamAName = document.getElementById('teamA').value;
  const oldTeamLetter = (logToEdit.Team === teamAName) ? 'A' : 'B';

  // Put that in the popup’s dataset (no team dropdown, so user cannot change teams)
  document.getElementById('scorePopup').dataset.team = oldTeamLetter;

  // Rebuild the scorer/assist dropdowns
  const scorerDropdown = document.getElementById('scorer');
  const assistDropdown = document.getElementById('assist');

  scorerDropdown.innerHTML = '<option value="">Select Scorer</option>';
  assistDropdown.innerHTML = '<option value="">Select Assist</option>';

  // Load players from whichever team is relevant
  const playersText = document.getElementById(
    oldTeamLetter === 'A' ? 'teamAList' : 'teamBList'
  ).value;
  const players = playersText ? playersText.split('\n') : [];

  // Populate the dropdowns with the team’s players
  players.forEach(player => {
    const optionScorer = document.createElement('option');
    optionScorer.value = player;
    optionScorer.textContent = player;
    scorerDropdown.appendChild(optionScorer);

    const optionAssist = document.createElement('option');
    optionAssist.value = player;
    optionAssist.textContent = player;
    assistDropdown.appendChild(optionAssist);
  });

  // ------ FIX: Add "🚫N/A" and "‼️ CALLAHAN ‼️" as separate options ------
  const naOptionScorer = document.createElement('option');
  naOptionScorer.value = '🚫N/A';
  naOptionScorer.textContent = '🚫N/A';
  scorerDropdown.appendChild(naOptionScorer);

  const naOptionAssist = document.createElement('option');
  naOptionAssist.value = '🚫N/A';
  naOptionAssist.textContent = '🚫N/A';
  assistDropdown.appendChild(naOptionAssist);

  const callahanOptionAssist = document.createElement('option');
  callahanOptionAssist.value = '‼️ CALLAHAN ‼️';
  callahanOptionAssist.textContent = '‼️ CALLAHAN ‼️';
  assistDropdown.appendChild(callahanOptionAssist);

  // Pre-fill the current scorer and assist
  scorerDropdown.value = logToEdit.Score;
  assistDropdown.value = logToEdit.Assist;
}

// ------------- Close Popup -------------
function closePopup() {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('scorePopup').style.display = 'none';
}

// ------------- Loading Animation -------------
function startLoadingAnimation() {
  const loadingAnimation = document.getElementById('loadingAnimation');
  const dots = document.getElementById('dots');
  let dotCount = 0;

  loadingAnimation.style.display = 'block';
  loadingInterval = setInterval(() => {
    dotCount = (dotCount + 1) % 4; 
    dots.textContent = '.'.repeat(dotCount);
  }, 500);
}

function stopLoadingAnimation() {
  const loadingAnimation = document.getElementById('loadingAnimation');
  const dots = document.getElementById('dots');
  clearInterval(loadingInterval);
  dots.textContent = '';
  loadingAnimation.style.display = 'none';
}

// ------------- Submit Score -------------
async function submitScore() {
  const scoreLogs = JSON.parse(sessionStorage.getItem('scoreLogs')) || [];
  if (scoreLogs.length === 0) {
    alert('No scores have been logged.');
    return;
  }
  const teamAName = document.getElementById('teamA').value;
  const teamBName = document.getElementById('teamB').value;
  const gameID = `${teamAName} vs ${teamBName}`;
  const date = new Date().toLocaleDateString();

  const dataToSend = {
    GameID: gameID,
    Date: date,
    logs: scoreLogs
  };

  try {
    startLoadingAnimation();

    await fetch(
      'https://script.google.com/macros/s/AKfycbzcg2i_dSDPwpgs5aHZz6glU4K0z2K6A3CfNxrinzDDff9rYQ6uSA35Btp2hUebFU4/exec',
      {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSend)
      }
    );

    stopLoadingAnimation();
    document.getElementById('successMessage').textContent = 'Data has been successfully exported!';
    document.getElementById('successMessage').style.display = 'block';

    sessionStorage.removeItem('scoreLogs');
    // Optionally reset scoreboard, etc.
    // teamAScore = 0;
    // teamBScore = 0;
  } catch (error) {
    stopLoadingAnimation();
    alert('Error exporting data: ' + error.message);
  }
}

/*************************************************
 * Timer Functionality with Persistence (Timer 1)
 *************************************************/

// Global variables for Timer 1
let countdownInterval;
let isRunning = false;
let endTime = 0; // absolute end timestamp (in ms)

// Load previous timer state for Timer 1 from localStorage
function loadTimerState() {
  const storedEndTime = localStorage.getItem('timerEndTime');
  const storedIsRunning = localStorage.getItem('timerRunning');

  if (storedEndTime) {
    endTime = parseInt(storedEndTime, 10);
  } else {
    endTime = Date.now() + (20 * 60 * 1000); // default to 20 minutes from now
  }

  isRunning = (storedIsRunning === 'true');
  updateTimerDisplay();

  if (isRunning) {
    startCountdown();
  }
}

// Save Timer 1 state to localStorage
function saveTimerState() {
  localStorage.setItem('timerEndTime', endTime.toString());
  localStorage.setItem('timerRunning', isRunning ? 'true' : 'false');
}

// Calculate seconds remaining for Timer 1
function getTimeRemaining() {
  return Math.floor((endTime - Date.now()) / 1000);
}

// Play a short beep
function playBeep() {
  const beep = new Audio('button_2.mp3');
  beep.play();
}

// Play end beep for Timer 1
function playEndBeep() {
  const beep = new Audio('Timer_end.mp3');
  beep.play();
}

// Update Timer 1 display in the DOM (assumes element with id 'timerDisplay')
function updateTimerDisplay() {
  const countdownSeconds = getTimeRemaining();
  const timerDisplay = document.getElementById('timerDisplay');
  const absSeconds = Math.abs(countdownSeconds);
  const mins = Math.floor(absSeconds / 60).toString().padStart(2, '0');
  const secs = (absSeconds % 60).toString().padStart(2, '0');
  let timeString = `${mins}:${secs}`;

  if (countdownSeconds < 0) {
    timeString = `-${timeString}`;
    timerDisplay.classList.add('timer-negative');
  } else {
    timerDisplay.classList.remove('timer-negative');
  }
  timerDisplay.textContent = timeString;
}

// Start (or resume) Timer 1 countdown
function startCountdown() {
  isRunning = true;
  document.getElementById('playPauseBtn').textContent = "Pause";
  document.getElementById('timerColumn').classList.add('timer-running');
  document.getElementById('timerColumn').classList.remove('timer-paused');
  saveTimerState();
  clearInterval(countdownInterval);

  countdownInterval = setInterval(() => {
    updateTimerDisplay();
    if (getTimeRemaining() <= 0) {
      clearInterval(countdownInterval);
      isRunning = false;
      saveTimerState();
      playEndBeep();
    }
  }, 1000);
}

// Toggle Timer 1 play/pause
function toggleTimer() {
  if (isRunning) {
    clearInterval(countdownInterval);
    isRunning = false;
    document.getElementById('playPauseBtn').textContent = "Play";
    document.getElementById('timerColumn').classList.remove('timer-running');
    document.getElementById('timerColumn').classList.add('timer-paused');
    playBeep();
  } else {
    isRunning = true;
    playBeep();
    startCountdown();
  }
  saveTimerState();
}

// Reset Timer 1 countdown using input from element 'countdownTime'
function resetCountdown() {
  clearInterval(countdownInterval);
  isRunning = false;
  document.getElementById('playPauseBtn').textContent = "Play";
  document.getElementById('timerColumn').classList.remove('timer-running', 'timer-paused');

  const newTime = parseInt(document.getElementById('countdownTime').value, 10) || 20;
  endTime = Date.now() + (newTime * 60 * 1000);
  saveTimerState();
  updateTimerDisplay();
}

/*************************************************
 * Second Timer Functionality with Persistence (Timer 2)
 *************************************************/

// Global variables for Timer 2
let countdownInterval2;
let isRunning2 = false;
let endTime2 = 0; // absolute end timestamp (in ms)

// Load previous timer state for Timer 2 from localStorage
function loadTimerState2() {
  const storedEndTime2 = localStorage.getItem('timerEndTime2');
  const storedIsRunning2 = localStorage.getItem('timerRunning2');

  if (storedEndTime2) {
    endTime2 = parseInt(storedEndTime2, 10);
  } else {
    endTime2 = Date.now() + (20 * 60 * 1000); // default to 20 minutes from now
  }

  isRunning2 = (storedIsRunning2 === 'true');
  updateTimerDisplay2();

  if (isRunning2) {
    startCountdown2();
  }
}

// Save Timer 2 state to localStorage
function saveTimerState2() {
  localStorage.setItem('timerEndTime2', endTime2.toString());
  localStorage.setItem('timerRunning2', isRunning2 ? 'true' : 'false');
}

// Calculate seconds remaining for Timer 2
function getTimeRemaining2() {
  return Math.floor((endTime2 - Date.now()) / 1000);
}

// Update Timer 2 display in the DOM (assumes element with id 'timerDisplay2')
function updateTimerDisplay2() {
  const countdownSeconds2 = getTimeRemaining2();
  const timerDisplay2 = document.getElementById('timerDisplay2');
  const absSeconds2 = Math.abs(countdownSeconds2);
  const mins2 = Math.floor(absSeconds2 / 60).toString().padStart(2, '0');
  const secs2 = (absSeconds2 % 60).toString().padStart(2, '0');
  let timeString2 = `${mins2}:${secs2}`;

  if (countdownSeconds2 < 0) {
    timeString2 = `-${timeString2}`;
    timerDisplay2.classList.add('timer-negative');
  } else {
    timerDisplay2.classList.remove('timer-negative');
  }
  timerDisplay2.textContent = timeString2;
}

// Start (or resume) Timer 2 countdown
function startCountdown2() {
  isRunning2 = true;
  document.getElementById('playPauseBtn2').textContent = "Pause";
  document.getElementById('timerColumn2').classList.add('timer-running');
  document.getElementById('timerColumn2').classList.remove('timer-paused');
  saveTimerState2();
  clearInterval(countdownInterval2);

  countdownInterval2 = setInterval(() => {
    updateTimerDisplay2();
    if (getTimeRemaining2() <= 0) {
      clearInterval(countdownInterval2);
      isRunning2 = false;
      saveTimerState2();
      playEndBeep();
    }
  }, 1000);
}

// Toggle Timer 2 play/pause
function toggleTimer2() {
  if (isRunning2) {
    clearInterval(countdownInterval2);
    isRunning2 = false;
    document.getElementById('playPauseBtn2').textContent = "Play";
    document.getElementById('timerColumn2').classList.remove('timer-running');
    document.getElementById('timerColumn2').classList.add('timer-paused');
    playBeep();
  } else {
    isRunning2 = true;
    playBeep();
    startCountdown2();
  }
  saveTimerState2();
}

// Reset Timer 2 countdown using input from element 'countdownTime2'
function resetCountdown2() {
  clearInterval(countdownInterval2);
  isRunning2 = false;
  document.getElementById('playPauseBtn2').textContent = "Play";
  document.getElementById('timerColumn2').classList.remove('timer-running', 'timer-paused');

  const newTime2 = parseInt(document.getElementById('countdownTime2').value, 10) || 20;
  endTime2 = Date.now() + (newTime2 * 60 * 1000);
  saveTimerState2();
  updateTimerDisplay2();
}

// Initialize both timers once the page loads
window.addEventListener('DOMContentLoaded', () => {
  loadTimerState();
  loadTimerState2();
});