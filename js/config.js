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


/**
 * Crea la cuadrícula de 10x4 para el despliegue del jugador.
 * En esta zona todas las celdas son válidas para colocar piezas.
 */
function createDeploymentBoard() {
    const board = document.getElementById('player-board');
    if (!board) {
        return;
    }
    board.innerHTML = '';
    
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 10; col++) {
            const cell = document.createElement('div');
            // Todas las celdas en la zona de despliegue son válidas
            cell.className = 'board-cell valid';
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            // Registramos los eventos para permitir el drag and drop
            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('drop', handleDrop);
            cell.addEventListener('dragenter', handleDragEnter);
            cell.addEventListener('dragleave', handleDragLeave);
            
            board.appendChild(cell);
        }
    }
}


/**
 * Renderiza la lista de piezas disponibles en el inventario lateral.
 */

function renderPieceInventory() {
    const piecesList = document.getElementById('pieces-list');
    if (!piecesList) {
        return;
    }
    piecesList.innerHTML = '';
    
    // Solo mostramos piezas que NO tienen una posición asignada
    const availablePieces = pieceInventory.getAvailablePieces();
    
    availablePieces.forEach((piece) => {
        const pieceElement = createPieceElement(piece);
        piecesList.appendChild(pieceElement);
    });
}



/**
 * Crea el elemento visual de una pieza para el inventario.
 * @param {Piece} piece - Objeto de la pieza.
 */


