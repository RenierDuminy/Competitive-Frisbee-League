/**
 * Reload-Proof Scorekeeping Application
 * Enhanced with comprehensive state persistence
 */

// =====================================================
// CONSTANTS AND CONFIGURATION
// =====================================================
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbwN3aQ8wFzi-2rAYkcEHtHWakliaiO_VBK93iskKFymlNjYb0kLKTRV6VSldTiDIgj-/exec",
  DEFAULT_TIMER_MINUTES: 20,
  LOADING_ANIMATION_INTERVAL: 500,
  BEEP_COUNT: 10,
  BEEP_INTERVAL: 1000,
  AUTO_SAVE_INTERVAL: 2000, // Auto-save every 2 seconds
  STORAGE_KEYS: {
    SCORE_LOGS: 'scoreLogs',
    TIMER_END_TIME: 'timerEndTime',
    TIMER_RUNNING: 'timerRunning',
    GAME_STATE: 'gameState',
    TEAMS_DATA: 'teamsData',
    LAST_SAVE: 'lastSave'
  },
  
  AUDIO_FILES: {
    BEEP: 'REMOVED_FUNCTION'
  }
};

const SPECIAL_OPTIONS = {
  NA: 'N/A',
  CALLAHAN: '‼️CALLAHAN‼️'
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
  },

  /**
   * Generate unique ID
   */
  generateId: () => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }
};

// =====================================================
// PERSISTENCE MANAGER - Handles all data persistence
// =====================================================
class PersistenceManager {
  constructor() {
    this.autoSaveInterval = null;
    this.lastSaveTime = 0;
  }

  /**
   * Save data to localStorage with error handling
   */
  saveToStorage(key, data) {
    try {
      const serializedData = JSON.stringify(data);
      localStorage.setItem(key, serializedData);
      this.lastSaveTime = Date.now();
      localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_SAVE, this.lastSaveTime.toString());
      return true;
    } catch (error) {
      console.error(`Failed to save ${key}:`, error);
      // Try to free up space by removing old data
      this.cleanupOldData();
      try {
        const serializedData = JSON.stringify(data);
        localStorage.setItem(key, serializedData);
        return true;
      } catch (retryError) {
        console.error(`Retry failed for ${key}:`, retryError);
        return false;
      }
    }
  }

  /**
   * Load data from localStorage
   */
  loadFromStorage(key, fallback = null) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (error) {
      console.error(`Failed to load ${key}:`, error);
      return fallback;
    }
  }

  /**
   * Save complete game state
   */
  saveGameState(gameState) {
    return this.saveToStorage(CONFIG.STORAGE_KEYS.GAME_STATE, {
      ...gameState,
      timestamp: Date.now()
    });
  }

  /**
   * Load complete game state
   */
  loadGameState() {
    const defaultState = {
      teamAScore: 0,
      teamBScore: 0,
      teamAName: '',
      teamBName: '',
      teamAPlayers: '',
      teamBPlayers: '',
      gameTime: '',
      scoreLogs: [],
      timestamp: Date.now()
    };

    return this.loadFromStorage(CONFIG.STORAGE_KEYS.GAME_STATE, defaultState);
  }

  /**
   * Save teams data with expiration
   */
  saveTeamsData(teamsData) {
    const dataWithExpiry = {
      data: teamsData,
      timestamp: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };
    return this.saveToStorage(CONFIG.STORAGE_KEYS.TEAMS_DATA, dataWithExpiry);
  }

  /**
   * Load teams data (check expiration)
   */
  loadTeamsData() {
    const storedData = this.loadFromStorage(CONFIG.STORAGE_KEYS.TEAMS_DATA);
    
    if (!storedData) return null;
    
    // Check if data has expired
    if (Date.now() > storedData.expiresAt) {
      localStorage.removeItem(CONFIG.STORAGE_KEYS.TEAMS_DATA);
      return null;
    }
    
    return storedData.data;
  }

  /**
   * Start auto-save functionality
   */
  startAutoSave(saveCallback) {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }

    this.autoSaveInterval = setInterval(() => {
      if (typeof saveCallback === 'function') {
        saveCallback();
      }
    }, CONFIG.AUTO_SAVE_INTERVAL);
  }

  /**
   * Stop auto-save
   */
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * Clean up old data to free space
   */
  cleanupOldData() {
    try {
      // Remove expired teams data
      const teamsData = this.loadFromStorage(CONFIG.STORAGE_KEYS.TEAMS_DATA);
      if (teamsData && Date.now() > teamsData.expiresAt) {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.TEAMS_DATA);
      }

      // Remove very old game states (older than 7 days)
      const gameState = this.loadFromStorage(CONFIG.STORAGE_KEYS.GAME_STATE);
      if (gameState && gameState.timestamp && (Date.now() - gameState.timestamp) > (7 * 24 * 60 * 60 * 1000)) {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.GAME_STATE);
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  /**
   * Get storage usage info
   */
  getStorageInfo() {
    let totalSize = 0;
    let itemCount = 0;

    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalSize += localStorage[key].length;
        itemCount++;
      }
    }

    return {
      totalSize: totalSize,
      itemCount: itemCount,
      lastSave: this.loadFromStorage(CONFIG.STORAGE_KEYS.LAST_SAVE)
    };
  }

  /**
   * Clear all app data
   */
  clearAllData() {
    Object.values(CONFIG.STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    sessionStorage.clear();
  }
}

