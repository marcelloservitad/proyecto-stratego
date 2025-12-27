// Variables de configuración
let pieceInventory = null;
let draggedPiece = null;
let currentFormation = null;
let playerReady = false;
let opponentReady = false;

// Inicializar configuración
function initializeConfig() {
    // Cargar estado del juego
    loadGameState();
    
    // Inicializar inventario según el tipo de juego
    const gameType = AppState.currentGame.gameType;
    pieceInventory = new PieceInventory(gameType);
    
    // Crear tablero de despliegue
    createDeploymentBoard();
    
    // Mostrar piezas en el inventario
    renderPieceInventory();
    
    // Configurar drag and drop
    setupDragAndDrop();
    
    // Configurar event listeners
    setupConfigEventListeners();
    
    // Actualizar displays
    updateGameInfo();
    updateProtocolDisplay();
}

function loadGameState() {
    const savedGame = localStorage.getItem('current_game');
    if (savedGame) {
        AppState.currentGame = JSON.parse(savedGame);
    }
}

function createDeploymentBoard() {
    const board = document.getElementById('player-board');
    board.innerHTML = '';
    
    // Crear tablero 10x4 (las primeras 4 filas del jugador)
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 10; col++) {
            const cell = document.createElement('div');
            cell.className = 'board-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            // Marcar lagos (posiciones fijas donde no se pueden colocar piezas)
            if ((row === 2 || row === 3) && (col === 2 || col === 3 || col === 6 || col === 7)) {
                cell.classList.add('lake');
                cell.title = 'Lago - No transitable';
            } else {
                cell.classList.add('valid');
                cell.addEventListener('dragover', handleDragOver);
                cell.addEventListener('drop', handleDrop);
                cell.addEventListener('dragenter', handleDragEnter);
                cell.addEventListener('dragleave', handleDragLeave);
            }
            
            board.appendChild(cell);
        }
    }
}

function renderPieceInventory() {
    const piecesList = document.getElementById('pieces-list');
    piecesList.innerHTML = '';
    
    const availablePieces = pieceInventory.getAvailablePieces();
    
    availablePieces.forEach(piece => {
        const pieceElement = createPieceElement(piece);
        piecesList.appendChild(pieceElement);
    });
}

function createPieceElement(piece) {
    const div = document.createElement('div');
    div.className = 'piece-item';
    div.draggable = true;
    div.dataset.pieceId = piece.id;
    
    div.innerHTML = `
        <div class="piece-icon">${piece.rank === -1 ? '🏁' : '🪖'}</div>
        <div class="piece-info">
            <div class="piece-name">${piece.name}</div>
            <div class="piece-rank">Rango: ${piece.rank > 0 ? piece.rank : 'Especial'}</div>
        </div>
    `;
    
    div.addEventListener('dragstart', handleDragStart);
    div.addEventListener('dragend', handleDragEnd);
    
    return div;
}

function setupDragAndDrop() {
    // Configurar eventos globales
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    
    document.addEventListener('drop', (e) => {
        e.preventDefault();
    });
}

function handleDragStart(e) {
    draggedPiece = e.target.dataset.pieceId;
    e.dataTransfer.setData('text/plain', draggedPiece);
    e.target.classList.add('dragging');
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedPiece = null;
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDragEnter(e) {
    if (e.target.classList.contains('valid')) {
        e.target.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    e.target.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.target.classList.remove('drag-over');
    
    if (!draggedPiece || !e.target.classList.contains('valid')) return;
    
    const piece = pieceInventory.getPieceById(draggedPiece);
    if (!piece) return;
    
    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);
    
    // Verificar si la casilla ya está ocupada
    const existingPiece = getPieceAtPosition(row, col);
    if (existingPiece) {
        // Intercambiar posiciones
        existingPiece.position = null;
        piece.position = { row, col };
        
        // Mover la pieza existente de vuelta al inventario
        renderPieceInventory();
    } else {
        // Colocar la pieza
        piece.position = { row, col };
    }
    
    // Actualizar la visualización
    updateBoardDisplay();
    
    // Verificar si el despliegue está completo
    checkDeploymentComplete();
}

function getPieceAtPosition(row, col) {
    return pieceInventory.getPlacedPieces().find(piece => 
        piece.position && 
        piece.position.row === row && 
        piece.position.col === col
    );
}

function updateBoardDisplay() {
    const cells = document.querySelectorAll('.board-cell:not(.lake)');
    
    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const piece = getPieceAtPosition(row, col);
        
        if (piece) {
            cell.className = 'board-cell occupied';
            cell.innerHTML = `
                <div class="piece-on-board" data-piece-id="${piece.id}">
                    <span class="piece-symbol">${piece.rank === -1 ? '🏁' : '🪖'}</span>
                    <span class="piece-name">${piece.name}</span>
                </div>
            `;
            
            // Hacer las piezas en el tablero también arrastrables
            const pieceElement = cell.querySelector('.piece-on-board');
            pieceElement.draggable = true;
            pieceElement.addEventListener('dragstart', handleDragStart);
            pieceElement.addEventListener('dragend', handleDragEnd);
        } else {
            cell.className = 'board-cell valid';
            cell.innerHTML = '';
        }
    });
}

