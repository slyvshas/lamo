// Game state
let board = Array(5).fill().map(() => Array(5).fill(null));
let phase = 1; // 1: Placement, 2: Movement
let goatsToPlace = 20;
let goatsCaptured = 0;
let turn = "goat"; // Starts with goat placing
let selectedPiece = null; // Tracks selected tiger or goat
let moveCount = 0; // Track number of moves
let isPaused = false; // Track if game is paused
let moveHistory = []; // Track move history
let isBotEnabled = false; // Track if bot mode is enabled
let botDifficulty = 'medium'; // Default difficulty
let soundEnabled = true;
let gameStats = {
    gamesPlayed: 0,
    wins: { tiger: 0, goat: 0 },
    bestTime: Infinity,
    currentTime: 0
};
let gameTimer = null;
let gameMode = null;
let selectedDifficulty = null;

// Settings state
let settings = {
    soundEnabled: true,
    darkMode: false,
    animationsEnabled: true,
    botMode: false,
    difficulty: 'medium'
};

// DOM elements
const gameBoard = document.getElementById('game-board');
const statusText = document.getElementById('status');
const capturedGoatsSection = document.getElementById('captured-goats');
const moveSound = document.getElementById('move-sound');
const captureSound = document.getElementById('capture-sound');
const tigerSound = document.getElementById('tigermove-sound');
const winSound = document.getElementById('win-sound');

// Valid connections (adjacent horizontal, vertical, diagonal)
const connections = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],          [0, 1],
    [1, -1],  [1, 0],  [1, 1]
];

// Jump connections (for tiger capturing in Phase 2)
const jumpConnections = [
    [-2, -2], [-2, 0], [-2, 2],
    [0, -2],          [0, 2],
    [2, -2],  [2, 0],  [2, 2]
];

// Initialize board with tigers at corners
function initBoard() {
    board[0][0] = "tiger";
    board[0][4] = "tiger";
    board[4][0] = "tiger";
    board[4][4] = "tiger";
    renderBoard();
}

// Render the game board
function renderBoard() {
    gameBoard.innerHTML = "";
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
            const point = document.createElement("div");
            point.classList.add("point");
            point.dataset.row = i;
            point.dataset.col = j;
            if (board[i][j] === "tiger") point.classList.add("tiger");
            if (board[i][j] === "goat") point.classList.add("goat");
            if (selectedPiece && selectedPiece[0] === i && selectedPiece[1] === j) {
                point.classList.add("selected");
            }
            // Highlight valid moves
            if (selectedPiece && !board[i][j]) {
                const valid = turn === "tiger" ? 
                    isValidTigerMove(selectedPiece[0], selectedPiece[1], i, j).valid : 
                    isValidGoatMove(selectedPiece[0], selectedPiece[1], i, j);
                if (valid) point.style.backgroundColor = "#ffff99"; // Light yellow for valid moves
            }
            point.addEventListener("click", handleClick);
            gameBoard.appendChild(point);
        }
    }
    updateStatus();
}

// Handle click events
function handleClick(event) {
    if (isPaused) return; // Don't process clicks if game is paused
    if (isBotEnabled && turn === "tiger") return; // Prevent player from moving Tigers in bot mode

    const row = parseInt(event.target.dataset.row);
    const col = parseInt(event.target.dataset.col);

    if (phase === 1 && turn === "goat" && !board[row][col] && goatsToPlace > 0) {
        board[row][col] = "goat";
        goatsToPlace--;
        turn = "tiger";
        moveSound.play();
        moveCount++;
        moveHistory.push({ type: 'place', piece: 'goat', row, col });
    } else if (board[row][col] === turn && !selectedPiece) {
        selectedPiece = [row, col];
        highlightValidMoves(row, col);
    } else if (selectedPiece) {
        const moveSuccess = turn === "tiger" ? moveTiger(...selectedPiece, row, col) : moveGoat(...selectedPiece, row, col);
        if (moveSuccess) {
            moveCount++;
            moveHistory.push({
                type: 'move',
                piece: turn,
                from: [...selectedPiece],
                to: [row, col]
            });
            selectedPiece = null;
            turn = turn === "tiger" ? "goat" : "tiger";
            if (phase === 1 && goatsToPlace === 0) phase = 2;
            checkWinConditions();
        }
    }
    renderBoard();
    updateGameStats();

    // If bot is enabled and it's the bot's turn, make a move after a delay
    if (isBotEnabled && turn === "tiger") {
        setTimeout(botMove, 1000);
    }
}

