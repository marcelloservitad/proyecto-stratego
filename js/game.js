// game.js - Versión simplificada y funcional

document.addEventListener('DOMContentLoaded', function() {
    // Inicializar juego
    initializeGame();
});

let gameState = {
    board: null,
    currentPlayer: 'player',
    selectedPiece: null,
    validMoves: [],
    gameActive: true
};

function initializeGame() {
    console.log('Inicializando juego...');
    
    // Crear tablero
    createGameBoard();
    
    // Cargar piezas
    loadPieces();
    
    // Configurar eventos
    setupGameEvents();
    
    // Actualizar interfaz
    updateUI();
    
    console.log('Juego inicializado');
}

function createGameBoard() {
    const boardElement = document.getElementById('game-board');
    if (!boardElement) {
        console.error('No se encontró el elemento del tablero');
        return;
    }
    
    boardElement.innerHTML = '';
    
    // Inicializar matriz del tablero
    gameState.board = new Array(10).fill().map(() => new Array(10).fill(null));
    
    // Crear celdas 10x10
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
            const cell = document.createElement('div');
            cell.className = 'board-full-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            // Marcar lagos
            if (isLakePosition(row, col)) {
                cell.classList.add('lake');
                cell.innerHTML = '🌊';
                cell.title = 'Lago - No transitable';
            } else {
                // Agregar eventos a celdas no-lago
                cell.addEventListener('click', () => handleCellClick(row, col));
                
                // Marcar territorios
                if (row < 4) {
                    cell.classList.add('opponent-territory');
                } else if (row > 5) {
                    cell.classList.add('player-territory');
                }
            }
            
            boardElement.appendChild(cell);
        }
    }
    
    console.log('Tablero creado: 10x10 celdas');
}

function isLakePosition(row, col) {
    // Lagos en filas 4-5, columnas 2-3 y 6-7
    return (row === 4 || row === 5) && (col === 2 || col === 3 || col === 6 || col === 7);
}

function loadPieces() {
    console.log('Cargando piezas...');
    
    // Cargar despliegue guardado
    const deploymentData = localStorage.getItem('game_deployment');
    if (!deploymentData) {
        console.warn('No hay despliegue guardado. Usando piezas de prueba.');
        createTestPieces();
        return;
    }
    
    try {
        const deployment = JSON.parse(deploymentData);
        const playerPieces = deployment.pieces || [];
        
        console.log(`Cargando ${playerPieces.length} piezas del jugador`);
        
        // Colocar piezas del jugador (filas 6-9)
        playerPieces.forEach((piece, index) => {
            if (piece.position) {
                const row = 9 - piece.position.row; // Invertir para vista del tablero
                const col = piece.position.col;
                
                if (row >= 6 && row < 10 && col >= 0 && col < 10 && !isLakePosition(row, col)) {
                    placePiece(row, col, {
                        type: piece.type,
                        name: piece.name || piece.type,
                        rank: piece.rank || 0,
                        player: 'player',
                        revealed: true
                    });
                }
            }
        });
        
        // Crear piezas del oponente (filas 0-3)
        createOpponentPieces();
        
    } catch (error) {
        console.error('Error al cargar piezas:', error);
        createTestPieces();
    }
}

