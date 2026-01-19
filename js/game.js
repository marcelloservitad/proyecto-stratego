// game.js - Corregido con historial funcional, combates de 7 segundos y soporte para 10 o 40 piezas

document.addEventListener('DOMContentLoaded', function() {
    initializeGame();
});

let gameState = {
    board: null,
    currentPlayer: 'player',
    selectedPiece: null,
    validMoves: [],
    gameActive: true,
    playerPiecesRemaining: 40,
    opponentPiecesRemaining: 40,
    gameStartTime: null,
    totalMoves: 0
};

// Variable global para mostrar todas las piezas del oponente
window.showAllOpponentPieces = false;

// Ejército completo según reglas oficiales de Stratego (versión europea)
const ARMY_COMPOSITION = [
    { type: 'marshal', name: 'Mariscal', rank: 10, count: 1, symbol: '🎖️' },
    { type: 'general', name: 'General', rank: 9, count: 1, symbol: '⭐' },
    { type: 'colonel', name: 'Coronel', rank: 8, count: 2, symbol: '🦅' },
    { type: 'major', name: 'Comandante', rank: 7, count: 3, symbol: '⚔️' },
    { type: 'captain', name: 'Capitán', rank: 6, count: 4, symbol: '🛡️' },
    { type: 'lieutenant', name: 'Teniente', rank: 5, count: 4, symbol: '⚜️' },
    { type: 'sergeant', name: 'Sargento', rank: 4, count: 4, symbol: '🔰' },
    { type: 'miner', name: 'Minador', rank: 3, count: 5, symbol: '⛏️' },
    { type: 'scout', name: 'Explorador', rank: 2, count: 8, symbol: '👁️' },
    { type: 'spy', name: 'Espía', rank: 1, count: 1, symbol: '🕵️' },
    { type: 'bomb', name: 'Bomba', rank: 0, count: 6, symbol: '💣' },
    { type: 'flag', name: 'Bandera', rank: -1, count: 1, symbol: '🏁' }
];

function initializeGame() {
    console.log('Inicializando juego de Stratego...');
    
    gameState.gameStartTime = Date.now();
    gameState.totalMoves = 0;
    
    createGameBoard();
    loadPieces();
    setupGameEvents();
    updateUI();
    
    // Determinar modalidad para el mensaje
    const deploymentData = localStorage.getItem('game_deployment');
    const gameType = deploymentData ? 
        JSON.parse(deploymentData).gameType : 
        (JSON.parse(localStorage.getItem('current_game') || '{}').gameType || 'classic');
    
    const pieceCount = gameType === 'quick' ? 10 : 40;
    console.log(`Juego inicializado - ${pieceCount} piezas por jugador`);
    addGameMessage(`¡La batalla ha comenzado! ${pieceCount} piezas por ejército.`);
}

function createGameBoard() {
    const boardElement = document.getElementById('game-board');
    if (!boardElement) {
        console.error('No se encontró el elemento del tablero');
        return;
    }
    
    boardElement.innerHTML = '';
    gameState.board = new Array(10).fill().map(() => new Array(10).fill(null));
    
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
            const cell = document.createElement('div');
            cell.className = 'board-full-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            if (isLakePosition(row, col)) {
                cell.classList.add('lake');
                cell.innerHTML = '🌊';
                cell.title = 'Lago - No transitable';
            } else {
                cell.addEventListener('click', () => handleCellClick(row, col));
                
                if (row < 4) {
                    cell.classList.add('opponent-territory');
                } else if (row > 5) {
                    cell.classList.add('player-territory');
                }
            }
            
            boardElement.appendChild(cell);
        }
    }
}

function isLakePosition(row, col) {
    return (row === 4 || row === 5) && (col === 2 || col === 3 || col === 6 || col === 7);
}

function loadPieces() {
    console.log('Cargando piezas por jugador...');
    
    const deploymentData = localStorage.getItem('game_deployment');
    
    if (!deploymentData) {
        // No hay despliegue, crear ejércitos según la modalidad
        const currentGame = JSON.parse(localStorage.getItem('current_game') || '{}');
        const gameType = currentGame.gameType || 'classic';
        console.log(`No hay despliegue guardado. Creando ejércitos para modalidad ${gameType}.`);
        createFullArmies(gameType);
        return;
    }
    
    try {
        const deployment = JSON.parse(deploymentData);
        const playerPieces = deployment.pieces || [];
        const gameType = deployment.gameType || 'classic';
        
        console.log(`Cargando ${playerPieces.length} piezas del jugador (modalidad: ${gameType})`);
        
        playerPieces.forEach((piece) => {
            if (piece.position) {
                const row = 9 - piece.position.row;
                const col = piece.position.col;
                
                if (row >= 6 && row < 10 && col >= 0 && col < 10 && !isLakePosition(row, col)) {
                    const armyUnit = ARMY_COMPOSITION.find(u => u.type === piece.type);
                    placePiece(row, col, {
                        type: piece.type,
                        name: piece.name || armyUnit?.name || piece.type,
                        rank: piece.rank !== undefined ? piece.rank : (armyUnit?.rank || 0),
                        player: 'player',
                        revealed: true,
                        symbol: armyUnit?.symbol || '❓'
                    });
                }
            }
        });
        
        gameState.playerPiecesRemaining = playerPieces.length;
        
        createOpponentArmy(gameType);
        
    } catch (error) {
        console.error('Error al cargar piezas:', error);
        const currentGame = JSON.parse(localStorage.getItem('current_game') || '{}');
        const gameType = currentGame.gameType || 'classic';
        createFullArmies(gameType);
    }
}