// Highlight valid moves for a selected piece
function highlightValidMoves(row, col) {
    const points = document.querySelectorAll('.point');
    points.forEach(point => {
        const targetRow = parseInt(point.dataset.row);
        const targetCol = parseInt(point.dataset.col);
        if (!board[targetRow][targetCol]) {
            const valid = turn === "tiger" ? 
                isValidTigerMove(row, col, targetRow, targetCol).valid : 
                isValidGoatMove(row, col, targetRow, targetCol);
            if (valid) {
                point.style.backgroundColor = "#ffff99";
                point.style.transition = "background-color 0.3s ease";
            }
        }
    });
}

// Update game statistics
function updateGameStats() {
    const stats = {
        moves: moveCount,
        phase: phase,
        goatsPlaced: 20 - goatsToPlace,
        goatsCaptured: goatsCaptured,
        currentTurn: turn
    };
    
    // Update status display with more information
    statusText.innerHTML = `
        <div>Phase ${phase}: ${phase === 1 ? 'Place Goats' : 'Move Pieces'}</div>
        <div>Moves: ${moveCount} | Goats Captured: ${goatsCaptured}</div>
        <div>${turn === "goat" ? "🐐 Goat's Turn" : "🐅 Tiger's Turn"}</div>
    `;
}

// Bot logic
function botMove() {
    if (!isBotEnabled || turn !== "tiger" || isPaused) return;
    
    // Show thinking indicator
    const status = document.getElementById('status');
    status.innerHTML += '<div class="thinking">🤔 Bot is thinking...</div>';
    
    setTimeout(() => {
        // Remove thinking indicator
        status.querySelector('.thinking')?.remove();
        
        // Find all possible moves for Tigers
        const possibleMoves = [];
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                if (board[i][j] === "tiger") {
                    // Check capture moves first
                    for (let [dr, dc] of jumpConnections) {
                        const newRow = i + dr;
                        const newCol = j + dc;
                        const midRow = i + dr / 2;
                        const midCol = j + dc / 2;
                        if (newRow >= 0 && newRow < 5 && newCol >= 0 && newCol < 5 && 
                            board[midRow][midCol] === "goat" && !board[newRow][newCol]) {
                            possibleMoves.push({ 
                                from: [i, j], 
                                to: [newRow, newCol], 
                                isCapture: true,
                                score: 100 // Highest priority for captures
                            });
                        }
                    }
                    // Check regular moves
                    for (let [dr, dc] of connections) {
                        const newRow = i + dr;
                        const newCol = j + dc;
                        if (newRow >= 0 && newRow < 5 && newCol >= 0 && newCol < 5 && !board[newRow][newCol]) {
                            possibleMoves.push({ 
                                from: [i, j], 
                                to: [newRow, newCol], 
                                isCapture: false,
                                score: evaluateMove(i, j, newRow, newCol)
                            });
                        }
                    }
                }
            }
        }

        // Sort moves by score
        possibleMoves.sort((a, b) => b.score - a.score);

        // Select the best move based on difficulty
        let selectedMove;
        if (possibleMoves.length > 0) {
            switch (botDifficulty) {
                case 'easy':
                    selectedMove = possibleMoves[Math.floor(Math.random() * Math.max(1, Math.floor(possibleMoves.length * 0.9)))];
                    break;
                case 'medium':
                    selectedMove = possibleMoves[Math.floor(Math.random() * Math.max(1, Math.floor(possibleMoves.length * 0.6)))];
                    break;
                case 'hard':
                    selectedMove = possibleMoves[0]; // Always pick the best move
                    break;
            }

            // Execute the selected move
            if (selectedMove) {
                const success = moveTiger(selectedMove.from[0], selectedMove.from[1], selectedMove.to[0], selectedMove.to[1]);
                if (success) {
                    turn = "goat";
                    renderBoard();
                    checkWinConditions();
                    return;
                }
            }
        }

        // If no moves are possible or move failed, pass the turn
        turn = "goat";
        renderBoard();
        checkWinConditions();
    }, 500);
}