// =====================================================
// DATA MANAGER - Enhanced with persistence
// =====================================================
class DataManager {
  constructor(persistenceManager) {
    this.persistenceManager = persistenceManager;
    this.teamsData = {};
    this.scoreLogs = [];
    this.gameState = {};
    this.isDirty = false; // Track if data needs saving
    
    this.loadAllData();
  }

  /**
   * Load all persisted data
   */
  loadAllData() {
    // Load game state
    this.gameState = this.persistenceManager.loadGameState();
    this.scoreLogs = this.gameState.scoreLogs || [];
    
    // Load teams data
    const cachedTeamsData = this.persistenceManager.loadTeamsData();
    if (cachedTeamsData) {
      this.teamsData = cachedTeamsData;
    }
  }

  /**
   * Save current state
   */
  saveCurrentState() {
    if (!this.isDirty) return;

    const success = this.persistenceManager.saveGameState(this.gameState);
    if (success) {
      this.isDirty = false;
    }
    return success;
  }

  /**
   * Mark data as dirty (needs saving)
   */
  markDirty() {
    this.isDirty = true;
  }

  /**
   * Update game state
   */
  updateGameState(updates) {
    Object.assign(this.gameState, updates);
    this.markDirty();
  }

  /**
   * Add new score log
   */
  addScoreLog(logEntry) {
    this.scoreLogs.push(logEntry);
    this.gameState.scoreLogs = this.scoreLogs;
    this.markDirty();
  }

  /**
   * Update existing score log
   */
  updateScoreLog(scoreID, updates) {
    const index = this.scoreLogs.findIndex(log => log.scoreID === scoreID);
    if (index !== -1) {
      Object.assign(this.scoreLogs[index], updates);
      this.gameState.scoreLogs = this.scoreLogs;
      this.markDirty();
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
    this.gameState.scoreLogs = [];
    this.markDirty();
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
    this.persistenceManager.saveTeamsData(this.teamsData);
  }

  /**
   * Get current game state
   */
  getGameState() {
    return this.gameState;
  }

  /**
   * Reset game state
   */
  resetGameState() {
    this.gameState = {
      teamAScore: 0,
      teamBScore: 0,
      teamAName: '',
      teamBName: '',
      teamAPlayers: '',
      teamBPlayers: '',
      gameTime: '',
      scoreLogs: [],
      timestamp: Date.now()
    };
    this.scoreLogs = [];
    this.markDirty();
  }
}

// =====================================================
// API MANAGER - Same as before
// =====================================================
class ApiManager {
  constructor() {
    this.baseUrl = CONFIG.API_URL;
  }

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