function createTestPieces() {
    console.log('Creando piezas de prueba...');
    
    // Piezas básicas de prueba para el jugador
    const testPieces = [
        { type: 'flag', name: 'Bandera', rank: -1, row: 9, col: 0 },
        { type: 'marshal', name: 'Mariscal', rank: 10, row: 9, col: 1 },
        { type: 'general', name: 'General', rank: 9, row: 9, col: 2 },
        { type: 'scout', name: 'Explorador', rank: 2, row: 8, col: 0 },
        { type: 'scout', name: 'Explorador', rank: 2, row: 8, col: 1 },
        { type: 'bomb', name: 'Bomba', rank: 0, row: 8, col: 2 }
    ];
    
    // Colocar piezas del jugador
    testPieces.forEach(piece => {
        placePiece(piece.row, piece.col, {
            type: piece.type,
            name: piece.name,
            rank: piece.rank,
            player: 'player',
            revealed: true
        });
    });
    
    // Piezas básicas para el oponente
    const opponentPieces = [
        { type: 'flag', name: 'Bandera', rank: -1, row: 0, col: 9 },
        { type: 'marshal', name: 'Mariscal', rank: 10, row: 0, col: 8 },
        { type: 'general', name: 'General', rank: 9, row: 0, col: 7 },
        { type: 'scout', name: 'Explorador', rank: 2, row: 1, col: 9 },
        { type: 'scout', name: 'Explorador', rank: 2, row: 1, col: 8 },
        { type: 'bomb', name: 'Bomba', rank: 0, row: 1, col: 7 }
    ];
    
    // Colocar piezas del oponente
    opponentPieces.forEach(piece => {
        placePiece(piece.row, piece.col, {
            type: piece.type,
            name: piece.name,
            rank: piece.rank,
            player: 'opponent',
            revealed: false // Las piezas del oponente no están reveladas
        });
    });
}

function createOpponentPieces() {
    console.log('Creando piezas del oponente...');
    
    // Piezas básicas del oponente (filas 0-3)
    const opponentPieces = [
        { type: 'flag', name: 'Bandera', rank: -1, row: 0, col: 4 },
        { type: 'marshal', name: 'Mariscal', rank: 10, row: 0, col: 5 },
        { type: 'general', name: 'General', rank: 9, row: 1, col: 4 },
        { type: 'colonel', name: 'Coronel', rank: 8, row: 1, col: 5 },
        { type: 'major', name: 'Comandante', rank: 7, row: 2, col: 4 },
        { type: 'captain', name: 'Capitán', rank: 6, row: 2, col: 5 },
        { type: 'lieutenant', name: 'Teniente', rank: 5, row: 3, col: 4 },
        { type: 'sergeant', name: 'Sargento', rank: 4, row: 3, col: 5 },
        { type: 'miner', name: 'Minador', rank: 3, row: 0, col: 3 },
        { type: 'scout', name: 'Explorador', rank: 2, row: 1, col: 3 },
        { type: 'spy', name: 'Espía', rank: 1, row: 2, col: 3 },
        { type: 'bomb', name: 'Bomba', rank: 0, row: 3, col: 3 }
    ];
    
    opponentPieces.forEach(piece => {
        if (!isLakePosition(piece.row, piece.col)) {
            placePiece(piece.row, piece.col, {
                type: piece.type,
                name: piece.name,
                rank: piece.rank,
                player: 'opponent',
                revealed: false
            });
        }
    });
}

function placePiece(row, col, pieceData) {
    if (!gameState.board[row]) return;
    
    gameState.board[row][col] = pieceData;
    updateCellDisplay(row, col);
}

function updateCellDisplay(row, col) {
    const cell = document.querySelector(`.board-full-cell[data-row="${row}"][data-col="${col}"]`);
    if (!cell) return;
    
    // Limpiar celda
    cell.innerHTML = '';
    
    const piece = gameState.board[row][col];
    if (!piece) return;
    
    // Crear elemento de pieza
    const pieceElement = document.createElement('div');
    pieceElement.className = `game-piece ${piece.player}`;
    if (piece.revealed) pieceElement.classList.add('revealed');
    pieceElement.classList.add(piece.type);
    
    // Símbolo de la pieza
    const symbol = getPieceSymbol(piece.type);
    
    pieceElement.innerHTML = `
        <div class="piece-symbol">${symbol}</div>
        <div class="piece-rank">${piece.revealed ? piece.rank : '?'}</div>
    `;
    
    // Tooltip
    pieceElement.title = piece.revealed ? 
        `${piece.name} (Rango: ${piece.rank})` : 
        'Pieza desconocida';
    
    // Evento de clic
    pieceElement.addEventListener('click', (e) => {
        e.stopPropagation();
        handlePieceClick(row, col);
    });
    
    cell.appendChild(pieceElement);
}