function placePiece(row, col, pieceData) {
    if (!gameState.board[row] || gameState.board[row][col]) {
        return false;
    }
    
    gameState.board[row][col] = pieceData;
    updateCellDisplay(row, col);
    return true;
}

function updateCellDisplay(row, col) {
    const cell = document.querySelector(`.board-full-cell[data-row="${row}"][data-col="${col}"]`);
    if (!cell) return;
    
    cell.innerHTML = '';
    
    const piece = gameState.board[row][col];
    if (!piece) return;
    
    const pieceElement = document.createElement('div');
    pieceElement.className = `game-piece ${piece.player} ${piece.type}`;
    
    // Si la pieza es del oponente y no está revelada, mostrar versión oculta
    if (piece.player === 'opponent' && !piece.revealed) {
        pieceElement.classList.add('hidden-opponent');
    } else if (piece.revealed) {
        pieceElement.classList.add('revealed');
    }
    
    // Determinar qué mostrar
    let displaySymbol = '❓';
    let displayRank = '?';
    
    if (piece.player === 'player') {
        // Jugador siempre ve sus piezas
        displaySymbol = piece.symbol;
        displayRank = piece.rank >= 0 ? piece.rank : 'F';
    } else if (piece.revealed || window.showAllOpponentPieces) {
        // Opotente solo se ve si está revelado o si activamos la vista
        displaySymbol = piece.symbol;
        displayRank = piece.rank >= 0 ? piece.rank : 'F';
    }
    
    pieceElement.innerHTML = `
        <div class="piece-symbol">${displaySymbol}</div>
        <div class="piece-rank">${displayRank}</div>
    `;
    
    // Tooltip diferente según estado
    if (piece.player === 'player') {
        pieceElement.title = `${piece.name} (Rango: ${piece.rank >= 0 ? piece.rank : 'Bandera'})`;
    } else if (piece.revealed || window.showAllOpponentPieces) {
        pieceElement.title = `${piece.name} (Rango: ${piece.rank >= 0 ? piece.rank : 'Bandera'})`;
    } else {
        pieceElement.title = 'Pieza enemiga - Desconocida';
    }
    
    // Solo las piezas del jugador son clickeables
    if (piece.player === 'player') {
        pieceElement.addEventListener('click', (e) => {
            e.stopPropagation();
            handlePieceClick(row, col);
        });
    }
    
    cell.appendChild(pieceElement);
}
function createFullArmies(gameType) {
    createPlayerArmy(gameType);
    createOpponentArmy(gameType);
}

function createPlayerArmy(gameType) {
    console.log(`Creando ejército del jugador (modalidad: ${gameType})...`);
    const army = generateFullArmy('player', gameType);
    let placed = 0;
    
    for (let row = 6; row < 10 && placed < army.length; row++) {
        for (let col = 0; col < 10 && placed < army.length; col++) {
            if (!isLakePosition(row, col) && !gameState.board[row][col]) {
                placePiece(row, col, army[placed]);
                placed++;
            }
        }
    }
    
    gameState.playerPiecesRemaining = army.length;
    console.log(`Colocadas ${placed} piezas del jugador`);
}

function createOpponentArmy(gameType) {
    console.log(`Creando ejército del oponente (modalidad: ${gameType})...`);
    const army = generateFullArmy('opponent', gameType);
    let placed = 0;
    
    for (let row = 0; row < 4 && placed < army.length; row++) {
        for (let col = 0; col < 10 && placed < army.length; col++) {
            if (!isLakePosition(row, col) && !gameState.board[row][col]) {
                placePiece(row, col, army[placed]);
                placed++;
            }
        }
    }
    
    gameState.opponentPiecesRemaining = army.length;
    console.log(`Colocadas ${placed} piezas del oponente`);
}