      return true;
    } catch (error) {
      console.error("Error submitting scores:", error);
      throw new Error(`Failed to submit scores: ${error.message}`);
    }
  }
}

// =====================================================
// AUDIO MANAGER - Same as before
// =====================================================
class AudioManager {
  constructor() {
    this.audioCache = new Map();
  }

  async playAudio(audioFile) {
    try {
      let audio = this.audioCache.get(audioFile);
      
      if (!audio) {
        audio = new Audio(audioFile);
        this.audioCache.set(audioFile, audio);
      }

      audio.currentTime = 0;
      await audio.play();
    } catch (error) {
      console.warn(`Could not play audio ${audioFile}:`, error);
    }
  }

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
// REVAMPED TIMER MANAGER - Simple countdown from future date
// =====================================================
class TimerManager {
  constructor(audioManager, persistenceManager) {
    this.audioManager = audioManager;
    this.persistenceManager = persistenceManager;
    this.timerInterval = null;
    this.isRunning = false;
    this.endTime = null;
    this.remainingTimeMs = null; // Store remaining time when paused
    this.defaultMinutes = CONFIG.DEFAULT_TIMER_MINUTES;
    
    this.preloadAudio();
    this.loadTimerState();
  }

  preloadAudio() {
    // Preload the beep audio file
    try {
      const audio = new Audio(CONFIG.AUDIO_FILES.BEEP);
      audio.preload = 'auto';
      audio.load();
      // Cache it in the audio manager
      this.audioManager.audioCache.set(CONFIG.AUDIO_FILES.BEEP, audio);
    } catch (error) {
      console.warn('Failed to preload timer beep audio:', error);
    }
  }

  /**
   * Get time remaining until endTime
   */
  getTimeRemaining(endtime) {
    const total = Date.parse(endtime) - Date.parse(new Date());
    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    
    return {
      total,
      minutes,
      seconds
    };
  }

  /**
   * Load saved timer state
   */
  loadTimerState() {
    const storedEndTime = this.persistenceManager.loadFromStorage('timerEndTime');
    const storedIsRunning = this.persistenceManager.loadFromStorage(CONFIG.STORAGE_KEYS.TIMER_RUNNING);
    const storedRemainingTime = this.persistenceManager.loadFromStorage('timerRemainingTime');

    if (storedEndTime) {
      this.endTime = new Date(storedEndTime);
    }

    if (storedRemainingTime) {
      this.remainingTimeMs = parseInt(storedRemainingTime, 10);
    }

    this.isRunning = (storedIsRunning === true || storedIsRunning === 'true');

    // Check if timer should still be running
    if (this.isRunning && this.endTime) {
      const timeRemaining = this.getTimeRemaining(this.endTime);
      if (timeRemaining.total <= 0) {
        // Timer expired while away
        this.stop();
        this.updateDisplay();
        this.audioManager.playBeepSequence();
      } else {
        // Resume timer
        this.start();
      }
    } else if (this.remainingTimeMs !== null) {
      // Timer was paused, restore remaining time
      this.setRemainingTime(this.remainingTimeMs);
      this.updateDisplay();
    } else {
      // Initialize with default time if no saved state
      this.reset(this.defaultMinutes);
    }
  }

  /**
   * Save timer state to storage
   */
  saveTimerState() {
    this.persistenceManager.saveToStorage('timerEndTime', this.endTime ? this.endTime.toISOString() : null);
    this.persistenceManager.saveToStorage(CONFIG.STORAGE_KEYS.TIMER_RUNNING, this.isRunning);
    this.persistenceManager.saveToStorage('timerRemainingTime', this.remainingTimeMs);
  }

  /**
   * Set remaining time from milliseconds
   */
  setRemainingTime(milliseconds) {
    this.remainingTimeMs = milliseconds;
    // Set endTime to null when paused to indicate we're using remainingTimeMs
    this.endTime = null;
  }