// Find positions of other tigers
function findOtherTigers(row, col) {
    const positions = [];
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
            if (board[i][j] === "tiger" && (i !== row || j !== col)) {
                positions.push([i, j]);
            }
        }
    }
    return positions;
}

// Check if a tiger would be trapped at a position
function isTigerTrapped(row, col) {
    return ![...connections, ...jumpConnections].some(([dr, dc]) => {
        const newRow = row + dr;
        const newCol = col + dc;
        return newRow >= 0 && newRow < 5 && newCol >= 0 && newCol < 5 && 
               isValidTigerMove(row, col, newRow, newCol).valid;
    });
}

// Move tiger function
function moveTiger(fromRow, fromCol, toRow, toCol) {
    const { valid, isJump } = isValidTigerMove(fromRow, fromCol, toRow, toCol);
    if (!valid) return false;
    board[toRow][toCol] = "tiger";
    board[fromRow][fromCol] = null;

    if (isJump) {
        board[(fromRow + toRow) / 2][(fromCol + toCol) / 2] = null;
        addCapturedGoat(); // This function already increments goatsCaptured
        captureSound.play(); // Play capture sound 
    } else {
        tigerSound.play(); // Play move sound
    }
    return true;
} 

// Move a goat
function moveGoat(fromRow, fromCol, toRow, toCol) {
    if (!isValidGoatMove(fromRow, fromCol, toRow, toCol)) return false;
    board[fromRow][fromCol] = null;
    board[toRow][toCol] = "goat";
    return true;
}

// Check if tiger move is valid
function isValidTigerMove(fromRow, fromCol, toRow, toCol) {
    if (board[toRow]?.[toCol]) return { valid: false, isJump: false };
    for (let [dr, dc] of connections) {
        if (fromRow + dr === toRow && fromCol + dc === toCol) return { valid: true, isJump: false };
    }
    for (let [dr, dc] of jumpConnections) {
        const midRow = fromRow + dr / 2;
        const midCol = fromCol + dc / 2;
        if (fromRow + dr === toRow && fromCol + dc === toCol && board[midRow]?.[midCol] === "goat") {
            return { valid: true, isJump: true };
        }
    }
    return { valid: false, isJump: false };
}

// Check if goat move is valid
function isValidGoatMove(fromRow, fromCol, toRow, toCol) {
    return !board[toRow]?.[toCol] && connections.some(([dr, dc]) => fromRow + dr === toRow && fromCol + dc === toCol);
}

// Update and display the game status
function updateStatus() {
    const turnIcon = document.getElementById('turn-icon');
    const turnText = document.getElementById('turn-text');
    const turnIndicator = document.getElementById('turn-indicator');
   
    const scoreText = `Goats Captured: ${goatsCaptured} | Goats Remaining: ${goatsToPlace}`;
    statusText.textContent = `${scoreText}`;

    // Update turn indicator
    turnIcon.textContent = turn === "goat" ? "🐐" : "🐅";
    turnText.textContent = turn === "goat" ? "Goat's Turn" : "Tiger's Turn";

    // Add turn change animation
    turnIndicator.classList.add('turn-changed');
    setTimeout(() => {
        turnIndicator.classList.remove('turn-changed');
    }, 500);
}

// Add a captured goat to the UI
function addCapturedGoat() {
    const goat = document.createElement('div');
    goat.classList.add('goat');

    // Alternate between left and right based on the current turn
    if (turn === "tiger") {
        document.getElementById('captured-goats-left').appendChild(goat);
    } else {
        document.getElementById('captured-goats-right').appendChild(goat);
    }

    goatsCaptured++;
    updateStatus();
}

// Check win conditions
function checkWinConditions() {
    if (goatsCaptured >= 5) {
        showGameOver("tiger"); // 🐯 Tigers win
        return;
    }

    const tigerPositions = [];
    board.forEach((row, i) => 
        row.forEach((cell, j) => {
            if (cell === "tiger") tigerPositions.push([i, j]);
        })
    );

    const allTigersTrapped = tigerPositions.every(([r, c]) => 
        ![...connections, ...jumpConnections].some(([dr, dc]) => {
            const newRow = r + dr;
            const newCol = c + dc;
            return newRow >= 0 && newRow < 5 && newCol >= 0 && newCol < 5 && 
                   isValidTigerMove(r, c, newRow, newCol).valid;
        })
    );

    if (allTigersTrapped) {
        showGameOver("goat"); // 🐐 Goats win
    }
}