function generateFullArmy(player, gameType) {
    const army = [];
    
    // Determinar qué composición usar según el tipo de juego
    let composition;
    if (gameType === 'quick') {
        // Para 10 piezas: composición simplificada
        composition = [
            { type: 'marshal', name: 'Mariscal', rank: 10, count: 1, symbol: '🎖️' },
            { type: 'colonel', name: 'Coronel', rank: 8, count: 1, symbol: '🦅' },
            { type: 'major', name: 'Comandante', rank: 7, count: 1, symbol: '⚔️' },
            { type: 'captain', name: 'Capitán', rank: 6, count: 1, symbol: '🛡️' },
            { type: 'lieutenant', name: 'Teniente', rank: 5, count: 1, symbol: '⚜️' },
            { type: 'miner', name: 'Minador', rank: 3, count: 1, symbol: '⛏️' },
            { type: 'scout', name: 'Explorador', rank: 2, count: 1, symbol: '👁️' },
            { type: 'spy', name: 'Espía', rank: 1, count: 1, symbol: '🕵️' },
            { type: 'bomb', name: 'Bomba', rank: 0, count: 1, symbol: '💣' },
            { type: 'flag', name: 'Bandera', rank: -1, count: 1, symbol: '🏁' }
        ];
    } else {
        // Para 40 piezas (clásico)
        composition = ARMY_COMPOSITION;
    }
    
    composition.forEach(unit => {
        for (let i = 0; i < unit.count; i++) {
            army.push({
                type: unit.type,
                name: unit.name,
                rank: unit.rank,
                player: player,
                revealed: player === 'player',
                symbol: unit.symbol,
                id: `${unit.type}_${player}_${i}`
            });
        }
    });
    
    return shuffleArray(army);
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function handleCellClick(row, col) {
    if (!gameState.gameActive || gameState.currentPlayer !== 'player') {
        return;
    }
    
    if (gameState.selectedPiece) {
        const move = gameState.validMoves.find(m => m.row === row && m.col === col);
        if (move) {
            executeMove(gameState.selectedPiece, { row, col });
            return;
        }
    }
    
    clearSelection();
}

function handlePieceClick(row, col) {
    if (!gameState.gameActive || gameState.currentPlayer !== 'player') {
        return;
    }
    
    const piece = gameState.board[row][col];
    if (!piece || piece.player !== 'player') {
        return;
    }
    
    selectPiece(row, col);
}

function selectPiece(row, col) {
    const piece = gameState.board[row][col];
    if (!piece || piece.player !== 'player') {
        return;
    }
    
    clearSelection();
    gameState.selectedPiece = { row, col, piece };
    calculateValidMoves(row, col);
    updateUI();
    
    console.log(`Pieza seleccionada: ${piece.name} en (${row},${col})`);
}

function calculateValidMoves(row, col) {
    gameState.validMoves = [];
    const piece = gameState.board[row][col];
    
    if (!piece || piece.type === 'flag' || piece.type === 'bomb') {
        return;
    }
    
    const directions = [
        { dr: -1, dc: 0 },
        { dr: 1, dc: 0 },
        { dr: 0, dc: -1 },
        { dr: 0, dc: 1 }
    ];
    
    const maxDistance = piece.type === 'scout' ? 10 : 1;
    
    directions.forEach(dir => {
        for (let distance = 1; distance <= maxDistance; distance++) {
            const newRow = row + (dir.dr * distance);
            const newCol = col + (dir.dc * distance);
            
            if (!isValidPosition(newRow, newCol)) {
                break;
            }
            
            const targetPiece = gameState.board[newRow][newCol];
            
            if (targetPiece) {
                if (targetPiece.player !== piece.player) {
                    gameState.validMoves.push({ 
                        row: newRow, 
                        col: newCol, 
                        type: 'attack' 
                    });
                }
                break;
            } else {
                gameState.validMoves.push({ 
                    row: newRow, 
                    col: newCol, 
                    type: 'move' 
                });
            }
            
            if (piece.type !== 'scout') break;
        }
    });
}

function isValidPosition(row, col) {
    if (row < 0 || row >= 10 || col < 0 || col >= 10) {
        return false;
    }
    
    if (isLakePosition(row, col)) {
        return false;
    }
    
    return true;
}

function executeMove(from, to) {
    const piece = gameState.board[from.row][from.col];
    const targetPiece = gameState.board[to.row][to.col];
    
    gameState.totalMoves++;
    
    // Registrar movimiento en el historial
    if (targetPiece) {
        logMove(piece, from, to, true, targetPiece);
    } else {
        logMove(piece, from, to, false, null);
    }
    
    if (targetPiece) {
        resolveCombat(piece, targetPiece, to);
    } else {
        movePiece(from, to);
        addGameMessage(`${piece.name} se movió a (${to.row},${to.col})`);
        
        clearSelection();
        checkVictoryConditions();
        switchTurn();
    }
    
    updateUI();
}

function movePiece(from, to) {
    const piece = gameState.board[from.row][from.col];
    
    if (!piece) return;
    
    gameState.board[from.row][from.col] = null;
    gameState.board[to.row][to.col] = piece;
    
    updateCellDisplay(from.row, from.col);
    updateCellDisplay(to.row, to.col);
    
    console.log(`Movido ${piece.name} de (${from.row},${from.col}) a (${to.row},${to.col})`);
}

function resolveCombat(attacker, defender, position) {
    console.log(`⚔️ Combate: ${attacker.name} (${attacker.rank}) vs ${defender.name} (${defender.rank})`);
    
    const combatResult = calculateCombatResultWithExplanation(attacker, defender);
    
    showCombatModalWithResult(attacker, defender, combatResult);
    
    // Cambiado de 3 a 7 segundos
    setTimeout(() => {
        processCombatResult(combatResult.result, attacker, defender, position);
        hideCombatModal();
    }, 7000);
}

function calculateCombatResultWithExplanation(attacker, defender) {
    let result = '';
    let winner = null;
    let loser = null;
    let explanation = '';
    let rule = '';
    
    if (defender.type === 'bomb') {
        if (attacker.type === 'miner') {
            result = 'attacker_wins';
            winner = attacker;
            loser = defender;
            rule = 'miner_vs_bomb';
            explanation = 'El Minador desactiva la Bomba con éxito';
        } else {
            result = 'defender_wins';
            winner = defender;
            loser = attacker;
            rule = 'bomb_vs_other';
            explanation = 'La Bomba explota y destruye al atacante';
        }
        return { result, winner, loser, explanation, rule };
    }
    
    if (attacker.type === 'spy' && defender.type === 'marshal') {
        result = 'attacker_wins';
        winner = attacker;
        loser = defender;
        rule = 'spy_vs_marshal';
        explanation = 'El Espía ataca por sorpresa al Mariscal';
        return { result, winner, loser, explanation, rule };
    }
    
    if (attacker.type === 'marshal' && defender.type === 'spy') {
        result = 'attacker_wins';
        winner = attacker;
        loser = defender;
        rule = 'marshal_vs_spy';
        explanation = 'El Mariscal ataca y derrota al Espía';
        return { result, winner, loser, explanation, rule };
    }
    
    if (defender.type === 'flag') {
        result = 'attacker_wins';
        winner = attacker;
        loser = defender;
        rule = 'capture_flag';
        explanation = '¡Bandera enemiga capturada!';
        return { result, winner, loser, explanation, rule };
    }
    
    if (attacker.rank === defender.rank) {
        result = 'both_die';
        winner = null;
        loser = null;
        rule = 'equal_rank';
        explanation = `Ambas piezas tienen rango ${attacker.rank} - ambas son eliminadas`;
        return { result, winner, loser, explanation, rule };
    }
    
    if (attacker.rank > defender.rank) {
        result = 'attacker_wins';
        winner = attacker;
        loser = defender;
        rule = 'higher_rank';
        explanation = `${attacker.name} (rango ${attacker.rank}) es más fuerte que ${defender.name} (rango ${defender.rank})`;
    } else {
        result = 'defender_wins';
        winner = defender;
        loser = attacker;
        rule = 'higher_rank';
        explanation = `${defender.name} (rango ${defender.rank}) es más fuerte que ${attacker.name} (rango ${attacker.rank})`;
    }
    
    return { result, winner, loser, explanation, rule };
}

function showCombatModalWithResult(attacker, defender, combatResult) {
    const modal = document.getElementById('combat-modal');
    if (!modal) return;
    
    const attackerRevealed = attacker.revealed || attacker.player === 'player';
    const defenderRevealed = defender.revealed || defender.player === 'player';
    
    let outcomeClass = '';
    let outcomeTitle = '';
    let outcomeIcon = '⚔️';
    
    switch (combatResult.result) {
        case 'attacker_wins':
            outcomeClass = 'outcome-victory';
            outcomeTitle = '¡ATACANTE GANA!';
            outcomeIcon = '🎖️';
            break;
        case 'defender_wins':
            outcomeClass = 'outcome-defeat';
            outcomeTitle = '¡DEFENSOR GANA!';
            outcomeIcon = '💀';
            break;
        case 'both_die':
            outcomeClass = 'outcome-draw';
            outcomeTitle = '¡AMBAS ELIMINADAS!';
            outcomeIcon = '💥';
            break;
    }
    
    modal.innerHTML = `
        <div class="modal-content">
            <h2>${outcomeIcon} COMBATE ${outcomeIcon}</h2>
            
            <div class="combat-participants">
                <div class="participant attacker">
                    <div class="participant-header">
                        <span class="participant-label">ATACANTE</span>
                        <span class="participant-role">(${attacker.player === 'player' ? 'TÚ' : 'OPONENTE'})</span>
                    </div>
                    <div class="participant-details">
                        <div class="participant-symbol">${attacker.symbol}</div>
                        <div class="participant-info">
                            <h3>${attackerRevealed ? attacker.name : 'Pieza Desconocida'}</h3>
                            <p class="participant-rank">Rango: ${attackerRevealed ? (attacker.rank >= 0 ? attacker.rank : 'Bandera') : '?'}</p>
                        </div>
                    </div>
                </div>
                
                <div class="vs-separator">
                    <div class="vs-circle">VS</div>
                </div>
                
                <div class="participant defender">
                    <div class="participant-header">
                        <span class="participant-label">DEFENSOR</span>
                        <span class="participant-role">(${defender.player === 'player' ? 'TÚ' : 'OPONENTE'})</span>
                    </div>
                    <div class="participant-details">
                        <div class="participant-symbol">${defender.symbol}</div>
                        <div class="participant-info">
                            <h3>${defenderRevealed ? defender.name : 'Pieza Desconocida'}</h3>
                            <p class="participant-rank">Rango: ${defenderRevealed ? (defender.rank >= 0 ? defender.rank : 'Bandera') : '?'}</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="combat-outcome ${outcomeClass}">
                <h3>${outcomeTitle}</h3>
                
                <div class="result-details">
                    ${combatResult.result !== 'both_die' ? 
                        `<div class="winner-section">
                            <span class="winner-label">GANADOR:</span>
                            <span class="winner-name">${combatResult.winner.name}</span>
                            <span class="winner-symbol">${combatResult.winner.symbol}</span>
                        </div>
                        <div class="loser-section">
                            <span class="loser-label">PERDEDOR:</span>
                            <span class="loser-name">${combatResult.loser.name}</span>
                            <span class="loser-symbol">${combatResult.loser.symbol}</span>
                        </div>` 
                        : 
                        `<div class="both-die-section">
                            <span class="both-die-label">ELIMINADAS:</span>
                            <span class="both-die-name">${attacker.name} y ${defender.name}</span>
                        </div>`
                    }
                </div>
                
                <div class="explanation-box">
                    <h4>📖 REGLA APLICADA:</h4>
                    <p class="explanation-text">${combatResult.explanation}</p>
                </div>
                
                <div class="rule-tag">
                    ${getRuleTag(combatResult.rule)}
                </div>
            </div>
            
            <div class="modal-footer">
                <div class="countdown">
                    Continuando en <span id="combat-countdown">7</span> segundos...
                </div>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
    
    // Contador regresivo - cambiado a 7 segundos
    let countdown = 7;
    const countdownElement = document.getElementById('combat-countdown');
    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdownElement) {
            countdownElement.textContent = countdown;
        }
        if (countdown <= 0) {
            clearInterval(countdownInterval);
        }
    }, 1000);
}

function getRuleTag(rule) {
    const tags = {
        'miner_vs_bomb': '🛡️ MINADOR ESPECIAL',
        'bomb_vs_other': '💣 BOMBA',
        'spy_vs_marshal': '🕵️ ESPÍA ESPECIAL',
        'marshal_vs_spy': '🎖️ MARISCAL',
        'capture_flag': '🏁 BANDERA',
        'equal_rank': '⚖️ RANGOS IGUALES',
        'higher_rank': '📊 RANGO SUPERIOR'
    };
    
    return tags[rule] || '📜 REGLA';
}

function processCombatResult(result, attacker, defender, position) {
    switch (result) {
        case 'attacker_wins':
            removePiece(position.row, position.col);
            updatePieceCount(defender.player, -1);
            movePiece(gameState.selectedPiece, position);
            
            // Actualizar el historial con el resultado del combate
            updateLastMoveWithResult(`${attacker.name} venció a ${defender.name}`);
            
            if (defender.type === 'flag') {
                addGameMessage(`🎖️ ¡${attacker.name} CAPTURÓ LA BANDERA ENEMIGA! ¡VICTORIA!`);
                endGame('player', 'flag_capture');
                return;
            } else if (defender.type === 'bomb') {
                addGameMessage(`⛏️ ¡${attacker.name} DESACTIVÓ UNA BOMBA!`);
            } else if (attacker.type === 'spy' && defender.type === 'marshal') {
                addGameMessage(`🕵️ ¡EL ESPÍA DERROTÓ AL MARISCAL ENEMIGO!`);
            } else {
                addGameMessage(`⚔️ ¡${attacker.name} (rango ${attacker.rank}) derrotó a ${defender.name} (rango ${defender.rank})!`);
            }
            break;
            
        case 'defender_wins':
            removePiece(gameState.selectedPiece.row, gameState.selectedPiece.col);
            updatePieceCount(attacker.player, -1);
            revealPiece(position.row, position.col);
            
            // Actualizar el historial con el resultado del combate
            updateLastMoveWithResult(`${defender.name} venció a ${attacker.name}`);
            
            if (defender.type === 'bomb') {
                addGameMessage(`💣 ¡${attacker.name} ACTIVÓ UNA BOMBA y fue destruido!`);
            } else {
                addGameMessage(`🛡️ ¡${defender.name} (rango ${defender.rank}) defendió contra ${attacker.name} (rango ${attacker.rank})!`);
            }
            break;
            
        case 'both_die':
            removePiece(gameState.selectedPiece.row, gameState.selectedPiece.col);
            removePiece(position.row, position.col);
            updatePieceCount(attacker.player, -1);
            updatePieceCount(defender.player, -1);
            
            // Actualizar el historial con el resultado del combate
            updateLastMoveWithResult(`Ambas piezas eliminadas`);
            
            addGameMessage(`💥 ¡${attacker.name} y ${defender.name} se eliminaron mutuamente (mismo rango ${attacker.rank})!`);
            break;
    }
    
    checkVictoryConditions();
    clearSelection();
    switchTurn();
}

function updateLastMoveWithResult(resultText) {
    const moveHistory = document.getElementById('move-history');
    if (!moveHistory || moveHistory.children.length === 0) return;
    
    const lastMove = moveHistory.lastElementChild;
    const resultSpan = document.createElement('span');
    resultSpan.className = 'move-result';
    resultSpan.textContent = ` → ${resultText}`;
    resultSpan.style.color = '#38a169';
    resultSpan.style.fontWeight = 'bold';
    resultSpan.style.marginLeft = '5px';
    
    lastMove.appendChild(resultSpan);
    moveHistory.scrollTop = moveHistory.scrollHeight;
}

function removePiece(row, col) {
    if (gameState.board[row] && gameState.board[row][col]) {
        const piece = gameState.board[row][col];
        console.log(`Eliminando pieza: ${piece.name} del ${piece.player}`);
        
        gameState.board[row][col] = null;
        updateCellDisplay(row, col);
    }
}

function revealPiece(row, col) {
    const piece = gameState.board[row][col];
    if (piece && !piece.revealed) {
        piece.revealed = true;
        updateCellDisplay(row, col);
        console.log(`Pieza revelada: ${piece.name} (${piece.player})`);
        
        // Añadir mensaje al chat
        if (piece.player === 'opponent') {
            addGameMessage(`🔍 ${piece.name} del oponente ha sido revelada!`);
        }
    }
}

function updatePieceCount(player, delta) {
    if (player === 'player') {
        gameState.playerPiecesRemaining += delta;
        if (gameState.playerPiecesRemaining < 0) gameState.playerPiecesRemaining = 0;
    } else {
        gameState.opponentPiecesRemaining += delta;
        if (gameState.opponentPiecesRemaining < 0) gameState.opponentPiecesRemaining = 0;
    }
    
    updatePieceCounters();
}

function checkVictoryConditions() {
    if (!gameState.gameActive) return;
    
    let playerHasMovablePieces = false;
    let opponentHasMovablePieces = false;
    
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
            const piece = gameState.board[row][col];
            if (piece) {
                if (piece.type !== 'flag' && piece.type !== 'bomb') {
                    if (piece.player === 'player') {
                        playerHasMovablePieces = true;
                    } else {
                        opponentHasMovablePieces = true;
                    }
                }
            }
        }
    }
    
    if (!playerHasMovablePieces && gameState.opponentPiecesRemaining > 0) {
        endGame('opponent', 'annihilation');
    } else if (!opponentHasMovablePieces && gameState.playerPiecesRemaining > 0) {
        endGame('player', 'annihilation');
    }
}

function switchTurn() {
    if (!gameState.gameActive) return;
    
    gameState.currentPlayer = gameState.currentPlayer === 'player' ? 'opponent' : 'player';
    
    if (gameState.currentPlayer === 'opponent' && gameState.gameActive) {
        addGameMessage('🤖 Turno del oponente...');
        setTimeout(() => botMakeMove(), 1500);
    }
    
    updateUI();
}

function botMakeMove() {
    if (!gameState.gameActive || gameState.currentPlayer !== 'opponent') {
        return;
    }
    
    console.log('🤖 Bot pensando movimiento...');
    
    const movablePieces = [];
    
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
            const piece = gameState.board[row][col];
            if (piece && piece.player === 'opponent' && 
                piece.type !== 'flag' && piece.type !== 'bomb') {
                movablePieces.push({ row, col, piece });
            }
        }
    }
    
    if (movablePieces.length === 0) {
        addGameMessage('El oponente no tiene piezas para mover');
        switchTurn();
        return;
    }
    
    const randomIndex = Math.floor(Math.random() * movablePieces.length);
    const randomPiece = movablePieces[randomIndex];
    
    gameState.selectedPiece = { 
        row: randomPiece.row, 
        col: randomPiece.col, 
        piece: randomPiece.piece 
    };
    calculateValidMoves(randomPiece.row, randomPiece.col);
    
    if (gameState.validMoves.length === 0) {
        gameState.selectedPiece = null;
        gameState.validMoves = [];
        botMakeMove();
        return;
    }
    
    const randomMoveIndex = Math.floor(Math.random() * gameState.validMoves.length);
    const randomMove = gameState.validMoves[randomMoveIndex];
    
    console.log(`🤖 Bot mueve ${randomPiece.piece.name} de (${randomPiece.row},${randomPiece.col}) a (${randomMove.row},${randomMove.col})`);
    
    executeMove(
        { row: randomPiece.row, col: randomPiece.col },
        { row: randomMove.row, col: randomMove.col }
    );
}

function clearSelection() {
    document.querySelectorAll('.board-full-cell.selected').forEach(cell => {
        cell.classList.remove('selected');
    });
    
    document.querySelectorAll('.board-full-cell.valid-move, .board-full-cell.attack-target').forEach(cell => {
        cell.classList.remove('valid-move', 'attack-target');
    });
    
    gameState.selectedPiece = null;
    gameState.validMoves = [];
}

function updateUI() {
    const turnIndicator = document.getElementById('turn-indicator');
    if (turnIndicator) {
        if (gameState.currentPlayer === 'player') {
            turnIndicator.textContent = '🎮 TU TURNO';
            turnIndicator.className = 'turn-indicator your-turn';
        } else {
            turnIndicator.textContent = '🤖 TURNO DEL BOT';
            turnIndicator.className = 'turn-indicator opponent-turn';
        }
    }
    
    updatePieceCounters();
    updateGameTimer();
    
    if (gameState.selectedPiece) {
        const cell = document.querySelector(
            `.board-full-cell[data-row="${gameState.selectedPiece.row}"][data-col="${gameState.selectedPiece.col}"]`
        );
        if (cell) cell.classList.add('selected');
        
        gameState.validMoves.forEach(move => {
            const moveCell = document.querySelector(
                `.board-full-cell[data-row="${move.row}"][data-col="${move.col}"]`
            );
            if (moveCell) {
                if (move.type === 'attack') {
                    moveCell.classList.add('attack-target');
                } else {
                    moveCell.classList.add('valid-move');
                }
            }
        });
    }
}

function updatePieceCounters() {
    const playerCountEl = document.getElementById('player-pieces-count');
    const opponentCountEl = document.getElementById('opponent-pieces-count');
    
    if (playerCountEl) playerCountEl.textContent = gameState.playerPiecesRemaining;
    if (opponentCountEl) opponentCountEl.textContent = gameState.opponentPiecesRemaining;
}

function updateGameTimer() {
    const timerElement = document.getElementById('game-timer');
    if (!timerElement || !gameState.gameStartTime) return;
    
    const elapsed = Date.now() - gameState.gameStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    
    timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function setupGameEvents() {
    const surrenderBtn = document.getElementById('surrender-btn');
    if (surrenderBtn) {
        surrenderBtn.addEventListener('click', () => {
            if (confirm('¿Rendirse y conceder la victoria al oponente?')) {
                endGame('opponent', 'surrender');
            }
        });
    }
    
    const drawBtn = document.getElementById('offer-draw-btn');
    if (drawBtn) {
        drawBtn.addEventListener('click', () => {
            if (confirm('¿Ofrecer tablas al oponente?')) {
                addGameMessage('Has ofrecido tablas al oponente');
            }
        });
    }
    
    const saveBtn = document.getElementById('save-game-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const simplifiedData = {
                state: gameState,
                timestamp: new Date().toISOString()
            };
            
            localStorage.setItem('saved_game', JSON.stringify(simplifiedData));
            alert('Partida guardada correctamente');
            addGameMessage('Partida guardada');
        });
    }
    
    const protocolBtn = document.getElementById('toggle-protocol-btn');
    if (protocolBtn) {
        protocolBtn.addEventListener('click', () => {
            const currentProtocol = localStorage.getItem('game_protocol') || 'websocket';
            const newProtocol = currentProtocol === 'websocket' ? 'ajax' : 'websocket';
            localStorage.setItem('game_protocol', newProtocol);
            alert(`Protocolo cambiado a: ${newProtocol.toUpperCase()}`);
            updateProtocolDisplay();
        });
    }
    
    const chatInput = document.getElementById('game-chat-input');
    const sendChatBtn = document.getElementById('send-game-chat');
    
    if (sendChatBtn && chatInput) {
        sendChatBtn.addEventListener('click', sendChatMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }
    
    updateProtocolDisplay();
    console.log('Eventos del juego configurados');

    // Botón para revelar piezas enemigas
const revealBtn = document.getElementById('reveal-opponent-btn');
if (revealBtn) {
    revealBtn.addEventListener('click', revealOpponentPieces);
}
}

function updateProtocolDisplay() {
    const protocolDisplay = document.getElementById('game-protocol-display');
    if (protocolDisplay) {
        const protocol = localStorage.getItem('game_protocol') || 'websocket';
        protocolDisplay.textContent = `Protocolo: ${protocol.toUpperCase()}`;
        protocolDisplay.className = `protocol-display-game ${protocol}`;
    }
}

function sendChatMessage() {
    const input = document.getElementById('game-chat-input');
    const message = input?.value.trim();
    
    if (!message) return;
    
    addChatMessage('Tú', message, true);
    
    setTimeout(() => {
        const botResponses = [
            "Buena jugada...",
            "Estoy pensando...",
            "¡Cuidado con mi mariscal!",
            "Tu estrategia es interesante",
            "Vamos a ver quién gana"
        ];
        const randomResponse = botResponses[Math.floor(Math.random() * botResponses.length)];
        addChatMessage('Oponente', randomResponse, false);
    }, 1000 + Math.random() * 2000);
    
    if (input) input.value = '';
}

function addChatMessage(sender, message, isOwn) {
    const chatMessages = document.getElementById('game-chat-messages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'sender' : 'player'}`;
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
        <span class="message-sender">${sender}:</span>
        <span class="message-text">${message}</span>
        <span class="message-time">${time}</span>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addGameMessage(message) {
    addChatMessage('Sistema', message, false);
    console.log(`📢 ${message}`);
}

function logMove(piece, from, to, isAttack, targetPiece) {
    const moveHistory = document.getElementById('move-history');
    if (!moveHistory) {
        console.error('No se encontró el elemento move-history');
        return;
    }
    
    const moveItem = document.createElement('div');
    moveItem.className = 'move-item';
    
    const playerName = piece.player === 'player' ? 'Tú' : 'Bot';
    const action = isAttack ? 'atacó' : 'movió';
    const targetInfo = isAttack && targetPiece ? ` a ${targetPiece.name}` : '';
    
    moveItem.innerHTML = `
        <span class="move-turn">${gameState.totalMoves}.</span>
        <span class="move-player">${playerName}</span>
        <span class="move-action">${action}</span>
        <span class="move-piece">${piece.name}</span>
        <span class="move-from">(${from.row},${from.col})</span>
        <span class="move-to">→ (${to.row},${to.col})</span>
        <span class="move-target">${targetInfo}</span>
    `;
    
    moveHistory.appendChild(moveItem);
    moveHistory.scrollTop = moveHistory.scrollHeight;
}

function hideCombatModal() {
    const modal = document.getElementById('combat-modal');
    if (modal) modal.classList.add('hidden');
}

function endGame(winner, reason) {
    gameState.gameActive = false;
    
    const gameDuration = Date.now() - gameState.gameStartTime;
    const minutes = Math.floor(gameDuration / 60000);
    const seconds = Math.floor((gameDuration % 60000) / 1000);
    
    const victoryMessages = {
        'flag_capture': 'Bandera Capturada',
        'surrender': 'Rendición',
        'annihilation': 'Todas las piezas móviles eliminadas'
    };
    
    const message = winner === 'player' ? 
        `🎉 ¡VICTORIA! (${victoryMessages[reason] || reason})` :
        `💀 ¡DERROTA! (${victoryMessages[reason] || reason})`;
    
    addGameMessage(`=== ${message} ===`);
    addGameMessage(`Duración: ${minutes}:${seconds.toString().padStart(2, '0')} | Movimientos: ${gameState.totalMoves}`);
    addGameMessage(`Piezas restantes: Tú ${gameState.playerPiecesRemaining} - Op ${gameState.opponentPiecesRemaining}`);
    
    const gameResult = {
        winner: winner,
        reason: reason,
        duration: gameDuration,
        moves: gameState.totalMoves,
        playerPiecesRemaining: gameState.playerPiecesRemaining,
        opponentPiecesRemaining: gameState.opponentPiecesRemaining,
        date: new Date().toISOString()
    };
    
    localStorage.setItem('last_game_result', JSON.stringify(gameResult));
    
    setTimeout(() => {
        showGameOverModal(winner, reason, minutes, seconds);
    }, 1500);
}

function showGameOverModal(winner, reason, minutes, seconds) {
    const modal = document.getElementById('game-over-modal');
    if (!modal) return;
    
    const victoryMessages = {
        'flag_capture': 'Capturaste la bandera enemiga',
        'surrender': 'Te rendiste ante el oponente',
        'annihilation': 'Eliminaste todas las piezas móviles enemigas'
    };
    
    const defeatMessages = {
        'flag_capture': 'El enemigo capturó tu bandera',
        'surrender': 'Te rendiste',
        'annihilation': 'El enemigo eliminó todas tus piezas móviles'
    };
    
    const resultMessage = winner === 'player' ? 
        victoryMessages[reason] || reason :
        defeatMessages[reason] || reason;
    
    modal.innerHTML = `
        <div class="modal-content">
            <h2>${winner === 'player' ? '🎉 ¡VICTORIA!' : '💀 ¡DERROTA!'}</h2>
            
            <div class="victory-details">
                <p><strong>Razón:</strong> ${resultMessage}</p>
                <p><strong>Duración:</strong> ${minutes}:${seconds.toString().padStart(2, '0')}</p>
                <p><strong>Movimientos:</strong> ${gameState.totalMoves}</p>
                <p><strong>Piezas restantes:</strong> Tú ${gameState.playerPiecesRemaining} - Op ${gameState.opponentPiecesRemaining}</p>
            </div>
            
            <div class="modal-footer">
                <button class="btn-success" onclick="goToPostGame()">
                    Ver Resultados Detallados
                </button>
                <button class="btn-primary" onclick="returnToLobby()">
                    Volver al Lobby
                </button>
                <button class="btn-secondary" onclick="hideGameOverModal()">
                    Seguir Viendo Tablero
                </button>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

function hideGameOverModal() {
    const modal = document.getElementById('game-over-modal');
    if (modal) modal.classList.add('hidden');
}

// Funciones globales para acceso desde HTML
window.goToPostGame = function() {
    window.location.href = 'postgame.html';
};

window.returnToLobby = function() {
    if (confirm('¿Volver al lobby? Se perderá el progreso no guardado.')) {
        localStorage.removeItem('current_game');
        localStorage.removeItem('game_deployment');
        window.location.href = 'index.html';
    }
};

window.hideCombatModal = hideCombatModal;
window.hideGameOverModal = hideGameOverModal;

// Exportar para acceso global
window.gameState = gameState;
window.gameFunctions = {
    initializeGame,
    selectPiece,
    executeMove,
    endGame
};

// Inicializar temporizador de juego
setInterval(() => {
    if (gameState.gameActive) {
        updateGameTimer();
    }
}, 1000);


/**
 * Muestra todas las piezas del oponente por 5 segundos
 */
function revealOpponentPieces() {
    if (window.showAllOpponentPieces) return; // Ya está activo
    
    window.showAllOpponentPieces = true;
    updateAllCellsDisplay();
    
    // Actualizar botón
    const revealBtn = document.getElementById('reveal-opponent-btn');
    if (revealBtn) {
        revealBtn.disabled = true;
        revealBtn.innerHTML = '👁️ VISIÓN ACTIVA (5s)';
    }
    
    // Después de 5 segundos, ocultar de nuevo
    setTimeout(() => {
        window.showAllOpponentPieces = false;
        updateAllCellsDisplay();
        
        // Restaurar botón
        if (revealBtn) {
            revealBtn.disabled = false;
            revealBtn.innerHTML = '👁️ VER PIEZAS ENEMIGAS';
        }
    }, 5000);
}

/**
 * Actualiza todas las celdas del tablero
 */
function updateAllCellsDisplay() {
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
            updateCellDisplay(row, col);
        }
    }
}


console.log('game.js cargado correctamente con soporte para 10 o 40 piezas');