  /**
   * Update the timer display
   */
  updateDisplay() {
    const timerDisplay = document.getElementById('timerDisplay');
    
    if (!timerDisplay) return;

    let timeRemaining;
    
    if (this.isRunning && this.endTime) {
      // Timer is running, calculate from endTime
      timeRemaining = this.getTimeRemaining(this.endTime);
    } else if (this.remainingTimeMs !== null) {
      // Timer is paused, use stored remaining time
      const total = this.remainingTimeMs;
      const seconds = Math.floor((total / 1000) % 60);
      const minutes = Math.floor((total / 1000 / 60) % 60);
      timeRemaining = { total, minutes, seconds };
    } else {
      // Fallback to default time
      const total = this.defaultMinutes * 60 * 1000;
      const seconds = 0;
      const minutes = this.defaultMinutes;
      timeRemaining = { total, minutes, seconds };
    }

    const absMinutes = Math.abs(timeRemaining.minutes);
    const absSeconds = Math.abs(timeRemaining.seconds);
    
    const mins = absMinutes.toString().padStart(2, '0');
    const secs = absSeconds.toString().padStart(2, '0');

    let timeString = `${mins}:${secs}`;

    if (timeRemaining.total < 0) {
      timeString = `-${timeString}`;
      timerDisplay.classList.add('timer-negative');
    } else {
      timerDisplay.classList.remove('timer-negative');
    }

    timerDisplay.textContent = timeString;
    
    // Update game time field if it exists
    const timeInput = document.getElementById('time');
    if (timeInput) {
      timeInput.value = new Date().toLocaleString();
    }
  }

  /**
   * Start the timer
   */
  start() {
    if (this.isRunning) return;
    
    // If we have remaining time (from pause), set new end time based on it
    if (this.remainingTimeMs !== null) {
      this.endTime = new Date(Date.now() + this.remainingTimeMs);
      this.remainingTimeMs = null; // Clear since we're now running
    }
    
    // If we still don't have an end time, set default
    if (!this.endTime) {
      this.endTime = new Date(Date.now() + (this.defaultMinutes * 60 * 1000));
    }
    
    this.isRunning = true;
    this.updateUI();
    this.saveTimerState();

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    this.timerInterval = setInterval(() => {
      this.updateDisplay();
      
      const timeRemaining = this.getTimeRemaining(this.endTime);
      if (timeRemaining.total <= 0 && this.isRunning) {
        this.stop();
        this.audioManager.playBeepSequence();
      }
    }, 1000);

    // Initial update
    this.updateDisplay();
  }

  /**
   * Stop/Pause the timer
   */
  stop() {
    if (!this.isRunning) return;
    
    // Store remaining time when pausing
    if (this.endTime) {
      const timeRemaining = this.getTimeRemaining(this.endTime);
      this.remainingTimeMs = Math.max(0, timeRemaining.total); // Don't store negative time
    }
    
    this.isRunning = false;
    this.endTime = null; // Clear endTime when paused
    
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    
    this.updateUI();
    this.saveTimerState();
    this.updateDisplay(); // Update display to show paused time
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
   * Reset timer to specified minutes
   */
  reset(minutes = this.defaultMinutes) {
    this.stop();
    
    // Set remaining time and clear endTime
    this.remainingTimeMs = minutes * 60 * 1000;
    this.endTime = null;
    
    this.saveTimerState();
    this.updateDisplay();
    this.updateUI();
  }

  /**
   * Update UI elements
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

  /**
   * Get remaining time in seconds (for debugging/external use)
   */
  getRemainingSeconds() {
    if (this.isRunning && this.endTime) {
      const timeRemaining = this.getTimeRemaining(this.endTime);
      return Math.floor(timeRemaining.total / 1000);
    } else if (this.remainingTimeMs !== null) {
      return Math.floor(this.remainingTimeMs / 1000);
    }
    return 0;
  }
}

// =====================================================
// LOADING MANAGER - Same as before
// =====================================================
class LoadingManager {
  constructor() {
    this.loadingInterval = null;
  }

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
// MAIN APPLICATION CLASS - Enhanced with state restoration
// =====================================================
class ScorekeeperApp {
  constructor() {
    // Initialize managers
    this.persistenceManager = new PersistenceManager();
    this.dataManager = new DataManager(this.persistenceManager);
    this.apiManager = new ApiManager();
    this.audioManager = new AudioManager();
    this.loadingManager = new LoadingManager();
    this.timerManager = new TimerManager(this.audioManager, this.persistenceManager);
    
    // Application state
    this.teamAScore = 0;
    this.teamBScore = 0;
    this.currentEditID = null;
    this.isRestoring = false;
    
    // Bind methods
    this.handleTeamChange = this.handleTeamChange.bind(this);
    this.handleSaveScore = this.handleSaveScore.bind(this);
    this.handleSubmitScore = this.handleSubmitScore.bind(this);
    this.handleTimerToggle = this.handleTimerToggle.bind(this);
    this.handleTimerReset = this.handleTimerReset.bind(this);
    this.openPopup = this.openPopup.bind(this);
    this.closePopup = this.closePopup.bind(this);
    this.autoSave = this.autoSave.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
  }

