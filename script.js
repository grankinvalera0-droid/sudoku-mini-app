// ========== НАСТРОЙКИ ==========
const DEFAULT_SETTINGS = {
    theme: 'light',
    brightness: 100,
    sound: true,
    defaultDifficulty: 'medium'
};

let settings = { ...DEFAULT_SETTINGS };

// Загрузка настроек из localStorage
function loadSettings() {
    const saved = localStorage.getItem('sudoku-settings');
    if (saved) {
        try {
            settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        } catch (e) {
            settings = { ...DEFAULT_SETTINGS };
        }
    }
}

// Сохранение настроек
function saveSettings() {
    localStorage.setItem('sudoku-settings', JSON.stringify(settings));
}

// Применение настроек (тема и яркость)
function applySettings() {
    const root = document.documentElement;
    
    const brightness = settings.brightness / 100;
    const bgColor = settings.theme === 'dark' ? '#1a1a2e' : '#f5f5f7';
    const textColor = settings.theme === 'dark' ? '#ffffff' : '#1a1a2e';
    const hintColor = settings.theme === 'dark' ? '#a0a0a0' : '#666666';
    
    root.style.setProperty('--tg-theme-bg-color', bgColor);
    root.style.setProperty('--tg-theme-text-color', textColor);
    root.style.setProperty('--tg-theme-hint-color', hintColor);
    
    if (settings.brightness !== 100) {
        document.body.style.filter = `brightness(${settings.brightness}%)`;
    } else {
        document.body.style.filter = 'none';
    }
}

// ========== ЗВУКОВОЙ МЕНЕДЖЕР ==========
class SoundManager {
    constructor() {
        this.audioCtx = null;
        this.ambientSource = null;
        this.ambientGain = null;
        this.isPlayingAmbient = false;
    }

    // Инициализация AudioContext (вызывается при первом жесте пользователя)
    initAudio() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    // Воспроизведение звука победы
    playWin() {
        if (!settings.sound) return;
        this.initAudio();
        const ctx = this.audioCtx;
        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.3, now + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.5);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now + i * 0.15);
            osc.stop(now + i * 0.15 + 0.5);
        });
    }

    // Воспроизведение звука поражения
    playLose() {
        if (!settings.sound) return;
        this.initAudio();
        const ctx = this.audioCtx;
        const now = ctx.currentTime;
        const notes = [392, 349.23, 311.13, 261.63]; // G4, F4, Eb4, C4
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.25, now + i * 0.2);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.2 + 0.6);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now + i * 0.2);
            osc.stop(now + i * 0.2 + 0.6);
        });
    }

    // Запуск фонового эмбиента (шум)
    startAmbient() {
        if (!settings.sound || this.isPlayingAmbient) return;
        this.initAudio();
        const ctx = this.audioCtx;

        // Создаём буфер с белым шумом
        const bufferSize = 2 * ctx.sampleRate;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.05; // тихий шум
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const gain = ctx.createGain();
        gain.gain.value = 0.05; // громкость эмбиента

        // Фильтр для смягчения шума
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;

        source.connect(filter).connect(gain).connect(ctx.destination);
        source.start();

        this.ambientSource = source;
        this.ambientGain = gain;
        this.isPlayingAmbient = true;
    }

    // Остановка эмбиента
    stopAmbient() {
        if (this.isPlayingAmbient && this.ambientSource) {
            try {
                this.ambientSource.stop();
            } catch (e) {}
            this.ambientSource = null;
            this.ambientGain = null;
            this.isPlayingAmbient = false;
        }
    }
}

// ========== TELEGRAM WEB APP ==========
let tg = null;
if (window.Telegram && window.Telegram.WebApp) {
    tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
}

function showAlert(message) {
    if (tg && tg.showAlert) {
        tg.showAlert(message);
    } else {
        alert(message);
    }
}