function setupConfigEventListeners() {
    // Botón de despliegue aleatorio
    document.getElementById('randomize-btn').addEventListener('click', randomizeDeployment);
    
    // Botón de guardar formación
    document.getElementById('save-formation-btn').addEventListener('click', saveFormation);
    
    // Botón de cargar formación
    document.getElementById('load-formation-btn').addEventListener('click', loadFormationsModal);
    
    // Botón de listo
    document.getElementById('ready-btn').addEventListener('click', toggleReady);
    
    // Botón de retirarse
    document.getElementById('cancel-game').addEventListener('click', cancelGame);
    
    // Chat privado
    document.getElementById('send-private-message').addEventListener('click', sendPrivateMessage);
    document.getElementById('private-message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendPrivateMessage();
    });
}

function randomizeDeployment() {
    // Limpiar todas las posiciones actuales
    pieceInventory.getPlacedPieces().forEach(piece => {
        piece.position = null;
    });
    
    // Obtener todas las celdas válidas
    const validCells = Array.from(document.querySelectorAll('.board-cell.valid'));
    
    // Mezclar las celdas
    for (let i = validCells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [validCells[i], validCells[j]] = [validCells[j], validCells[i]];
    }
    
    // Colocar cada pieza en una celda aleatoria
    const pieces = pieceInventory.getAvailablePieces();
    pieces.forEach((piece, index) => {
        if (index < validCells.length) {
            const cell = validCells[index];
            piece.position = {
                row: parseInt(cell.dataset.row),
                col: parseInt(cell.dataset.col)
            };
        }
    });
    
    // Actualizar displays
    updateBoardDisplay();
    renderPieceInventory();
    checkDeploymentComplete();
}

function saveFormation() {
    if (!pieceInventory.isDeploymentComplete()) {
        alert('¡Completa el despliegue primero!');
        return;
    }
    
    const formationName = prompt('Nombre para esta formación:', 
        `Formación_${new Date().toLocaleDateString()}`);
    
    if (formationName) {
        const formation = {
            name: formationName,
            date: new Date().toISOString(),
            pieces: pieceInventory.getPlacedPieces().map(piece => ({
                type: piece.type,
                position: piece.position
            }))
        };
        
        // Guardar en localStorage
        const savedFormations = JSON.parse(localStorage.getItem('saved_formations') || '[]');
        savedFormations.push(formation);
        localStorage.setItem('saved_formations', JSON.stringify(savedFormations));
        
        alert(`Formación "${formationName}" guardada exitosamente.`);
    }
}

function loadFormationsModal() {
    const savedFormations = JSON.parse(localStorage.getItem('saved_formations') || '[]');
    const modalContent = document.getElementById('saved-formations-list');
    
    if (savedFormations.length === 0) {
        modalContent.innerHTML = '<p>No hay formaciones guardadas.</p>';
    } else {
        modalContent.innerHTML = savedFormations.map((formation, index) => `
            <div class="formation-item" data-index="${index}">
                <h4>${formation.name}</h4>
                <p>Guardada: ${new Date(formation.date).toLocaleDateString()}</p>
                <button class="btn-secondary" onclick="loadFormation(${index})">
                    Cargar
                </button>
                <button class="btn-danger" onclick="deleteFormation(${index})">
                    Eliminar
                </button>
            </div>
        `).join('');
    }
    
    document.getElementById('formations-modal').classList.remove('hidden');
}

function closeFormationsModal() {
    document.getElementById('formations-modal').classList.add('hidden');
}

function loadFormation(index) {
    const savedFormations = JSON.parse(localStorage.getItem('saved_formations') || '[]');
    if (savedFormations[index]) {
        // Limpiar despliegue actual
        pieceInventory.getPlacedPieces().forEach(piece => {
            piece.position = null;
        });
        
        // Aplicar formación guardada
        const formation = savedFormations[index];
        formation.pieces.forEach(pieceData => {
            const piece = pieceInventory.pieces.find(p => p.type === pieceData.type && !p.position);
            if (piece) {
                piece.position = pieceData.position;
            }
        });
        
        updateBoardDisplay();
        renderPieceInventory();
        checkDeploymentComplete();
        closeFormationsModal();
    }
}

function deleteFormation(index) {
    if (confirm('¿Eliminar esta formación permanentemente?')) {
        const savedFormations = JSON.parse(localStorage.getItem('saved_formations') || '[]');
        savedFormations.splice(index, 1);
        localStorage.setItem('saved_formations', JSON.stringify(savedFormations));
        loadFormationsModal(); // Recargar la lista
    }
}