function getPieceSymbol(type) {
    const symbols = {
        'marshal': '🎖️',
        'general': '⭐',
        'colonel': '🦅',
        'major': '⚔️',
        'captain': '🛡️',
        'lieutenant': '⚜️',
        'sergeant': '🔰',
        'miner': '⛏️',
        'scout': '👁️',
        'spy': '🕵️',
        'bomb': '💣',
        'flag': '🏁'
    };
    
    return symbols[type] || '❓';
}

function handleCellClick(row, col) {
    if (!gameState.gameActive || gameState.currentPlayer !== 'player') {
        return;
    }
    
    // Si hay una pieza seleccionada, intentar mover
    if (gameState.selectedPiece) {
        const move = gameState.validMoves.find(m => m.row === row && m.col === col);
        if (move) {
            executeMove(gameState.selectedPiece, { row, col });
            return;
        }
    }
    
    // Limpiar selección
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
    
    // Seleccionar pieza
    selectPiece(row, col);
}

function selectPiece(row, col) {
    const piece = gameState.board[row][col];
    if (!piece || piece.player !== 'player') {
        return;
    }
    
    // Limpiar selección anterior
    clearSelection();
    
    // Marcar como seleccionada
    gameState.selectedPiece = { row, col, piece };
    
    // Calcular movimientos válidos
    calculateValidMoves(row, col);
    
    // Actualizar UI
    updateUI();
}

function calculateValidMoves(row, col) {
    gameState.validMoves = [];
    const piece = gameState.board[row][col];
    
    if (!piece || piece.type === 'flag' || piece.type === 'bomb') {
        return;
    }
    
    // Direcciones básicas
    const directions = [
        { dr: -1, dc: 0 }, // arriba
        { dr: 1, dc: 0 },  // abajo
        { dr: 0, dc: -1 }, // izquierda
        { dr: 0, dc: 1 }   // derecha
    ];
    
    // Para explorador (puede moverse múltiples casillas)
    const maxDistance = piece.type === 'scout' ? 10 : 1;
    
    directions.forEach(dir => {
        for (let distance = 1; distance <= maxDistance; distance++) {
            const newRow = row + (dir.dr * distance);
            const newCol = col + (dir.dc * distance);
            
            if (!isValidMove(row, col, newRow, newCol)) {
                break; // Detener en esta dirección
            }
            
            const targetPiece = gameState.board[newRow][newCol];
            if (targetPiece) {
                if (targetPiece.player !== piece.player) {
                    // Puede atacar
                    gameState.validMoves.push({ 
                        row: newRow, 
                        col: newCol, 
                        type: 'attack' 
                    });
                }
                break; // No puede pasar por encima de otra pieza
            } else {
                // Movimiento vacío
                gameState.validMoves.push({ 
                    row: newRow, 
                    col: newCol, 
                    type: 'move' 
                });
            }
            
            // Si no es explorador, solo una casilla
            if (piece.type !== 'scout') break;
        }
    });
}

function isValidMove(fromRow, fromCol, toRow, toCol) {
    // Verificar límites
    if (toRow < 0 || toRow >= 10 || toCol < 0 || toCol >= 10) {
        return false;
    }
    
    // Verificar lagos
    if (isLakePosition(toRow, toCol)) {
        return false;
    }
    
    return true;
}

function executeMove(from, to) {
    const piece = gameState.board[from.row][from.col];
    const targetPiece = gameState.board[to.row][to.col];
    
    // Registrar movimiento
    logMove(piece, from, to, targetPiece);
    
    if (targetPiece) {
        // Resolver combate
        resolveCombat(piece, targetPiece, to);
    } else {
        // Mover pieza
        movePiece(from, to);
    }
    
    // Limpiar selección
    clearSelection();
    
    // Cambiar turno
    switchTurn();
    
    // Actualizar UI
    updateUI();
}

