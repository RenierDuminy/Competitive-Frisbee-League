/**
 * Improved Scorekeeping Application
 * Refactored for better organization, error handling, and maintainability
 */

// =====================================================
// CONSTANTS AND CONFIGURATION
// =====================================================
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbwQrVAvqtdsYgAcWhD7zel5hwoydkkGY1LLYno6dpevg_P_bqjD7cv2cwhCTR1yhTe5/exec",
  DEFAULT_TIMER_MINUTES: 20,
  LOADING_ANIMATION_INTERVAL: 500,
  BEEP_COUNT: 10,
  BEEP_INTERVAL: 1000,
  STORAGE_KEYS: {
    SCORE_LOGS: 'scoreLogs',
    TIMER_END_TIME: 'timerEndTime',
    TIMER_RUNNING: 'timerRunning'
  },
  AUDIO_FILES: {
    BEEP: 'beep-07a.wav'
  }
};

const SPECIAL_OPTIONS = {
  NA: 'N/A',
  CALLAHAN: '‼️ CALLAHAN ‼️'
};

// =====================================================
// UTILITY FUNCTIONS
// =====================================================
const Utils = {
  /**
   * Safe JSON parse with fallback
   */
  safeJsonParse: (str, fallback = null) => {
    try {
      return JSON.parse(str) || fallback;
    } catch (e) {
      console.warn('JSON parse failed:', e);
      return fallback;
    }
  },

  /**
   * Debounce function to limit rapid function calls
   */
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Show user notification
   */
  showNotification: (message, type = 'info') => {
    // For now, use alert - could be enhanced with custom notifications
    if (type === 'error') {
      console.error(message);
      alert(`Error: ${message}`);
    } else {
      console.log(message);
      if (type === 'success') {
        const successEl = document.getElementById('successMessage');
        if (successEl) {
          successEl.textContent = message;
          successEl.style.display = 'block';
          setTimeout(() => {
            successEl.style.display = 'none';
          }, 5000);
        }
      }
    }
  },

  /**
   * Create DOM element with attributes and content
   */
  createElement: (tag, attributes = {}, content = '') => {
    const element = document.createElement(tag);
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    if (content) element.textContent = content;
    return element;
  }
};

// =====================================================
// DATA MANAGER - Handles all data operations
// =====================================================
class DataManager {
  constructor() {
    this.teamsData = {};
    this.scoreLogs = [];
    this.loadScoreLogs();
  }

  /**
   * Load score logs from storage
   */
  loadScoreLogs() {
    this.scoreLogs = Utils.safeJsonParse(
      sessionStorage.getItem(CONFIG.STORAGE_KEYS.SCORE_LOGS),
      []
    );
  }

  /**
   * Save score logs to storage
   */
  saveScoreLogs() {
    try {
      sessionStorage.setItem(CONFIG.STORAGE_KEYS.SCORE_LOGS, JSON.stringify(this.scoreLogs));
    } catch (e) {
      Utils.showNotification('Failed to save score logs', 'error');
    }
  }

  /**
   * Add new score log
   */
  addScoreLog(logEntry) {
    this.scoreLogs.push(logEntry);
    this.saveScoreLogs();
  }

  /**
   * Update existing score log
   */
  updateScoreLog(scoreID, updates) {
    const index = this.scoreLogs.findIndex(log => log.scoreID === scoreID);
    if (index !== -1) {
      Object.assign(this.scoreLogs[index], updates);
      this.saveScoreLogs();
      return true;
    }
    return false;
  }

  /**
   * Get score log by ID
   */
  getScoreLog(scoreID) {
    return this.scoreLogs.find(log => log.scoreID === scoreID);
  }

  /**
   * Clear all score logs
   */
  clearScoreLogs() {
    this.scoreLogs = [];
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.SCORE_LOGS);
  }

  /**
   * Get teams data
   */
  getTeamsData() {
    return this.teamsData;
  }

  /**
   * Set teams data
   */
  setTeamsData(data) {
    this.teamsData = data || {};
  }
}