// Toggle bot mode
function toggleBotMode() {
    const confirmMessage = isBotEnabled 
        ? "Are you sure you want to switch to Human vs Human mode? This will reset the current game."
        : "Are you sure you want to switch to Human vs Bot mode? This will reset the current game.";
    
    if (confirm(confirmMessage)) {
        isBotEnabled = !isBotEnabled;
        settings.botMode = isBotEnabled;
        
        // Update UI
        const botModeBtn = document.getElementById('bot-mode-btn');
        botModeBtn.textContent = isBotEnabled ? "Switch to Human vs Human" : "Switch to Human vs Bot";
        botModeBtn.style.backgroundColor = isBotEnabled ? '#ff4444' : '#4CAF50';
        
        // Show/hide difficulty selector
        const difficultySelector = document.getElementById('difficulty-selector');
        difficultySelector.style.display = isBotEnabled ? 'block' : 'none';
        
        // Reset the game
        resetGame();
        
        // If switching to bot mode and it's tiger's turn, make bot move after a delay
        if (isBotEnabled && turn === "tiger") {
            setTimeout(botMove, 1000);
        }
        
        // Save settings
        localStorage.setItem('baghchal_settings', JSON.stringify(settings));
    }
}

// Set difficulty level
function setDifficulty() {
    const difficultySelect = document.getElementById('difficulty-level');
    botDifficulty = difficultySelect.value;
    settings.difficulty = botDifficulty;
    console.log('Difficulty set to:', botDifficulty);
    localStorage.setItem('baghchal_settings', JSON.stringify(settings));
}

// Reset the game
function resetGame() {
    stopTimer();
    gameStats.currentTime = 0;
    updateTimerDisplay();
    
    // Reset game state
    board = Array(5).fill().map(() => Array(5).fill(null));
    phase = 1;
    goatsToPlace = 20;
    goatsCaptured = 0;
    turn = "goat";
    selectedPiece = null;
    moveCount = 0;
    isPaused = false;
    moveHistory = [];

    // Hide Game Over Modal
    document.getElementById("game-over-modal").style.display = "none";

    // Reset status text
    document.getElementById("status").innerHTML = `
        <div>Phase 1: Place Goats</div>
        <div>Moves: 0 | Goats Captured: 0</div>
        <div>🐐 Goat's Turn</div>
    `;

    // Reset captured goats display
    document.getElementById("captured-goats-left").innerHTML = "";

    // Reinitialize the board
    initBoard();
    
    // Update game mode indicator
    updateGameModeIndicator();

    // Update difficulty selector visibility
    const difficultySelector = document.getElementById('difficulty-selector');
    if (difficultySelector) {
        difficultySelector.style.display = isBotEnabled ? 'block' : 'none';
    }

    // Start new timer
    startTimer();
}

// Add function to update game mode indicator
function updateGameModeIndicator() {
    const modeText = isBotEnabled ? "Mode: Human vs Bot" : "Mode: Human vs Human";
    const modeColor = isBotEnabled ? '#ff4444' : '#4CAF50';
    
    // Update or create mode indicator
    let modeIndicator = document.getElementById('mode-indicator');
    if (!modeIndicator) {
        modeIndicator = document.createElement('div');
        modeIndicator.id = 'mode-indicator';
        document.getElementById('header').insertBefore(modeIndicator, document.getElementById('score-container'));
    }
    
    modeIndicator.textContent = modeText;
    modeIndicator.style.color = modeColor;
    modeIndicator.style.fontWeight = 'bold';
    modeIndicator.style.marginBottom = '10px';
}

// Add pause functionality
function togglePause() {
    isPaused = !isPaused;
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
        pauseBtn.textContent = isPaused ? 'Resume Game' : 'Pause Game';
        pauseBtn.style.backgroundColor = isPaused ? '#ff4444' : '#4CAF50';
    }
}