function movePiece(from, to) {
    const piece = gameState.board[from.row][from.col];
    
    // Mover en la matriz
    gameState.board[from.row][from.col] = null;
    gameState.board[to.row][to.col] = piece;
    
    // Actualizar display
    updateCellDisplay(from.row, from.col);
    updateCellDisplay(to.row, to.col);
    
    // Verificar si capturó bandera
    if (piece.type === 'flag') {
        // El juego terminaría, pero el flag no se mueve normalmente
    }
    
    console.log(`Movido ${piece.name} de (${from.row},${from.col}) a (${to.row},${to.col})`);
}

function resolveCombat(attacker, defender, position) {
    console.log(`Combate: ${attacker.name} vs ${defender.name}`);
    
    // Mostrar modal de combate
    showCombatModal(attacker, defender);
    
    // Determinar resultado
    const result = calculateCombatResult(attacker, defender);
    
    // Procesar resultado
    setTimeout(() => {
        processCombatResult(result, attacker, defender, position);
    }, 1500);
}

function calculateCombatResult(attacker, defender) {
    // Reglas básicas de Stratego
    if (defender.type === 'bomb') {
        return attacker.type === 'miner' ? 'attacker_wins' : 'defender_wins';
    }
    
    if (attacker.type === 'spy' && defender.type === 'marshal') {
        return 'attacker_wins';
    }
    
    if (attacker.rank === defender.rank) {
        return 'both_die';
    }
    
    return attacker.rank > defender.rank ? 'attacker_wins' : 'defender_wins';
}

function processCombatResult(result, attacker, defender, position) {
    hideCombatModal();
    
    switch (result) {
        case 'attacker_wins':
            removePiece(position.row, position.col); // Eliminar defensor
            movePiece(gameState.selectedPiece, position); // Mover atacante
            addGameMessage(`¡${attacker.name} derrotó a ${defender.name}!`);
            break;
            
        case 'defender_wins':
            removePiece(gameState.selectedPiece.row, gameState.selectedPiece.col); // Eliminar atacante
            revealPiece(position.row, position.col); // Revelar defensor
            addGameMessage(`¡${defender.name} derrotó a ${attacker.name}!`);
            break;
            
        case 'both_die':
            removePiece(gameState.selectedPiece.row, gameState.selectedPiece.col); // Eliminar atacante
            removePiece(position.row, position.col); // Eliminar defensor
            addGameMessage(`¡${attacker.name} y ${defender.name} se eliminaron mutuamente!`);
            break;
    }
    
    // Si la bandera fue capturada
    if (defender.type === 'flag') {
        endGame('player', 'flag_capture');
    }
}

function removePiece(row, col) {
    gameState.board[row][col] = null;
    updateCellDisplay(row, col);
}

function revealPiece(row, col) {
    const piece = gameState.board[row][col];
    if (piece) {
        piece.revealed = true;
        updateCellDisplay(row, col);
    }
}

function switchTurn() {
    gameState.currentPlayer = gameState.currentPlayer === 'player' ? 'opponent' : 'player';
    
    // Si es turno del oponente (bot), hacer movimiento automático
    if (gameState.currentPlayer === 'opponent' && gameState.gameActive) {
        setTimeout(() => botMakeMove(), 1000);
    }
    
    updateUI();
}

function botMakeMove() {
    if (!gameState.gameActive || gameState.currentPlayer !== 'opponent') {
        return;
    }
    
    // Encontrar todas las piezas del oponente que pueden moverse
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
        // No hay piezas móviles
        switchTurn();
        return;
    }
    
    // Elegir una pieza aleatoria
    const randomPiece = movablePieces[Math.floor(Math.random() * movablePieces.length)];
    
    // Calcular movimientos válidos para esta pieza
    gameState.selectedPiece = { row: randomPiece.row, col: randomPiece.col, piece: randomPiece.piece };
    calculateValidMoves(randomPiece.row, randomPiece.col);
    
    if (gameState.validMoves.length === 0) {
        // No hay movimientos válidos
        gameState.selectedPiece = null;
        gameState.validMoves = [];
        switchTurn();
        return;
    }
    
    // Elegir un movimiento aleatorio
    const randomMove = gameState.validMoves[Math.floor(Math.random() * gameState.validMoves.length)];
    
    // Ejecutar movimiento
    executeMove(
        { row: randomPiece.row, col: randomPiece.col },
        { row: randomMove.row, col: randomMove.col }
    );
}

