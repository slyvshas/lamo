// Game state
let board = Array(5).fill().map(() => Array(5).fill(null));
let phase = 1; // 1: Placement, 2: Movement
let goatsToPlace = 20;
let goatsCaptured = 0;
let turn = "goat"; // Starts with goat placing
let selectedPiece = null; // Tracks selected tiger or goat

// DOM elements
const gameBoard = document.getElementById('game-board');
const statusText = document.getElementById('status');
const capturedGoatsSection = document.getElementById('captured-goats');
const moveSound = document.getElementById('move-sound');
const captureSound = document.getElementById('capture-sound');
const tigerSound = document.getElementById('tigermove-sound');

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
    if (isBotEnabled && turn === "tiger") return; // Prevent player from moving Tigers in bot mode

    const row = parseInt(event.target.dataset.row);
    const col = parseInt(event.target.dataset.col);

    if (phase === 1 && turn === "goat" && !board[row][col] && goatsToPlace > 0) {
        board[row][col] = "goat";
        goatsToPlace--;
        turn = "tiger";
        moveSound.play();
    } else if (board[row][col] === turn && !selectedPiece) {
        selectedPiece = [row, col];
    } else if (selectedPiece) {
        const moveSuccess = turn === "tiger" ? moveTiger(...selectedPiece, row, col) : moveGoat(...selectedPiece, row, col);
        selectedPiece = null;
        if (moveSuccess) {
            turn = turn === "tiger" ? "goat" : "tiger";
            if (phase === 1 && goatsToPlace === 0) phase = 2;
            checkWinConditions();
        }
    }
    renderBoard();

    // If bot is enabled and it's the bot's turn, make a move after a delay
    if (isBotEnabled && turn === "tiger") {
        setTimeout(botMove, 1000);
    }
}

// Bot logic
function botMove() {
    if (!isBotEnabled || turn !== "tiger") return;

    // Find all possible moves for Tigers
    const possibleMoves = [];
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
            if (board[i][j] === "tiger") {
                for (let [dr, dc] of connections) {
                    const newRow = i + dr;
                    const newCol = j + dc;
                    if (newRow >= 0 && newRow < 5 && newCol >= 0 && newCol < 5 && !board[newRow][newCol]) {
                        possibleMoves.push({ from: [i, j], to: [newRow, newCol], isCapture: false });
                    }
                }
                for (let [dr, dc] of jumpConnections) {
                    const newRow = i + dr;
                    const newCol = j + dc;
                    const midRow = i + dr / 2;
                    const midCol = j + dc / 2;
                    if (newRow >= 0 && newRow < 5 && newCol >= 0 && newCol < 5 && board[midRow][midCol] === "goat" && !board[newRow][newCol]) {
                        possibleMoves.push({ from: [i, j], to: [newRow, newCol], isCapture: true });
                    }
                }
            }
        }
    }

    // Prioritize capturing Goats
    const captureMoves = possibleMoves.filter(move => move.isCapture);
    if (captureMoves.length > 0) {
        const move = captureMoves[Math.floor(Math.random() * captureMoves.length)];
        moveTiger(move.from[0], move.from[1], move.to[0], move.to[1]);
        turn = "goat"; // Switch turn to goat
        renderBoard();
        checkWinConditions();
        return;
    }

    // If no captures, move randomly
    if (possibleMoves.length > 0) {
        const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        moveTiger(move.from[0], move.from[1], move.to[0], move.to[1]);
        turn = "goat"; // Switch turn to goat
        renderBoard();
        checkWinConditions();
        return;
    }

    // If no moves are possible, pass the turn
    turn = "goat";
    renderBoard();
    checkWinConditions();
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
   
    const scoreText = `Goats Captured: ${goatsCaptured} | Goats Remaining: ${goatsToPlace}`;
    statusText.textContent = `${scoreText}`;

    // Update turn indicator
    turnIcon.textContent = turn === "goat" ? "🐐" : "🐅";
    turnText.textContent = turn === "goat" ? "Goat's Turn" : "Tiger's Turn";
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

// Show the Game Over modal
function showGameOver(winner) {
    let message = winner === "tiger" 
        ? "🐯 The Tigers Win! Better luck next time, Goats! 🐐"
        : "🎉 The Goats Win! The Tigers couldn't hunt enough! 🏆";
    
    document.getElementById("winner-message").innerHTML = message;
    
    let modal = document.getElementById("game-over-modal");

    // Ensure modal is properly centered and visible
    modal.style.display = "flex";
    modal.style.opacity = "1";
    modal.style.visibility = "visible";
}

// Toggle bot mode
let isBotEnabled = false; // Tracks if bot mode is enabled
const botModeBtn = document.getElementById('bot-mode-btn');
botModeBtn.addEventListener('click', () => {
    isBotEnabled = !isBotEnabled;
    botModeBtn.textContent = isBotEnabled ? "Play Against Human" : "Play Against Bot";
    if (isBotEnabled && turn === "tiger") {
        setTimeout(botMove, 1000); // Bot makes a move after 1 second
    }
});

// Reset the game
function resetGame() {
    // Reset game state
    board = Array(5).fill().map(() => Array(5).fill(null));
    phase = 1;
    goatsToPlace = 20;
    goatsCaptured = 0;
    turn = "goat";
    selectedPiece = null;

    // Hide Game Over Modal
    document.getElementById("game-over-modal").style.display = "none";

    // Reset status text
    document.getElementById("status").innerText = "Phase 1: Place a Goat 🐐";

    // Reset captured goats display
    document.getElementById("captured-goats-left").innerHTML = "";  // Clear captured goats

    // Reinitialize the board
    initBoard();
}

// Initialize the game
initBoard();