function toggleReady() {
    if (!pieceInventory.isDeploymentComplete()) {
        alert('¡Debes colocar todas las piezas primero!');
        return;
    }
    
    playerReady = !playerReady;
    updateReadyStatus();
    
    // Enviar estado al servidor
    const message = {
        type: 'player_ready',
        ready: playerReady,
        deployment: pieceInventory.getPlacedPieces().map(p => ({
            type: p.type,
            position: p.position
        })),
        gameId: AppState.currentGame.id
    };
    
    if (AppState.currentGame.mode === 'pvp') {
        Comms.sendMessage(message);
    }
    
    // En PvE, el bot siempre está listo automáticamente
    if (AppState.currentGame.mode === 'pve' && playerReady) {
        setTimeout(() => {
            opponentReady = true;
            updateReadyStatus();
            checkBothReady();
        }, 1000);
    }
}

function updateReadyStatus() {
    const playerStatus = document.getElementById('player-status');
    const opponentStatus = document.getElementById('opponent-status');
    const readyBtn = document.getElementById('ready-btn');
    
    playerStatus.className = `status-value ${playerReady ? 'ready' : 'not-ready'}`;
    playerStatus.innerHTML = playerReady ? '✅ Listo' : '❌ No listo';
    
    opponentStatus.className = `status-value ${opponentReady ? 'ready' : 'not-ready'}`;
    opponentStatus.innerHTML = opponentReady ? '✅ Listo' : '❌ No listo';
    
    readyBtn.textContent = playerReady ? '🔄 CANCELAR LISTO' : '⚡ MARCAR COMO LISTO';
    readyBtn.className = playerReady ? 'btn-warning btn-large' : 'btn-success btn-large';
}

function checkBothReady() {
    if (playerReady && opponentReady) {
        // Guardar el despliegue final
        saveFinalDeployment();
        
        // Redirigir al juego
        setTimeout(() => {
            window.location.href = 'game.html';
        }, 1500);
    }
}

function saveFinalDeployment() {
    const deployment = {
        gameId: AppState.currentGame.id,
        player: AppState.user.id,
        pieces: pieceInventory.getPlacedPieces().map(piece => ({
            id: piece.id,
            type: piece.type,
            position: piece.position,
            player: 'player'
        })),
        timestamp: Date.now()
    };
    
    localStorage.setItem('game_deployment', JSON.stringify(deployment));
}

function checkDeploymentComplete() {
    const complete = pieceInventory.isDeploymentComplete();
    const readyBtn = document.getElementById('ready-btn');
    
    if (complete) {
        readyBtn.disabled = false;
        readyBtn.title = 'Tu ejército está listo para la batalla';
    } else {
        readyBtn.disabled = true;
        readyBtn.title = 'Coloca todas las piezas primero';
    }
}

function updateGameInfo() {
    document.getElementById('game-mode-display').textContent = 
        AppState.currentGame.gameType === 'classic' ? 
        'Guerra Clásica (40 piezas)' : 'Duelo Rápido (10 piezas)';
    
    document.getElementById('opponent-info').textContent = 
        `vs ${AppState.currentGame.opponent.username}`;
}

function updateProtocolDisplay() {
    const mainProtocol = document.getElementById('main-protocol');
    const secondaryProtocol = document.getElementById('secondary-protocol');
    
    if (AppState.connection.protocolMode === 'SOCKET_FIRST') {
        mainProtocol.textContent = 'WebSockets (Movimientos)';
        secondaryProtocol.textContent = 'Fetch + SSE (Chat)';
    } else {
        mainProtocol.textContent = 'Fetch + SSE (Movimientos)';
        secondaryProtocol.textContent = 'WebSockets (Chat)';
    }
}

function sendPrivateMessage() {
    const input = document.getElementById('private-message-input');
    const message = input.value.trim();
    
    if (message && AppState.currentGame.mode === 'pvp') {
        Comms.sendChatMessage({
            type: 'private_chat',
            message: message,
            to: AppState.currentGame.opponent.id
        });
        
        addPrivateChatMessage(AppState.user.username, message, true);
        input.value = '';
    }
}

function addPrivateChatMessage(sender, message, isOwn) {
    const chatMessages = document.getElementById('private-chat-messages');
    const messageDiv = document.createElement('div');
    
    messageDiv.className = `message ${isOwn ? 'sender' : 'player'}`;
    messageDiv.innerHTML = `
        <strong>${sender}:</strong> ${message}
        <span class="message-time">${new Date().toLocaleTimeString()}</span>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function cancelGame() {
    if (confirm('¿Retirarse antes de la batalla?')) {
        if (AppState.currentGame.mode === 'pvp') {
            Comms.sendMessage({
                type: 'player_quit',
                gameId: AppState.currentGame.id
            });
        }
        
        // Limpiar y volver al lobby
        localStorage.removeItem('current_game');
        localStorage.removeItem('game_deployment');
        window.location.href = 'index.html';
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('config.html')) {
        initializeConfig();
    }
});