// =====================================================
// API MANAGER - Handles all API communications
// =====================================================
class ApiManager {
  constructor() {
    this.baseUrl = CONFIG.API_URL;
  }

  /**
   * Fetch teams data from API
   */
  async fetchTeams() {
    try {
      const response = await fetch(this.baseUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      return data || {};
    } catch (error) {
      console.error("Error fetching teams:", error);
      throw new Error(`Failed to fetch teams: ${error.message}`);
    }
  }

  /**
   * Submit score data to API
   */
  async submitScores(dataToSend) {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSend)
      });

      // Note: no-cors mode means we can't check response status
      // We assume success if no error is thrown
      return true;
    } catch (error) {
      console.error("Error submitting scores:", error);
      throw new Error(`Failed to submit scores: ${error.message}`);
    }
  }
}

// =====================================================
// AUDIO MANAGER - Handles audio functionality
// =====================================================
class AudioManager {
  constructor() {
    this.audioCache = new Map();
  }

  /**
   * Play audio with error handling
   */
  async playAudio(audioFile) {
    try {
      let audio = this.audioCache.get(audioFile);
      
      if (!audio) {
        audio = new Audio(audioFile);
        this.audioCache.set(audioFile, audio);
      }

      // Reset audio to beginning
      audio.currentTime = 0;
      await audio.play();
    } catch (error) {
      console.warn(`Could not play audio ${audioFile}:`, error);
      // Fallback: could use Web Audio API beep or just skip
    }
  }

  /**
   * Play a series of beeps
   */
  async playBeepSequence(count = CONFIG.BEEP_COUNT, interval = CONFIG.BEEP_INTERVAL) {
    for (let i = 0; i < count; i++) {
      await this.playAudio(CONFIG.AUDIO_FILES.BEEP);
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  }
}

// =====================================================
// TIMER MANAGER - Handles timer functionality
// =====================================================
class TimerManager {
  constructor(audioManager) {
    this.audioManager = audioManager;
    this.countdownInterval = null;
    this.isRunning = false;
    this.endTime = 0;
    
    this.loadTimerState();
  }

  /**
   * Load timer state from localStorage
   */
  loadTimerState() {
    const storedEndTime = localStorage.getItem(CONFIG.STORAGE_KEYS.TIMER_END_TIME);
    const storedIsRunning = localStorage.getItem(CONFIG.STORAGE_KEYS.TIMER_RUNNING);

    if (storedEndTime) {
      this.endTime = parseInt(storedEndTime, 10);
    } else {
      this.endTime = Date.now() + (CONFIG.DEFAULT_TIMER_MINUTES * 60 * 1000);
    }

    this.isRunning = (storedIsRunning === 'true');
    this.updateDisplay();

    if (this.isRunning) {
      this.start();
    }
  }

  /**
   * Save timer state to localStorage
   */
  saveTimerState() {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEYS.TIMER_END_TIME, this.endTime.toString());
      localStorage.setItem(CONFIG.STORAGE_KEYS.TIMER_RUNNING, this.isRunning ? 'true' : 'false');
    } catch (e) {
      console.warn('Failed to save timer state:', e);
    }
  }

  /**
   * Get remaining time in seconds
   */
  getTimeRemaining() {
    const now = Date.now();
    return Math.floor((this.endTime - now) / 1000);
  }

  /**
   * Update timer display
   */
  updateDisplay() {
    const countdownSeconds = this.getTimeRemaining();
    const timerDisplay = document.getElementById('timerDisplay');
    
    if (!timerDisplay) return;

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

  /**
   * Start the timer
   */
  start() {
    this.isRunning = true;
    this.updateUI();
    this.saveTimerState();

    // Clear any existing interval
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    this.countdownInterval = setInterval(() => {
      this.updateDisplay();

      if (this.getTimeRemaining() <= 0) {
        this.stop();
        this.audioManager.playBeepSequence();
      }
    }, 1000);
  }

  /**
   * Stop the timer
   */
  stop() {
    this.isRunning = false;
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.updateUI();
    this.saveTimerState();
  }

  /**
   * Toggle timer play/pause
   */
  toggle() {
    if (this.isRunning) {
      this.stop();
      this.audioManager.playAudio(CONFIG.AUDIO_FILES.BEEP);
    } else {
      this.audioManager.playAudio(CONFIG.AUDIO_FILES.BEEP);
      this.start();
    }
  }

  /**
   * Reset timer with new duration
   */
  reset(minutes = CONFIG.DEFAULT_TIMER_MINUTES) {
    this.stop();
    this.endTime = Date.now() + (minutes * 60 * 1000);
    this.saveTimerState();
    this.updateDisplay();
    this.updateUI();
  }

  /**
   * Update timer UI elements
   */
  updateUI() {
    const playPauseBtn = document.getElementById('playPauseBtn');
    const timerColumn = document.getElementById('timerColumn');
    
    if (playPauseBtn) {
      playPauseBtn.textContent = this.isRunning ? "Pause" : "Play";
    }
    
    if (timerColumn) {
      timerColumn.classList.toggle('timer-running', this.isRunning);
      timerColumn.classList.toggle('timer-paused', !this.isRunning);
    }
  }
}