// ========== КЛАСС СУДОКУ ==========
class SudokuGame {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
        this.difficultyMap = {
            easy: 30,
            medium: 40,
            hard: 50,
            expert: 55
        };
        this.cellsToRemove = this.difficultyMap[difficulty];
        this.board = [];
        this.solution = [];
        this.puzzle = [];
        this.selectedCell = null;
        this.mistakes = 0;
        this.maxMistakes = 3;
        this.timerSeconds = 0;
        this.timerInterval = null;
        this.hintsLeft = 3;
        this.generatePuzzle();
    }

    isValid(board, row, col, num) {
        for (let i = 0; i < 9; i++) {
            if (board[row][i] === num || board[i][col] === num) return false;
        }
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (board[boxRow + i][boxCol + j] === num) return false;
            }
        }
        return true;
    }

    fillBoard(board) {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (board[row][col] === 0) {
                    const numbers = this.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
                    for (const num of numbers) {
                        if (this.isValid(board, row, col, num)) {
                            board[row][col] = num;
                            if (this.fillBoard(board)) return true;
                            board[row][col] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    generatePuzzle() {
        this.solution = Array(9).fill().map(() => Array(9).fill(0));
        this.fillBoard(this.solution);
        this.puzzle = this.solution.map(row => [...row]);

        const cells = [];
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                cells.push([i, j]);
            }
        }
        this.shuffle(cells);

        for (let k = 0; k < this.cellsToRemove; k++) {
            const [row, col] = cells[k];
            this.puzzle[row][col] = 0;
        }

        this.board = this.puzzle.map(row => [...row]);
    }

    checkWin() {
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                if (this.board[i][j] !== this.solution[i][j]) return false;
            }
        }
        return true;
    }

    getHint() {
        if (this.hintsLeft <= 0) return null;
        const emptyCells = [];
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                if (this.board[i][j] === 0) {
                    emptyCells.push([i, j]);
                }
            }
        }
        if (emptyCells.length === 0) return null;
        const [row, col] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        this.hintsLeft--;
        return { row, col, value: this.solution[row][col] };
    }
}

// ========== ОСНОВНОЕ ПРИЛОЖЕНИЕ ==========
class App {
    constructor() {
        this.game = null;
        this.soundManager = new SoundManager();
        this.initElements();
        this.initEvents();
        this.applySettingsToUI();
        this.showScreen('difficulty-screen');
    }

    initElements() {
        this.screens = {
            'difficulty-screen': document.getElementById('difficulty-screen'),
            'game-screen': document.getElementById('game-screen'),
            'win-screen': document.getElementById('win-screen'),
            'lose-screen': document.getElementById('lose-screen'),
            'settings-screen': document.getElementById('settings-screen')
        };
        this.boardElement = document.getElementById('board');
        this.timerElement = document.getElementById('timer');
        this.mistakesElement = document.getElementById('mistakes');
        this.difficultyButtons = document.querySelectorAll('.diff-btn');
        this.numButtons = document.querySelectorAll('.num-btn');
        this.hintBtn = document.querySelector('.hint-btn');
        this.newBtn = document.querySelector('.new-btn');
        this.playAgainBtn = document.querySelector('.play-again-btn');
        this.loseRetryBtn = document.querySelector('.lose-retry-btn');
        this.openSettingsBtn = document.getElementById('open-settings');
        this.settingsBackBtn = document.getElementById('settings-back');
        this.resetSettingsBtn = document.getElementById('reset-settings');
        this.themeButtons = document.querySelectorAll('.theme-btn');
        this.brightnessSlider = document.getElementById('brightness-slider');
        this.brightnessValue = document.getElementById('brightness-value');
        this.soundToggle = document.getElementById('sound-toggle');
        this.defaultDifficultySelect = document.getElementById('default-difficulty');
    }