function createPieceElement(piece) {
    const div = document.createElement('div');
    div.className = 'piece-item';
    div.draggable = true;
    div.id = piece.id; 

    const imageSrc = piece.image || 'assets/default-piece.png';
    
    // Usamos una estructura más compacta
    div.innerHTML = `
        <div class="piece-content">
            <img src="${imageSrc}" alt="${piece.name}" class="piece-img" draggable="false">
            <div class="piece-badge">${piece.rank > 0 ? piece.rank : ''}</div>
        </div>
        <div class="piece-label">
            <span class="name">${piece.name}</span>
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
    draggedPieceId = e.currentTarget.id;
    e.dataTransfer.setData('text/plain', draggedPieceId);
    e.currentTarget.classList.add('dragging');
}

function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    draggedPieceId = null;
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDragEnter(e) {
    if (e.currentTarget.classList.contains('valid')) {
        e.currentTarget.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}


/**
 * Maneja el evento de soltar una pieza en una celda del tablero.
 */
function handleDrop(e) {
    e.preventDefault();
    const cell = e.currentTarget;
    cell.classList.remove('drag-over');
    
    const pieceId = e.dataTransfer.getData('text/plain');
    const piece = pieceInventory.getPieceById(pieceId);
    
    if (!piece || !cell.classList.contains('valid')) {
        return;
    }
    
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    
    // Lógica de ocupación
    const existingPiece = getPieceAtPosition(row, col);
    
    if (existingPiece) {
        // Si hay una pieza, la devolvemos al inventario (le quitamos la posición)
        existingPiece.position = null;
    }
    
    // Asignamos la nueva posición a la pieza arrastrada
    piece.position = { row, col };
    
    // Actualizamos ambas vistas
    updateBoardDisplay();
    renderPieceInventory();
    checkDeploymentComplete();
}

/**
 * Busca si existe una pieza en una coordenada específica.
 */
function getPieceAtPosition(row, col) {
    return pieceInventory.getPlacedPieces().find((p) => {
        return p.position && p.position.row === row && p.position.col === col;
    });
}


/**
 * Actualiza visualmente todas las celdas del tablero.
 */

function updateBoardDisplay() {
    const cells = document.querySelectorAll('.board-cell.valid, .board-cell.occupied');
    
    cells.forEach((cell) => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const piece = getPieceAtPosition(row, col);
        
        // Limpiamos la celda siempre al empezar
        cell.innerHTML = '';
        
        if (piece) {
            cell.className = 'board-cell occupied';
            
            const pieceElement = createPieceElement(piece);
            pieceElement.classList.add('piece-on-board');
            
            cell.appendChild(pieceElement);
        } else {
            cell.className = 'board-cell valid';
        }
    });
}


/**
 * Configura los botones de acción de la interfaz.
 */
function setupConfigEventListeners() {
    const randomizeBtn = document.getElementById('randomize-btn');
    if (randomizeBtn) {
        randomizeBtn.addEventListener('click', randomizeDeployment);
    }

    const readyBtn = document.getElementById('ready-btn');
    if (readyBtn) {
        readyBtn.addEventListener('click', toggleReady);
    }
}


/**
 * Distribuye todas las piezas en el tablero de forma aleatoria.
 * Utiliza el algoritmo Fisher-Yates para garantizar aleatoriedad real.
 */
function randomizeDeployment() {
    // 1. Limpiamos posiciones previas de TODAS las piezas para empezar de cero
    pieceInventory.pieces.forEach((piece) => {
        piece.position = null;
    });

    // 2. Obtenemos todas las piezas y todas las celdas del tablero
    const allPieces = pieceInventory.pieces;
    const allCells = Array.from(document.querySelectorAll('.board-cell.valid'));

    // 3. Mezclamos el array de celdas usando Fisher-Yates
    for (let i = allCells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        // Intercambio de elementos (Destructuring assignment)
        [allCells[i], allCells[j]] = [allCells[j], allCells[i]];
    }

    // 4. Asignamos cada pieza a una celda mezclada
    allPieces.forEach((piece, index) => {
        if (index < allCells.length) {
            const cell = allCells[index];
            piece.position = {
                row: parseInt(cell.dataset.row),
                col: parseInt(cell.dataset.col)
            };
        }
    });

    // 5. Refrescamos la interfaz
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

    if (playerReady) {
        const readyBtn = document.getElementById('ready-btn');
        readyBtn.disabled = true; 
        readyBtn.textContent = '⌛ ESPERANDO AL BOT...';

        // Simulamos la respuesta del Bot
        setTimeout(() => {
            opponentReady = true;
            updateReadyStatus();
            
            setTimeout(() => {
                try {
                    console.log('Iniciando guardado y redirección...');
                    saveFinalDeployment();
                    console.log('Guardado exitoso');
                } catch (error) {
                    console.error('Error al guardar el despliegue:', error);
                }
                // Redirección al campo de batalla (Etapa 3)
                window.location.href = 'battlefield.html';
            }, 1000);
        }, 1500);
        
    } else {
        opponentReady = false;
        updateReadyStatus();
    }
}

function updateReadyStatus() {
    const playerStatus = document.getElementById('player-status');
    const opponentStatus = document.getElementById('opponent-status');
    const readyBtn = document.getElementById('ready-btn');
    
    if (playerStatus) {
        playerStatus.className = `status-value ${playerReady ? 'ready' : 'not-ready'}`;
        playerStatus.innerHTML = playerReady ? '✅ Listo' : '❌ No listo';
    }
    
    if (opponentStatus) {
        opponentStatus.className = `status-value ${opponentReady ? 'ready' : 'not-ready'}`;
        opponentStatus.innerHTML = opponentReady ? '✅ Listo' : '❌ No listo';
    }
    
    if (readyBtn && !opponentReady) {
        readyBtn.disabled = !pieceInventory.isDeploymentComplete();
        readyBtn.textContent = playerReady ? '🔄 CANCELAR LISTO' : '⚡ MARCAR COMO LISTO';
        readyBtn.className = playerReady ? 'btn-warning btn-large' : 'btn-success btn-large';
    }
}


function saveFinalDeployment() {
    const deployment = {
        gameId: AppState.currentGame.id,
        player: AppState.user ? AppState.user.id : 'invitado',
        pieces: pieceInventory.getPlacedPieces().map(piece => ({
            id: piece.id,
            type: piece.type,
            rank: piece.rank,
            position: piece.position,
            image: piece.image,
            player: 'player'
        })),
        timestamp: Date.now()
    };
    
    localStorage.setItem('game_deployment', JSON.stringify(deployment));
    AppState.currentGame.status = 'playing';
    localStorage.setItem('current_game', JSON.stringify(AppState.currentGame));
}

function checkDeploymentComplete() {
    const isComplete = pieceInventory.isDeploymentComplete();
    const readyBtn = document.getElementById('ready-btn');
    if (readyBtn) {
        readyBtn.disabled = !isComplete;
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