  /**
   * Initialize the application with state restoration
   */
  async init() {
    try {
      // Set up before unload handler
      window.addEventListener('beforeunload', this.handleBeforeUnload);
      
      // Start auto-save
      this.persistenceManager.startAutoSave(this.autoSave);
      
      // Check if we need to restore state
      await this.checkAndRestoreState();
      
      // Load teams data (from cache or API)
      await this.loadTeams();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Set up page visibility handler for mobile
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.autoSave();
        }
      });
      
      Utils.showNotification('Application initialized successfully', 'success');
    } catch (error) {
      Utils.showNotification(`Failed to initialize application: ${error.message}`, 'error');
    }
  }

  /**
   * Check and restore previous state
   */
  async checkAndRestoreState() {
    const gameState = this.dataManager.getGameState();
    
    // If we have a recent state (less than 24 hours old), restore it
    if (gameState.timestamp && (Date.now() - gameState.timestamp) < (24 * 60 * 60 * 1000)) {
      this.isRestoring = true;
      
      // Show restore notification
      const shouldRestore = confirm(
        'Previous game data found. Would you like to restore your previous session?'
      );
      
      if (shouldRestore) {
        await this.restoreGameState(gameState);
        Utils.showNotification('Previous session restored successfully', 'success');
      } else {
        this.dataManager.resetGameState();
      }
      
      this.isRestoring = false;
    }
  }

  /**
   * Restore complete game state
   */
  async restoreGameState(gameState) {
    // Restore scores
    this.teamAScore = gameState.teamAScore || 0;
    this.teamBScore = gameState.teamBScore || 0;
    
    // Restore team selections
    const teamASelect = document.getElementById('teamA');
    const teamBSelect = document.getElementById('teamB');
    
    if (teamASelect && gameState.teamAName) {
      teamASelect.value = gameState.teamAName;
    }
    if (teamBSelect && gameState.teamBName) {
      teamBSelect.value = gameState.teamBName;
    }
    
    // Restore player lists
    const teamAList = document.getElementById('teamAList');
    const teamBList = document.getElementById('teamBList');
    
    if (teamAList && gameState.teamAPlayers) {
      teamAList.value = gameState.teamAPlayers;
    }
    if (teamBList && gameState.teamBPlayers) {
      teamBList.value = gameState.teamBPlayers;
    }
    
    // Restore game time
    const timeInput = document.getElementById('time');
    if (timeInput && gameState.gameTime) {
      timeInput.value = gameState.gameTime;
    }
    
    // Restore score logs and rebuild table
    if (gameState.scoreLogs && gameState.scoreLogs.length > 0) {
      this.rebuildScoreTable(gameState.scoreLogs);
    }
  }