    initEvents() {
        // Существующие события...
        this.difficultyButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const difficulty = btn.dataset.difficulty;
                this.startGame(difficulty);
            });
        });

        this.numButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const num = parseInt(btn.dataset.num);
                this.inputNumber(num);
            });
        });

        this.hintBtn.addEventListener('click', () => this.showHint());
        this.newBtn.addEventListener('click', () => this.showScreen('difficulty-screen'));
        this.playAgainBtn.addEventListener('click', () => this.showScreen('difficulty-screen'));
        this.loseRetryBtn.addEventListener('click', () => this.showScreen('difficulty-screen'));

        this.boardElement.addEventListener('click', (e) => {
            const cell = e.target.closest('.cell');
            if (!cell) return;
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            this.selectCell(row, col);
        });

        // События настроек
        this.openSettingsBtn.addEventListener('click', () => this.showScreen('settings-screen'));
        this.settingsBackBtn.addEventListener('click', () => this.showScreen('difficulty-screen'));

        this.themeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.themeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                settings.theme = btn.dataset.theme;
                this.applySettingsToUI();
                saveSettings();
            });
        });

        this.brightnessSlider.addEventListener('input', () => {
            settings.brightness = parseInt(this.brightnessSlider.value);
            this.brightnessValue.textContent = `${settings.brightness}%`;
            this.applySettingsToUI();
            saveSettings();
        });

        // Обработчик переключателя звука
        this.soundToggle.addEventListener('change', () => {
            settings.sound = this.soundToggle.checked;
            saveSettings();
            this.updateSoundState();
        });

        this.defaultDifficultySelect.addEventListener('change', () => {
            settings.defaultDifficulty = this.defaultDifficultySelect.value;
            saveSettings();
        });

        this.resetSettingsBtn.addEventListener('click', () => {
            settings = { ...DEFAULT_SETTINGS };
            saveSettings();
            this.applySettingsToUI();
            this.updateSoundState();
            showAlert('Настройки сброшены');
        });
    }

    applySettingsToUI() {
        // Применяем тему и яркость
        this.applyThemeAndBrightness();

        // Обновляем активную кнопку темы
        this.themeButtons.forEach(btn => {
            if (btn.dataset.theme === settings.theme) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Обновляем ползунок яркости
        this.brightnessSlider.value = settings.brightness;
        this.brightnessValue.textContent = `${settings.brightness}%`;

        // Обновляем переключатель звука
        this.soundToggle.checked = settings.sound;

        // Обновляем селект сложности
        this.defaultDifficultySelect.value = settings.defaultDifficulty;
    }

    applyThemeAndBrightness() {
        const root = document.documentElement;
        const isDark = settings.theme === 'dark';
        const brightness = settings.brightness / 100;

        const bgColor = isDark ? '#1a1a2e' : '#f5f5f7';
        const textColor = isDark ? '#ffffff' : '#1a1a2e';
        const hintColor = isDark ? '#a0a0a0' : '#666666';

        root.style.setProperty('--tg-theme-bg-color', bgColor);
        root.style.setProperty('--tg-theme-text-color', textColor);
        root.style.setProperty('--tg-theme-hint-color', hintColor);

        if (settings.brightness !== 100) {
            document.body.style.filter = `brightness(${settings.brightness}%)`;
        } else {
            document.body.style.filter = 'none';
        }
    }

    updateSoundState() {
        // Если звук выключен, останавливаем эмбиент
        if (!settings.sound) {
            this.soundManager.stopAmbient();
        } else if (this.isGameActive()) {
            // Если звук включён и игра активна, запускаем эмбиент
            this.soundManager.startAmbient();
        }
    }

    isGameActive() {
        return this.screens['game-screen'] && this.screens['game-screen'].classList.contains('active');
    }

    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => {
            if (screen) screen.classList.remove('active');
        });
        if (this.screens[screenName]) {
            this.screens[screenName].classList.add('active');
        }

        if (screenName === 'game-screen') {
            this.renderBoard();
            this.startTimer();
            // Запускаем эмбиент, если звук включён
            if (settings.sound) {
                this.soundManager.startAmbient();
            }
        } else {
            this.stopTimer();
            // Останавливаем эмбиент на всех экранах, кроме игрового
            this.soundManager.stopAmbient();
        }
    }

    startGame(difficulty) {
        if (!difficulty) {
            difficulty = settings.defaultDifficulty || 'medium';
        }
        this.game = new SudokuGame(difficulty);
        this.game.mistakes = 0;
        this.game.hintsLeft = 3;
        this.game.timerSeconds = 0;
        this.updateStats();
        this.showScreen('game-screen');
    }

    renderBoard() {
        this.boardElement.innerHTML = '';
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;

                const value = this.game.board[row][col];
                const isGiven = this.game.puzzle[row][col] !== 0;

                if (isGiven) {
                    cell.classList.add('given');
                } else if (value !== 0) {
                    cell.classList.add('user-input');
                }

                cell.textContent = value || '';

                if (this.game.selectedCell &&
                    this.game.selectedCell.row === row &&
                    this.game.selectedCell.col === col) {
                    cell.classList.add('selected');
                }

                this.boardElement.appendChild(cell);
            }
        }
    }

    selectCell(row, col) {
        if (this.game.puzzle[row][col] !== 0) return;
        this.game.selectedCell = { row, col };
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('highlighted-row', 'highlighted-col', 'highlighted-box');
        });
        this.renderBoard();
    }

    inputNumber(num) {
        if (!this.game || !this.game.selectedCell) {
            this.shakeElement(document.querySelector('.numpad'));
            return;
        }

        const { row, col } = this.game.selectedCell;
        if (this.game.puzzle[row][col] !== 0) return;

        if (num === 0) {
            this.game.board[row][col] = 0;
        } else {
            if (this.game.solution[row][col] !== num) {
                this.game.mistakes++;
                this.updateStats();
                this.showError(row, col);
                if (this.game.mistakes >= this.game.maxMistakes) {
                    this.gameOver();
                    return;
                }
            }
            this.game.board[row][col] = num;
        }

        this.renderBoard();
        if (this.game.checkWin()) {
            this.showWin();
        }
    }

    showHint() {
        if (!this.game) return;
        const hint = this.game.getHint();
        if (!hint) {
            showAlert('Нет доступных подсказок');
            return;
        }

        this.game.board[hint.row][hint.col] = hint.value;
        this.renderBoard();

        const hintCell = document.querySelector(`[data-row="${hint.row}"][data-col="${hint.col}"]`);
        if (hintCell) {
            hintCell.classList.add('hint');
            setTimeout(() => hintCell.classList.remove('hint'), 500);
        }

        if (this.game.checkWin()) {
            this.showWin();
        }
    }

    showError(row, col) {
        const errorCell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (errorCell) {
            errorCell.classList.add('error');
            setTimeout(() => errorCell.classList.remove('error'), 500);
        }
    }

    updateStats() {
        this.mistakesElement.textContent = this.game.mistakes;
    }

    startTimer() {
        this.stopTimer();
        this.game.timerInterval = setInterval(() => {
            this.game.timerSeconds++;
            const minutes = Math.floor(this.game.timerSeconds / 60);
            const seconds = this.game.timerSeconds % 60;
            this.timerElement.textContent =
                `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }, 1000);
    }

    stopTimer() {
        if (this.game && this.game.timerInterval) {
            clearInterval(this.game.timerInterval);
            this.game.timerInterval = null;
        }
    }

    showWin() {
        this.stopTimer();
        this.soundManager.stopAmbient();
        this.soundManager.playWin();
        document.getElementById('win-time').textContent = this.timerElement.textContent;
        document.getElementById('win-mistakes').textContent = this.game.mistakes;
        const diffNames = {
            easy: 'Легко', medium: 'Средне', hard: 'Сложно', expert: 'Эксперт'
        };
        document.getElementById('win-difficulty').textContent = diffNames[this.game.difficulty];
        this.showScreen('win-screen');
        if (window.navigator.vibrate) {
            window.navigator.vibrate([100, 50, 100, 50, 200]);
        }
    }

    gameOver() {
        this.stopTimer();
        this.soundManager.stopAmbient();
        this.soundManager.playLose();
        document.getElementById('lose-time').textContent = this.timerElement.textContent;
        const diffNames = {
            easy: 'Легко', medium: 'Средне', hard: 'Сложно', expert: 'Эксперт'
        };
        document.getElementById('lose-difficulty').textContent = diffNames[this.game.difficulty];
        this.showScreen('lose-screen');
    }

    shakeElement(element) {
        if (!element) return;
        element.style.animation = 'none';
        element.offsetHeight;
        element.style.animation = 'shake 0.5s ease';
    }
}

// ========== ЗАПУСК ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('Скрипт загружен');
    loadSettings();
    new App();
});