// Add undo move functionality
function undoMove() {
    if (moveHistory.length === 0 || isPaused) return;
    
    const lastMove = moveHistory.pop();
    if (lastMove.type === 'place') {
        board[lastMove.row][lastMove.col] = null;
        goatsToPlace++;
        turn = "goat";
    } else {
        const [fromRow, fromCol] = lastMove.from;
        const [toRow, toCol] = lastMove.to;
        board[fromRow][fromCol] = lastMove.piece;
        board[toRow][toCol] = null;
        turn = lastMove.piece;
    }
    
    moveCount--;
    renderBoard();
    updateGameStats();
}

// Show game rules modal
function showGameRules() {
    const modal = document.getElementById('game-rules-modal');
    modal.style.display = 'block';
    document.body.classList.add('modal-open'); // Prevent background scrolling
}

// Close game rules modal
function closeGameRules() {
    const modal = document.getElementById('game-rules-modal');
    modal.style.display = 'none';
    document.body.classList.remove('modal-open'); // Restore background scrolling
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('game-rules-modal');
    if (event.target === modal) {
        closeGameRules();
    }
}

// Add sound toggle functionality
function toggleSound() {
    soundEnabled = !soundEnabled;
    const soundBtn = document.getElementById('sound-toggle');
    if (soundBtn) {
        soundBtn.classList.toggle('sound-enabled');
        soundBtn.textContent = soundEnabled ? '🔊 Sound On' : '🔈 Sound Off';
    }
}