// =====================================================
// LOADING MANAGER - Handles loading animations
// =====================================================
class LoadingManager {
  constructor() {
    this.loadingInterval = null;
  }

  /**
   * Start loading animation
   */
  start() {
    const loadingAnimation = document.getElementById('loadingAnimation');
    const dots = document.getElementById('dots');
    
    if (!loadingAnimation || !dots) return;

    let dotCount = 0;
    loadingAnimation.style.display = 'block';
    
    this.loadingInterval = setInterval(() => {
      dotCount = (dotCount + 1) % 4;
      dots.textContent = '.'.repeat(dotCount);
    }, CONFIG.LOADING_ANIMATION_INTERVAL);
  }

  /**
   * Stop loading animation
   */
  stop() {
    const loadingAnimation = document.getElementById('loadingAnimation');
    const dots = document.getElementById('dots');
    
    if (this.loadingInterval) {
      clearInterval(this.loadingInterval);
      this.loadingInterval = null;
    }
    
    if (loadingAnimation) loadingAnimation.style.display = 'none';
    if (dots) dots.textContent = '';
  }
}

// =====================================================
// MAIN APPLICATION CLASS
// =====================================================
class ScorekeeperApp {
  constructor() {
    // Initialize managers
    this.dataManager = new DataManager();
    this.apiManager = new ApiManager();
    this.audioManager = new AudioManager();
    this.loadingManager = new LoadingManager();
    this.timerManager = new TimerManager(this.audioManager);
    
    // Application state
    this.teamAScore = 0;
    this.teamBScore = 0;
    this.currentEditID = null;
    
    // Bind methods to preserve context
    this.handleTeamChange = this.handleTeamChange.bind(this);
    this.handleSaveScore = this.handleSaveScore.bind(this);
    this.handleSubmitScore = this.handleSubmitScore.bind(this);
    this.handleTimerToggle = this.handleTimerToggle.bind(this);
    this.handleTimerReset = this.handleTimerReset.bind(this);
    this.openPopup = this.openPopup.bind(this);
    this.closePopup = this.closePopup.bind(this);
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      // Set initial time
      const timeInput = document.getElementById('time');
      if (timeInput) {
        timeInput.value = new Date().toLocaleString();
      }

      // Load teams data
      await this.loadTeams();
      
      // Setup event listeners
      this.setupEventListeners();
      
      Utils.showNotification('Application initialized successfully', 'success');
    } catch (error) {
      Utils.showNotification(`Failed to initialize application: ${error.message}`, 'error');
    }
  }

  /**
   * Load teams from API
   */
  async loadTeams() {
    try {
      const teamsData = await this.apiManager.fetchTeams();
      this.dataManager.setTeamsData(teamsData);
      this.populateTeamOptions(teamsData);
    } catch (error) {
      Utils.showNotification(`Failed to load teams: ${error.message}`, 'error');
      // Continue with empty teams data for offline functionality
      this.dataManager.setTeamsData({});
    }
  }

  /**
   * Populate team selection dropdowns
   */
  populateTeamOptions(teams) {
    const teamASelect = document.getElementById('teamA');
    const teamBSelect = document.getElementById('teamB');
    
    if (!teamASelect || !teamBSelect) return;

    // Clear existing options except the first one
    teamASelect.innerHTML = '<option value="">Select Team A</option>';
    teamBSelect.innerHTML = '<option value="">Select Team B</option>';

    const teamNames = Object.keys(teams);
    
    // Create options for both selects
    teamNames.forEach(teamName => {
      const optionA = Utils.createElement('option', { value: teamName }, teamName);
      const optionB = Utils.createElement('option', { value: teamName }, teamName);
      
      teamASelect.appendChild(optionA);
      teamBSelect.appendChild(optionB);
    });
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Team selection change handlers
    const teamASelect = document.getElementById('teamA');
    const teamBSelect = document.getElementById('teamB');
    
    if (teamASelect) {
      teamASelect.addEventListener('change', () => this.handleTeamChange('teamA'));
    }
    if (teamBSelect) {
      teamBSelect.addEventListener('change', () => this.handleTeamChange('teamB'));
    }

    // Timer controls
    const playPauseBtn = document.getElementById('playPauseBtn');
    const resetBtn = document.getElementById('resetBtn');
    
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', this.handleTimerToggle);
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', this.handleTimerReset);
    }

    // Score buttons
    const addScoreTeamA = document.getElementById('addScoreTeamA');
    const addScoreTeamB = document.getElementById('addScoreTeamB');
    
    if (addScoreTeamA) {
      addScoreTeamA.addEventListener('click', () => this.openPopup('A'));
    }
    if (addScoreTeamB) {
      addScoreTeamB.addEventListener('click', () => this.openPopup('B'));
    }

    // Submit button
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.addEventListener('click', this.handleSubmitScore);
    }

    // Popup controls
    const closePopupBtn = document.getElementById('closePopupBtn');
    const popupButton = document.getElementById('popupButton');
    
    if (closePopupBtn) {
      closePopupBtn.addEventListener('click', this.closePopup);
    }
    if (popupButton) {
      popupButton.addEventListener('click', this.handleSaveScore);
    }

    // Close popup when clicking overlay
    const overlay = document.getElementById('overlay');
    if (overlay) {
      overlay.addEventListener('click', this.closePopup);
    }
  }

  /**
   * Handle team selection change
   */
  handleTeamChange(teamID) {
    const selectedTeam = document.getElementById(teamID)?.value;
    const playerListElement = document.getElementById(`${teamID}List`);
    
    if (!selectedTeam || !playerListElement) return;

    const teamsData = this.dataManager.getTeamsData();
    const players = teamsData[selectedTeam] || [];

    playerListElement.value = players.join('\n');
    
    // Auto-resize textarea
    playerListElement.style.height = 'auto';
    playerListElement.style.height = playerListElement.scrollHeight + 'px';
  }

  /**
   * Open score popup
   */
  openPopup(team) {
    this.currentEditID = null;

    const overlay = document.getElementById('overlay');
    const popup = document.getElementById('scorePopup');
    const popupTitle = document.getElementById('popupTitle');
    const popupButton = document.getElementById('popupButton');
    
    if (!overlay || !popup) return;

    // Show popup
    overlay.style.display = 'block';
    popup.style.display = 'block';
    popup.dataset.team = team;

    // Set popup content
    if (popupTitle) popupTitle.textContent = 'Add Score';
    if (popupButton) popupButton.value = 'Add Score';

    this.populatePlayerDropdowns(team);
  }

  /**
   * Populate player dropdowns in score popup
   */
  populatePlayerDropdowns(team) {
    const scorerDropdown = document.getElementById('scorer');
    const assistDropdown = document.getElementById('assist');
    
    if (!scorerDropdown || !assistDropdown) return;

    // Clear existing options
    scorerDropdown.innerHTML = '<option value="">Select Scorer</option>';
    assistDropdown.innerHTML = '<option value="">Select Assist</option>';

    // Get players for the selected team
    const playersText = document.getElementById(
      team === 'A' ? 'teamAList' : 'teamBList'
    )?.value || '';
    
    const players = playersText ? playersText.split('\n').filter(p => p.trim()) : [];

    // Add player options
    players.forEach(player => {
      const trimmedPlayer = player.trim();
      if (trimmedPlayer) {
        scorerDropdown.appendChild(Utils.createElement('option', { value: trimmedPlayer }, trimmedPlayer));
        assistDropdown.appendChild(Utils.createElement('option', { value: trimmedPlayer }, trimmedPlayer));
      }
    });

    // Add special options
    scorerDropdown.appendChild(Utils.createElement('option', { value: SPECIAL_OPTIONS.NA }, SPECIAL_OPTIONS.NA));
    assistDropdown.appendChild(Utils.createElement('option', { value: SPECIAL_OPTIONS.NA }, SPECIAL_OPTIONS.NA));
    assistDropdown.appendChild(Utils.createElement('option', { value: SPECIAL_OPTIONS.CALLAHAN }, SPECIAL_OPTIONS.CALLAHAN));
  }

  /**
   * Handle save score
   */
  handleSaveScore() {
    const popup = document.getElementById('scorePopup');
    const team = popup?.dataset.team;
    const scorer = document.getElementById('scorer')?.value;
    const assist = document.getElementById('assist')?.value;

    if (!team || !scorer || !assist) {
      Utils.showNotification('Please select both scorer and assist.', 'error');
      return;
    }

    if (!this.currentEditID) {
      this.addNewScore(team, scorer, assist);
    } else {
      this.updateExistingScore(scorer, assist);
    }
  }

  /**
   * Add new score
   */
  addNewScore(team, scorer, assist) {
    // Update score
    if (team === 'A') {
      this.teamAScore++;
    } else {
      this.teamBScore++;
    }

    // Create log entry
    const newScoreID = Date.now().toString();
    const logEntry = this.createLogObject(newScoreID, team, scorer, assist);

    // Save to data manager
    this.dataManager.addScoreLog(logEntry);

    // Add to table
    this.addScoreToTable(logEntry);
    
    this.closePopup();
  }

  /**
   * Update existing score
   */
  updateExistingScore(scorer, assist) {
    const updated = this.dataManager.updateScoreLog(this.currentEditID, {
      Score: scorer,
      Assist: assist
    });

    if (updated) {
      this.updateScoreInTable(this.currentEditID, scorer, assist);
      this.closePopup();
    } else {
      Utils.showNotification('Could not find score to update.', 'error');
    }
  }

  /**
   * Create log object
   */
  createLogObject(scoreID, teamLetter, scorer, assist) {
    const teamAName = document.getElementById('teamA')?.value || '';
    const teamBName = document.getElementById('teamB')?.value || '';
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

  /**
   * Add score row to table
   */
  addScoreToTable(logEntry) {
    const scoringTableBody = document.getElementById('scoringTableBody');
    if (!scoringTableBody) return;

    const row = this.createScoreRow(logEntry);
    scoringTableBody.appendChild(row);
  }

  /**
   * Create score table row
   */
  createScoreRow(logEntry) {
    const teamAName = document.getElementById('teamA')?.value || '';
    const teamLetter = (logEntry.Team === teamAName) ? 'A' : 'B';
    const row = document.createElement('tr');

    row.setAttribute('data-score-id', logEntry.scoreID);

    const scoreboard = `${this.teamAScore}:${this.teamBScore}`;

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

    // Add edit functionality
    const editBtn = row.querySelector('.edit-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => this.editScore(logEntry.scoreID));
    }

    return row;
  }

  /**
   * Update score in table
   */
  updateScoreInTable(scoreID, scorer, assist) {
    const row = document.querySelector(`tr[data-score-id="${scoreID}"]`);
    const popup = document.getElementById('scorePopup');
    
    if (!row || !popup) return;

    const teamLetter = popup.dataset.team;
    if (teamLetter === 'A') {
      row.cells[0].textContent = scorer;
      row.cells[1].textContent = assist;
    } else {
      row.cells[3].textContent = scorer;
      row.cells[4].textContent = assist;
    }
  }

  /**
   * Edit existing score
   */
  editScore(scoreID) {
    const logToEdit = this.dataManager.getScoreLog(scoreID);
    if (!logToEdit) {
      Utils.showNotification('Could not find score to edit!', 'error');
      return;
    }

    this.currentEditID = scoreID;

    // Show popup in edit mode
    const overlay = document.getElementById('overlay');
    const popup = document.getElementById('scorePopup');
    const popupTitle = document.getElementById('popupTitle');
    const popupButton = document.getElementById('popupButton');
    
    if (overlay) overlay.style.display = 'block';
    if (popup) popup.style.display = 'block';
    if (popupTitle) popupTitle.textContent = 'Edit Score';
    if (popupButton) popupButton.value = 'Update Score';

    // Determine team
    const teamAName = document.getElementById('teamA')?.value || '';
    const teamLetter = (logToEdit.Team === teamAName) ? 'A' : 'B';
    
    if (popup) popup.dataset.team = teamLetter;

    // Populate dropdowns and set current values
    this.populatePlayerDropdowns(teamLetter);
    
    setTimeout(() => {
      const scorerDropdown = document.getElementById('scorer');
      const assistDropdown = document.getElementById('assist');
      
      if (scorerDropdown) scorerDropdown.value = logToEdit.Score;
      if (assistDropdown) assistDropdown.value = logToEdit.Assist;
    }, 0);
  }

  /**
   * Close popup
   */
  closePopup() {
    const overlay = document.getElementById('overlay');
    const popup = document.getElementById('scorePopup');
    
    if (overlay) overlay.style.display = 'none';
    if (popup) popup.style.display = 'none';
    
    this.currentEditID = null;
  }

  /**
   * Handle timer toggle
   */
  handleTimerToggle() {
    this.timerManager.toggle();
  }

  /**
   * Handle timer reset
   */
  handleTimerReset() {
    const countdownTimeInput = document.getElementById('countdownTime');
    const newTime = parseInt(countdownTimeInput?.value, 10) || CONFIG.DEFAULT_TIMER_MINUTES;
    this.timerManager.reset(newTime);
  }

  /**
   * Handle score submission
   */
  async handleSubmitScore() {
    const scoreLogs = this.dataManager.scoreLogs;
    
    if (scoreLogs.length === 0) {
      Utils.showNotification('No scores have been logged.', 'error');
      return;
    }

    const teamAName = document.getElementById('teamA')?.value || '';
    const teamBName = document.getElementById('teamB')?.value || '';
    const gameID = `${teamAName} vs ${teamBName}`;
    const date = new Date().toLocaleDateString();

    const dataToSend = {
      GameID: gameID,
      Date: date,
      logs: scoreLogs
    };

    try {
      this.loadingManager.start();
      await this.apiManager.submitScores(dataToSend);
      this.loadingManager.stop();
      
      Utils.showNotification('Data has been successfully exported!', 'success');
      this.dataManager.clearScoreLogs();
      
      // Optionally reset scores
      // this.teamAScore = 0;
      // this.teamBScore = 0;
      
    } catch (error) {
      this.loadingManager.stop();
      Utils.showNotification(`Error exporting data: ${error.message}`, 'error');
    }
  }
}

// =====================================================
// APPLICATION INITIALIZATION
// =====================================================
let app;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    app = new ScorekeeperApp();
    await app.init();
  } catch (error) {
    console.error('Failed to initialize application:', error);
    Utils.showNotification('Failed to initialize application. Please refresh the page.', 'error');
  }
});

// Make app instance available globally for debugging
window.ScorekeeperApp = app;