function clearSelection() {
    // Limpiar selección visual
    document.querySelectorAll('.board-full-cell.selected').forEach(cell => {
        cell.classList.remove('selected');
    });
    
    document.querySelectorAll('.board-full-cell.valid-move, .board-full-cell.attack-target').forEach(cell => {
        cell.classList.remove('valid-move', 'attack-target');
    });
    
    // Limpiar estado
    gameState.selectedPiece = null;
    gameState.validMoves = [];
}

function updateUI() {
    // Actualizar indicador de turno
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
    
    // Actualizar contadores de piezas
    updatePieceCounters();
    
    // Actualizar celdas seleccionadas y movimientos válidos
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
                moveCell.classList.add(move.type === 'attack' ? 'attack-target' : 'valid-move');
            }
        });
    }
}

function updatePieceCounters() {
    let playerCount = 0;
    let opponentCount = 0;
    
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
            const piece = gameState.board[row][col];
            if (piece) {
                if (piece.player === 'player') playerCount++;
                else opponentCount++;
            }
        }
    }
    
    const playerCountEl = document.getElementById('player-pieces-count');
    const opponentCountEl = document.getElementById('opponent-pieces-count');
    
    if (playerCountEl) playerCountEl.textContent = playerCount;
    if (opponentCountEl) opponentCountEl.textContent = opponentCount;
}

function setupGameEvents() {
    // Botón de rendición
    const surrenderBtn = document.getElementById('surrender-btn');
    if (surrenderBtn) {
        surrenderBtn.addEventListener('click', () => {
            if (confirm('¿Rendirse y conceder la victoria al oponente?')) {
                endGame('opponent', 'surrender');
            }
        });
    }
    
    // Botón de tablas
    const drawBtn = document.getElementById('offer-draw-btn');
    if (drawBtn) {
        drawBtn.addEventListener('click', () => {
            alert('Función de tablas en desarrollo');
        });
    }
    
    // Botón de guardar
    const saveBtn = document.getElementById('save-game-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            alert('Función de guardar en desarrollo');
        });
    }
    
    // Botón de protocolo
    const protocolBtn = document.getElementById('toggle-protocol-btn');
    if (protocolBtn) {
        protocolBtn.addEventListener('click', () => {
            alert('Cambio de protocolo en desarrollo');
        });
    }
    
    // Chat
    const chatInput = document.getElementById('game-chat-input');
    const sendChatBtn = document.getElementById('send-game-chat');
    
    if (sendChatBtn && chatInput) {
        sendChatBtn.addEventListener('click', sendChatMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }
    
    // Temporizador
    startGameTimer();
}