// Add timer functionality
function startTimer() {
    gameTimer = setInterval(() => {
        gameStats.currentTime++;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(gameStats.currentTime / 60);
    const seconds = gameStats.currentTime % 60;
    const timerDisplay = document.getElementById('timer');
    if (timerDisplay) {
        timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Enhance move handling with animations
function handleMove(fromRow, fromCol, toRow, toCol, isCapture = false) {
    const fromPoint = document.querySelector(`[data-row="${fromRow}"][data-col="${fromCol}"]`);
    const toPoint = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
    
    if (fromPoint && toPoint) {
        const piece = fromPoint.querySelector('.tiger, .goat');
        if (piece) {
            // Add move animation
            piece.style.transform = 'scale(1.1)';
            setTimeout(() => {
                piece.style.transform = 'scale(1)';
            }, 300);
            
            // Add capture animation if applicable
            if (isCapture) {
                const capturedPiece = document.querySelector(`[data-row="${(fromRow + toRow) / 2}"][data-col="${(fromCol + toCol) / 2}"] .goat`);
                if (capturedPiece) {
                    capturedPiece.classList.add('captured');
                }
            }
        }
    }
}

// Add helper function to format time
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Add keyboard shortcuts
document.addEventListener('keydown', (event) => {
    if (event.key === 'p' || event.key === 'P') {
        togglePause();
    } else if (event.key === 'u' || event.key === 'U') {
        undoMove();
    } else if (event.key === 's' || event.key === 'S') {
        toggleSound();
    } else if (event.key === 'r' || event.key === 'R') {
        resetGame();
    }
});

// Add these functions for game setup
function selectGameMode(mode) {
    gameMode = mode;
    isBotEnabled = mode === 'bot';
    
    // Update UI
    const modeButtons = document.querySelectorAll('.mode-btn');
    modeButtons.forEach(btn => {
        btn.style.borderColor = btn.textContent.includes(mode === 'human' ? 'Human vs Human' : 'Human vs Bot') 
            ? '#4CAF50' 
            : '#ddd';
    });
    
    // Show/hide difficulty selection
    const difficultySelection = document.getElementById('difficulty-selection');
    if (difficultySelection) {
        difficultySelection.style.display = mode === 'bot' ? 'block' : 'none';
    }
    
    // If human vs human, start game immediately
    if (mode === 'human') {
        startGame();
    }
}

function selectDifficulty(difficulty) {
    selectedDifficulty = difficulty;
    botDifficulty = difficulty;
    
    // Update UI
    const difficultyButtons = document.querySelectorAll('.difficulty-btn');
    difficultyButtons.forEach(btn => {
        btn.style.borderColor = btn.textContent.includes(difficulty) 
            ? '#4CAF50' 
            : '#ddd';
    });
    
    // Start game after a short delay
    setTimeout(startGame, 500);
}

function startGame() {
    // Hide setup modal
    const setupModal = document.getElementById('game-setup-modal');
    if (setupModal) {
        setupModal.style.display = 'none';
    }
    
    // Show game elements
    const gameWrapper = document.getElementById('game-wrapper');
    const header = document.getElementById('header');
    if (gameWrapper) gameWrapper.style.display = 'flex';
    if (header) header.style.display = 'flex';
    
    // Update UI based on game mode
    const botModeBtn = document.getElementById('bot-mode-btn');
    const difficultySelector = document.getElementById('difficulty-selector');
    
    if (botModeBtn) {
        botModeBtn.textContent = isBotEnabled ? "Switch to Human vs Human" : "Switch to Human vs Bot";
        botModeBtn.style.backgroundColor = isBotEnabled ? '#ff4444' : '#4CAF50';
    }
    
    if (difficultySelector) {
        difficultySelector.style.display = isBotEnabled ? 'block' : 'none';
    }
    
    // Initialize game
    initBoard();
    startTimer();
    updateGameModeIndicator();
    
    // Save settings
    settings.botMode = isBotEnabled;
    settings.difficulty = botDifficulty;
    localStorage.setItem('baghchal_settings', JSON.stringify(settings));
}

// Add loadSettings function
function loadSettings() {
    const savedSettings = localStorage.getItem('baghchal_settings');
    if (savedSettings) {
        try {
            settings = JSON.parse(savedSettings);
            // Apply settings
            isBotEnabled = settings.botMode;
            botDifficulty = settings.difficulty || 'medium';
            soundEnabled = settings.soundEnabled !== false;
            
            // Update UI elements
            const botModeBtn = document.getElementById('bot-mode-btn');
            const difficultySelector = document.getElementById('difficulty-selector');
            const difficultySelect = document.getElementById('difficulty-level');
            
            if (botModeBtn) {
                botModeBtn.textContent = isBotEnabled ? "Switch to Human vs Human" : "Switch to Human vs Bot";
                botModeBtn.style.backgroundColor = isBotEnabled ? '#ff4444' : '#4CAF50';
            }
            
            if (difficultySelector) {
                difficultySelector.style.display = isBotEnabled ? 'block' : 'none';
            }
            
            if (difficultySelect) {
                difficultySelect.value = botDifficulty;
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            // Reset to default settings if there's an error
            settings = {
                soundEnabled: true,
                darkMode: false,
                animationsEnabled: true,
                botMode: false,
                difficulty: 'medium'
            };
        }
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Show setup modal
    const setupModal = document.getElementById('game-setup-modal');
    if (setupModal) {
        setupModal.style.display = 'flex';
    }
    
    // Hide game elements until setup is complete
    const gameWrapper = document.getElementById('game-wrapper');
    const header = document.getElementById('header');
    if (gameWrapper) gameWrapper.style.display = 'none';
    if (header) header.style.display = 'none';
    
    // Load saved settings but don't auto-start
    loadSettings();
});

// Show settings modal
function showSettings() {
    const modal = document.getElementById('settings-modal');
    modal.style.display = 'flex';
    updateSettingsUI();
}

// Close settings modal
function closeSettings() {
    const modal = document.getElementById('settings-modal');
    modal.style.display = 'none';
}

// Update settings UI
function updateSettingsUI() {
    // Update sound toggle
    const soundBtn = document.getElementById('sound-toggle') || document.getElementById('settings-sound-toggle');
    if (soundBtn) {
        soundBtn.innerHTML = `<span>🔊</span> ${settings.soundEnabled ? 'On' : 'Off'}`;
        soundBtn.classList.toggle('active', settings.soundEnabled);
    }

    // Update dark mode toggle
    const darkModeBtn = document.getElementById('dark-mode-toggle') || document.getElementById('settings-dark-mode-toggle');
    if (darkModeBtn) {
        darkModeBtn.innerHTML = `<span>${settings.darkMode ? '☀️' : '🌙'}</span> ${settings.darkMode ? 'On' : 'Off'}`;
        darkModeBtn.classList.toggle('active', settings.darkMode);
    }

    // Update animations toggle
    const animationsBtn = document.getElementById('animations-toggle') || document.getElementById('settings-animations-toggle');
    if (animationsBtn) {
        animationsBtn.innerHTML = `<span>✨</span> ${settings.animationsEnabled ? 'On' : 'Off'}`;
        animationsBtn.classList.toggle('active', settings.animationsEnabled);
    }

    // Update bot mode toggle
    const botModeBtn = document.getElementById('bot-mode-btn') || document.getElementById('settings-bot-mode-btn');
    if (botModeBtn) {
        botModeBtn.innerHTML = `<span>🤖</span> ${settings.botMode ? 'On' : 'Off'}`;
        botModeBtn.classList.toggle('active', settings.botMode);
    }

    // Update difficulty selector
    const difficultySelector = document.getElementById('difficulty-level') || document.getElementById('settings-difficulty-level');
    if (difficultySelector) {
        difficultySelector.value = settings.difficulty;
    }

    // Show/hide difficulty setting based on bot mode
    const difficultySetting = document.getElementById('difficulty-setting');
    if (difficultySetting) {
        difficultySetting.style.display = settings.botMode ? 'flex' : 'none';
    }
}

// Toggle sound
function toggleSound() {
    settings.soundEnabled = !settings.soundEnabled;
    updateSettingsUI();
    // Save to localStorage
    localStorage.setItem('baghchal_settings', JSON.stringify(settings));
}

// Toggle dark mode
function toggleDarkMode() {
    settings.darkMode = !settings.darkMode;
    document.body.classList.toggle('dark-mode', settings.darkMode);
    updateSettingsUI();
    localStorage.setItem('baghchal_settings', JSON.stringify(settings));
}

// Toggle animations
function toggleAnimations() {
    settings.animationsEnabled = !settings.animationsEnabled;
    document.body.classList.toggle('no-animations', !settings.animationsEnabled);
    updateSettingsUI();
    localStorage.setItem('baghchal_settings', JSON.stringify(settings));
}

// Function to safely play sound
function playSound(soundElement) {
    if (soundEnabled && soundElement) {
        soundElement.play().catch(error => {
            console.log('Sound playback failed:', error);
            // If win sound is missing, try playing a different sound
            if (soundElement.id === 'win-sound') {
                playSound(document.getElementById('move-sound'));
            }
        });
    }
}

// Helper function to check if a position is a key strategic position
function isKeyPosition(row, col) {
    // Center positions are key
    if (row === 2 && col === 2) return true;
    
    // Positions that control multiple directions
    const emptySpaces = countNearbyEmptySpaces(row, col);
    if (emptySpaces >= 5) return true;
    
    // Positions that can help trap goats
    const nearbyGoats = countNearbyGoats(row, col);
    if (nearbyGoats >= 2) return true;
    
    return false;
}

// Helper function to check if a move can create multiple capture opportunities
function canCreateMultipleCaptures(fromRow, fromCol, toRow, toCol) {
    let captureCount = 0;
    // Check all possible capture directions after the move
    for (let [dr, dc] of jumpConnections) {
        const newRow = toRow + dr;
        const newCol = toCol + dc;
        const midRow = toRow + dr / 2;
        const midCol = toCol + dc / 2;
        if (newRow >= 0 && newRow < 5 && newCol >= 0 && newCol < 5 && 
            board[midRow][midCol] === "goat" && !board[newRow][newCol]) {
            captureCount++;
        }
    }
    return captureCount >= 2;
}

// Helper function to check if a move can trap a goat
function canTrapGoat(fromRow, fromCol, toRow, toCol) {
    // Check if this move would trap any nearby goats
    for (let [dr, dc] of connections) {
        const newRow = toRow + dr;
        const newCol = toCol + dc;
        if (newRow >= 0 && newRow < 5 && newCol >= 0 && newCol < 5 && 
            board[newRow][newCol] === "goat") {
            // Count escape routes before and after the move
            const beforeEscapeRoutes = countNearbyEmptySpaces(newRow, newCol);
            // Simulate the move
            const originalPiece = board[toRow][toCol];
            board[fromRow][fromCol] = null;
            board[toRow][toCol] = "tiger";
            const afterEscapeRoutes = countNearbyEmptySpaces(newRow, newCol);
            // Restore the board
            board[fromRow][fromCol] = "tiger";
            board[toRow][toCol] = originalPiece;
            
            // If the move reduces escape routes, it's a trapping move
            if (afterEscapeRoutes < beforeEscapeRoutes) {
                return true;
            }
        }
    }
    return false;
}

// Helper function to count nearby goats
function countNearbyGoats(row, col) {
    let count = 0;
    for (let [dr, dc] of connections) {
        const newRow = row + dr;
        const newCol = col + dc;
        if (newRow >= 0 && newRow < 5 && newCol >= 0 && newCol < 5 && 
            board[newRow][newCol] === "goat") {
            count++;
        }
    }
    return count;
}

// Helper function to evaluate goat trapping potential
function evaluateGoatTrapping(row, col) {
    let score = 0;
    const nearbyGoats = countNearbyGoats(row, col);
    
    // Check if this position helps trap goats
    for (let [dr, dc] of connections) {
        const newRow = row + dr;
        const newCol = col + dc;
        if (newRow >= 0 && newRow < 5 && newCol >= 0 && newCol < 5 && 
            board[newRow][newCol] === "goat") {
            // Count how many escape routes the goat has
            const goatEscapeRoutes = countNearbyEmptySpaces(newRow, newCol);
            if (goatEscapeRoutes <= 2) score += 3; // Goat is partially trapped
            if (goatEscapeRoutes <= 1) score += 5; // Goat is mostly trapped
            if (goatEscapeRoutes === 0) score += 10; // Goat is completely trapped
        }
    }
    
    return score;
}

// Helper function to count empty spaces around a position
function countNearbyEmptySpaces(row, col) {
    let count = 0;
    for (let [dr, dc] of connections) {
        const newRow = row + dr;
        const newCol = col + dc;
        if (newRow >= 0 && newRow < 5 && newCol >= 0 && newCol < 5 && 
            !board[newRow][newCol]) {
            count++;
        }
    }
    return count;
}

// Add the missing canCaptureAfterMove function
function canCaptureAfterMove(fromRow, fromCol, toRow, toCol) {
    // Simulate the move
    const originalPiece = board[toRow][toCol];
    board[fromRow][fromCol] = null;
    board[toRow][toCol] = "tiger";
    
    // Check if any captures are possible from the new position
    let canCapture = false;
    for (let [dr, dc] of jumpConnections) {
        const newRow = toRow + dr;
        const newCol = toCol + dc;
        const midRow = toRow + dr / 2;
        const midCol = toCol + dc / 2;
        if (newRow >= 0 && newRow < 5 && newCol >= 0 && newCol < 5 && 
            board[midRow][midCol] === "goat" && !board[newRow][newCol]) {
            canCapture = true;
            break;
        }
    }
    
    // Restore the board
    board[fromRow][fromCol] = "tiger";
    board[toRow][toCol] = originalPiece;
    
    return canCapture;
}

function evaluateMove(fromRow, fromCol, toRow, toCol) {
    let score = 0;
    
    // Check if move is a capture
    const isCapture = Math.abs(toRow - fromRow) === 2 || Math.abs(toCol - fromCol) === 2;
    if (isCapture) {
        score += 20; // High score for captures
    }
    
    // Evaluate distance to other tigers
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
            if (board[i][j] === "tiger" && (i !== fromRow || j !== fromCol)) {
                const distance = Math.abs(toRow - i) + Math.abs(toCol - j);
                score += (5 - distance) * 2; // Closer to other tigers is better
            }
        }
    }
    
    // Evaluate center control
    const centerDistance = Math.abs(toRow - 2) + Math.abs(toCol - 2);
    score += (4 - centerDistance) * 3; // Being closer to center is better
    
    // Evaluate trap avoidance
    let trapScore = 0;
    for (let [dr, dc] of connections) {
        const newRow = toRow + dr;
        const newCol = toCol + dc;
        if (newRow >= 0 && newRow < 5 && newCol >= 0 && newCol < 5) {
            if (board[newRow][newCol] === "goat") {
                trapScore += 2; // Being near goats is good for trapping
            }
        }
    }
    score += trapScore;
    
    // Add some randomness based on difficulty
    const randomFactor = {
        'easy': 0.5,
        'medium': 0.3,
        'hard': 0.1
    }[botDifficulty] || 0.3;
    
    score += (Math.random() - 0.5) * score * randomFactor;
    
    return score;
}