  /**
   * Rebuild score table from logs
   */
  rebuildScoreTable(scoreLogs) {
    const scoringTableBody = document.getElementById('scoringTableBody');
    if (!scoringTableBody) return;
    
    // Clear existing rows
    scoringTableBody.innerHTML = '';
    
    // Add each score log to table
    scoreLogs.forEach(logEntry => {
      const row = this.createScoreRow(logEntry);
      scoringTableBody.appendChild(row);
    });
  }

  /**
   * Auto-save current state
   */
  autoSave() {
    if (this.isRestoring) return;
    
    // Capture current UI state
    const currentState = {
      teamAScore: this.teamAScore,
      teamBScore: this.teamBScore,
      teamAName: document.getElementById('teamA')?.value || '',
      teamBName: document.getElementById('teamB')?.value || '',
      teamAPlayers: document.getElementById('teamAList')?.value || '',
      teamBPlayers: document.getElementById('teamBList')?.value || '',
      gameTime: document.getElementById('time')?.value || '',
      scoreLogs: this.dataManager.scoreLogs,
      timestamp: Date.now()
    };
    
    this.dataManager.updateGameState(currentState);
    this.dataManager.saveCurrentState();
  }

  /**
   * Handle before page unload
   */
  handleBeforeUnload(event) {
    // Perform final save
    this.autoSave();
    
    // If there's unsaved data, show warning
    if (this.dataManager.isDirty || this.dataManager.scoreLogs.length > 0) {
      const message = 'You have unsaved game data. Are you sure you want to leave?';
      event.returnValue = message;
      return message;
    }
  }

  /**
   * Load teams from API or cache
   */
  async loadTeams() {
    try {
      // Try to load from cache first
      const cachedTeams = this.dataManager.getTeamsData();
      if (cachedTeams && Object.keys(cachedTeams).length > 0) {
        this.populateTeamOptions(cachedTeams);
        
        // Load fresh data in background
        this.loadTeamsFromAPI().catch(error => {
          console.warn('Background team loading failed:', error);
        });
      } else {
        // No cache, load from API
        await this.loadTeamsFromAPI();
      }
    } catch (error) {
      Utils.showNotification(`Failed to load teams: ${error.message}`, 'error');
      this.dataManager.setTeamsData({});
    }
  }

  /**
   * Load teams from API
   */
  async loadTeamsFromAPI() {
    const teamsData = await this.apiManager.fetchTeams();
    this.dataManager.setTeamsData(teamsData);
    this.populateTeamOptions(teamsData);
  }

  /**
   * Populate team selection dropdowns
   */
  populateTeamOptions(teams) {
    const teamASelect = document.getElementById('teamA');
    const teamBSelect = document.getElementById('teamB');
    
    if (!teamASelect || !teamBSelect) return;

    // Store current selections
    const currentTeamA = teamASelect.value;
    const currentTeamB = teamBSelect.value;

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

    // Restore previous selections
    if (currentTeamA) teamASelect.value = currentTeamA;
    if (currentTeamB) teamBSelect.value = currentTeamB;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Team selection change handlers
    const teamASelect = document.getElementById('teamA');
    const teamBSelect = document.getElementById('teamB');
    
    if (teamASelect) {
      teamASelect.addEventListener('change', () => {
        this.handleTeamChange('teamA');
        this.autoSave();
      });
    }
    if (teamBSelect) {
      teamBSelect.addEventListener('change', () => {
        this.handleTeamChange('teamB');
        this.autoSave();
      });
    }

    // Auto-save on input changes
    const autoSaveInputs = ['teamAList', 'teamBList', 'time'];
    autoSaveInputs.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('input', Utils.debounce(this.autoSave, 1000));
      }
    });

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

const noSleep = new NoSleep();

// Enable wake lock (must be triggered by user interaction)
document.getElementById('enableWakelock').addEventListener('click', function() {
  noSleep.enable();
  console.log('Wake lock enabled');
});

// Disable wake lock
function disableWakelock() {
  noSleep.disable();
  console.log('Wake lock disabled');
}

// Make app instance available globally for debugging
window.ScorekeeperApp = app;