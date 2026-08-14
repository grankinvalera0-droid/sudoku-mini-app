// ========== БЕЗОПАСНОЕ ПОДКЛЮЧЕНИЕ TELEGRAM WEB APP ==========
let tg = null;
if (window.Telegram && window.Telegram.WebApp) {
    tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    // Установка темы Telegram
    document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#1a1a2e');
    document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#ffffff');
    document.documentElement.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color || '#a0a0a0');
}

// Вспомогательная функция для показа сообщений
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
        this.initElements();
        this.initEvents();
        this.showScreen('difficulty-screen');
    }

    initElements() {
        this.screens = {
            'difficulty-screen': document.getElementById('difficulty-screen'),
            'game-screen': document.getElementById('game-screen'),
            'win-screen': document.getElementById('win-screen'),
            'lose-screen': document.getElementById('lose-screen')
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
    }

    initEvents() {
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

        this.hintBtn.addEventListener('click', () => {
            this.showHint();
        });

        this.newBtn.addEventListener('click', () => {
            this.showScreen('difficulty-screen');
        });

        this.playAgainBtn.addEventListener('click', () => {
            this.showScreen('difficulty-screen');
        });

        this.loseRetryBtn.addEventListener('click', () => {
            this.showScreen('difficulty-screen');
        });

        this.boardElement.addEventListener('click', (e) => {
            const cell = e.target.closest('.cell');
            if (!cell) return;
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            this.selectCell(row, col);
        });
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
        } else {
            this.stopTimer();
        }
    }

    startGame(difficulty) {
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
        // Обновляем только число ошибок, а не всю строку
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

        document.getElementById('win-time').textContent = this.timerElement.textContent;
        document.getElementById('win-mistakes').textContent = this.game.mistakes;

        const diffNames = {
            easy: 'Легко',
            medium: 'Средне',
            hard: 'Сложно',
            expert: 'Эксперт'
        };
        document.getElementById('win-difficulty').textContent = diffNames[this.game.difficulty];

        this.showScreen('win-screen');

        if (window.navigator.vibrate) {
            window.navigator.vibrate([100, 50, 100, 50, 200]);
        }
    }

    gameOver() {
        this.stopTimer();

        document.getElementById('lose-time').textContent = this.timerElement.textContent;

        const diffNames = {
            easy: 'Легко',
            medium: 'Средне',
            hard: 'Сложно',
            expert: 'Эксперт'
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
    new App();
});
