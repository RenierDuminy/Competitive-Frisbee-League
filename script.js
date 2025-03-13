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
  // Replace this URL with your own deployed Apps Script link
  const url = "https://script.google.com/macros/s/AKfycbwgDHDYawscG5k1v0dbjse8xtm7WUcGZtQRACK-9dxjerY3VsvkkeL4QBGIRwXsqT85/exec";

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    // teamsData is an object like { "Dagbreek": [...players...], "Helderberg": [...], etc. }
    teamsData = await response.json();
    console.log("Fetched teams:", teamsData);

    // Now that we have the data, populate the <select> elements
    populateTeamOptions(teamsData);

  } catch (error) {
    console.error("Error fetching teams:", error);
  }
}


// ------------- Populate Team Options -------------
function populateTeamOptions(teams) {
  const teamASelect = document.getElementById('teamA');
  const teamBSelect = document.getElementById('teamB');

  // Clear out any existing <option> elements
  teamASelect.innerHTML = "";
  teamBSelect.innerHTML = "";

  // Get the array of team names from the object
  const teamNames = Object.keys(teams);

  // Create a DocumentFragment for performance
  const fragmentA = document.createDocumentFragment();
  const fragmentB = document.createDocumentFragment();

  // For each team name, create an <option> in each select
  teamNames.forEach(teamName => {
    const optionA = document.createElement('option');
    optionA.value = teamName;
    optionA.textContent = teamName;
    fragmentA.appendChild(optionA);

    const optionB = document.createElement('option');
    optionB.value = teamName;
    optionB.textContent = teamName;
    fragmentB.appendChild(optionB);
  });

  teamASelect.appendChild(fragmentA);
  teamBSelect.appendChild(fragmentB);

  // When the user picks a team in <select>, update the textarea
  teamASelect.addEventListener('change', () => updatePlayerList('teamA'));
  teamBSelect.addEventListener('change', () => updatePlayerList('teamB'));
}


// ------------- Update Player List -------------
function updatePlayerList(teamID) {
  // teamID is either "teamA" or "teamB"
  const selectedTeam = document.getElementById(teamID).value;
  const playerListElement = document.getElementById(`${teamID}List`);

  // teamsData[selectedTeam] is an array of players for that team
  const players = teamsData[selectedTeam] || [];

  // Display players one per line
  playerListElement.value = players.join('\n');

  // Auto-resize the textarea based on its content
  playerListElement.style.height = 'auto';
  playerListElement.style.height = playerListElement.scrollHeight + 'px';
}

// Fetch the teams once the page has loaded
window.addEventListener('DOMContentLoaded', fetchTeams);


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

  // Determine GameID first
  const teamAName = document.getElementById('teamA').value;
  const teamBName = document.getElementById('teamB').value;
  const gameID = `${teamAName} vs ${teamBName}`;

  // Now download CSV as "BackupLog_<GameID>.csv"
  downloadDataAsCSV(scoreLogs, `BackupLog - ${gameID}.csv`);

  const dataToSend = {
    GameID: gameID,
    Date: date,
    logs: scoreLogs
  };

  try {
    startLoadingAnimation();

    await fetch(
      'https://script.google.com/macros/s/AKfycbwgDHDYawscG5k1v0dbjse8xtm7WUcGZtQRACK-9dxjerY3VsvkkeL4QBGIRwXsqT85/exec',
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
 * Timer Functionality with Persistence
 *************************************************/

// Global variables
let countdownInterval;
let isRunning = false;
let endTime = 0; // Will hold the absolute end timestamp (in ms)

// Load previous timer state from localStorage
function loadTimerState() {
  const storedEndTime = localStorage.getItem('timerEndTime');
  const storedIsRunning = localStorage.getItem('timerRunning');

  if (storedEndTime) {
    // Restore the saved endTime (in ms)
    endTime = parseInt(storedEndTime, 10);
  } else {
    // Default: 20 minutes from "now" if nothing is stored
    endTime = Date.now() + (20 * 60 * 1000);
  }

  // Restore running state
  isRunning = (storedIsRunning === 'true');

  // Always update the display once on page load
  updateTimerDisplay();

  // If it was running, resume the countdown
  if (isRunning) {
    startCountdown();
  }
}

// Save the timer state to localStorage
function saveTimerState() {
  localStorage.setItem('timerEndTime', endTime.toString());
  localStorage.setItem('timerRunning', isRunning ? 'true' : 'false');
}

// Calculate how many seconds remain
function getTimeRemaining() {
  const now = Date.now();
  // Difference (in milliseconds); convert to whole seconds
  return Math.floor((endTime - now) / 1000);
}

// Play a short beep
function playBeep() {
  const beep = new Audio('beep-07a.wav');
  beep.play();
}

// Play a series of beeps when countdown hits zero
function playEndBeep() {
  let count = 0;
  function beepLoop() {
    if (count < 10) {
      const beep = new Audio('beep-07a.wav');
      beep.play();
      count++;
      setTimeout(beepLoop, 1000);
    }
  }
  beepLoop();
}

// Update the timer display in the DOM
function updateTimerDisplay() {
  const countdownSeconds = getTimeRemaining();
  const timerDisplay = document.getElementById('timerDisplay');

  // Convert to MM:SS (or show negative if below zero)
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

// Start (or resume) the countdown
function startCountdown() {
  isRunning = true;
  document.getElementById('playPauseBtn').textContent = "Pause";
  document.getElementById('timerColumn').classList.add('timer-running');
  document.getElementById('timerColumn').classList.remove('timer-paused');
  saveTimerState();

  // Clear any existing interval to avoid duplicates
  clearInterval(countdownInterval);

  // Update display every second
  countdownInterval = setInterval(() => {
    updateTimerDisplay();

    // If time is up or below zero, stop
    if (getTimeRemaining() <= 0) {
      clearInterval(countdownInterval);
      isRunning = false;
      saveTimerState();
      playEndBeep();
    }
  }, 1000);
}

// Toggle play/pause
function toggleTimer() {
  if (isRunning) {
    // Pause
    clearInterval(countdownInterval);
    isRunning = false;
    document.getElementById('playPauseBtn').textContent = "Play";
    document.getElementById('timerColumn').classList.remove('timer-running');
    document.getElementById('timerColumn').classList.add('timer-paused');
    playBeep();
  } else {
    // Resume
    isRunning = true;
    playBeep();
    startCountdown();
  }
  saveTimerState();
}

// Reset the countdown to a new value
function resetCountdown() {
  clearInterval(countdownInterval);
  isRunning = false;
  document.getElementById('playPauseBtn').textContent = "Play";
  document.getElementById('timerColumn').classList.remove('timer-running', 'timer-paused');

  // Grab user input in minutes, default to 20 if empty
  const newTime = parseInt(document.getElementById('countdownTime').value, 10) || 20;
  // Set new end time (now + X minutes)
  endTime = Date.now() + (newTime * 60 * 1000);

  saveTimerState();
  updateTimerDisplay();
}

// NEW FUNCTION
function downloadDataAsCSV(dataArray, filename = 'scoreLogs.csv') {
  // Build CSV string
  const headers = Object.keys(dataArray[0]).join(',');
  const rows = dataArray.map(item =>
    Object.values(item).map(value => `"${value}"`).join(',')
  );
  const csvContent = [headers, ...rows].join('\n');

  // Create file and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


// Initialize once the page loads
window.addEventListener('DOMContentLoaded', loadTimerState);