function startGameTimer() {
    const startTime = Date.now();
    const timerElement = document.getElementById('game-timer');
    
    if (!timerElement) return;
    
    setInterval(() => {
        const elapsed = Date.now() - startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

function sendChatMessage() {
    const input = document.getElementById('game-chat-input');
    const message = input?.value.trim();
    
    if (!message) return;
    
    addChatMessage('Tú', message, true);
    
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
}

function logMove(piece, from, to, targetPiece) {
    const moveHistory = document.getElementById('move-history');
    if (!moveHistory) return;
    
    const moveItem = document.createElement('div');
    moveItem.className = 'move-item';
    
    const action = targetPiece ? 'atacó' : 'movió';
    const targetInfo = targetPiece ? ` a ${targetPiece.name}` : '';
    
    moveItem.innerHTML = `
        <span class="move-player">${piece.player === 'player' ? 'Tú' : 'Op'}</span>
        <span class="move-action">${action}</span>
        <span class="move-piece">${piece.name}</span>
        <span class="move-target">${targetInfo}</span>
    `;
    
    moveHistory.appendChild(moveItem);
    moveHistory.scrollTop = moveHistory.scrollHeight;
}

function showCombatModal(attacker, defender) {
    const modal = document.getElementById('combat-modal');
    if (!modal) return;
    
    const attackerRevealed = attacker.revealed || attacker.player === 'player';
    const defenderRevealed = defender.revealed || defender.player === 'player';
    
    modal.innerHTML = `
        <div class="modal-content">
            <h2>⚔️ ¡COMBATE!</h2>
            <div class="combat-result">
                <div class="combatant player">
                    <div class="combat-piece">${getPieceSymbol(attacker.type)}</div>
                    <div class="combat-details">
                        <h3>${attackerRevealed ? attacker.name : 'Pieza Desconocida'}</h3>
                        <p class="piece-rank">Rango: ${attackerRevealed ? attacker.rank : '?'}</p>
                    </div>
                </div>
                
                <div class="vs-text">VS</div>
                
                <div class="combatant opponent">
                    <div class="combat-piece">${getPieceSymbol(defender.type)}</div>
                    <div class="combat-details">
                        <h3>${defenderRevealed ? defender.name : 'Pieza Desconocida'}</h3>
                        <p class="piece-rank">Rango: ${defenderRevealed ? defender.rank : '?'}</p>
                    </div>
                </div>
            </div>
            
            <div class="combat-outcome" id="combat-outcome">
                <p>Calculando resultado...</p>
            </div>
            
            <div class="modal-footer">
                <button class="btn-primary" onclick="hideCombatModal()">
                    Continuar
                </button>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

function hideCombatModal() {
    const modal = document.getElementById('combat-modal');
    if (modal) modal.classList.add('hidden');
}

function endGame(winner, reason) {
    gameState.gameActive = false;
    
    const victoryMessages = {
        'flag_capture': 'Bandera Capturada',
        'surrender': 'Rendición',
        'annihilation': 'Todas las piezas eliminadas'
    };
    
    const message = winner === 'player' ? 
        `🎉 ¡VICTORIA! (${victoryMessages[reason] || reason})` :
        `💀 ¡DERROTA! (${victoryMessages[reason] || reason})`;
    
    addGameMessage(message);
    
    // Mostrar modal de fin de juego
    setTimeout(() => {
        showGameOverModal(winner, reason);
    }, 1000);
}

function showGameOverModal(winner, reason) {
    const modal = document.getElementById('game-over-modal');
    if (!modal) return;
    
    modal.innerHTML = `
        <div class="modal-content">
            <h2>${winner === 'player' ? '🎉 ¡VICTORIA!' : '💀 ¡DERROTA!'}</h2>
            
            <div class="victory-details">
                <p><strong>Razón:</strong> ${reason}</p>
            </div>
            
            <div class="modal-footer">
                <button class="btn-success" onclick="goToPostGame()">
                    Ver Resultados
                </button>
                <button class="btn-primary" onclick="returnToLobby()">
                    Volver al Lobby
                </button>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

// Funciones globales para botones del modal
window.goToPostGame = function() {
    // Guardar resultado
    const gameResult = {
        winner: gameState.currentPlayer === 'player' ? 'opponent' : 'player', // Invertir porque ya terminó
        reason: 'game_over',
        date: new Date().toISOString()
    };
    
    localStorage.setItem('last_game_result', JSON.stringify(gameResult));
    window.location.href = 'postgame.html';
};

window.returnToLobby = function() {
    localStorage.removeItem('current_game');
    localStorage.removeItem('game_deployment');
    window.location.href = 'index.html';
};

window.hideCombatModal = hideCombatModal;

// Exportar para acceso global
window.gameState = gameState;
window.gameFunctions = {
    initializeGame,
    selectPiece,
    executeMove
};