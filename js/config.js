// Variables de configuración
let pieceInventory = null;
let draggedPieceId = null;
let currentFormation = null;
let playerReady = false;
let opponentReady = false;

// Configura el tablero de despliegue, inventario de piezas y eventos para la preparación de la batalla
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
    
    // Cargar formaciones guardadas en el selector
    loadSavedFormationsToSelector();
}

// Carga el estado del juego desde localStorage
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

// Configura los eventos globales de drag and drop
function setupDragAndDrop() {
    // Configurar eventos globales
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    
    document.addEventListener('drop', (e) => {
        e.preventDefault();
    });
}

// Maneja el inicio del arrastre de una pieza
function handleDragStart(e) {
    draggedPieceId = e.currentTarget.id;
    e.dataTransfer.setData('text/plain', draggedPieceId);
    e.currentTarget.classList.add('dragging');
}

// Limpia el estado después de arrastrar
function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    draggedPieceId = null;
}

// Permite el soltado al prevenir el comportamiento por defecto
function handleDragOver(e) {
    e.preventDefault();
}

// Resalta la celda cuando una pieza arrastrada entra en ella
function handleDragEnter(e) {
    if (e.currentTarget.classList.contains('valid')) {
        e.currentTarget.classList.add('drag-over');
    }
}

// Quita el resaltado de la celda cuando la pieza sale
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
            
            // Crear elemento de pieza para el tablero (más pequeño)
            const pieceElement = document.createElement('div');
            pieceElement.className = 'piece-on-board';
            
            const imageSrc = piece.image || 'assets/default-piece.png';
            const pieceBadge = piece.rank > 0 ? piece.rank : '';
            
            pieceElement.innerHTML = `
                <div class="piece-content">
                    <img src="${imageSrc}" alt="${piece.name}" class="piece-img" draggable="false">
                    <div class="piece-badge">${pieceBadge}</div>
                </div>
                <div class="piece-label">${piece.name}</div>
            `;
            
            pieceElement.draggable = true;
            pieceElement.id = piece.id;
            pieceElement.addEventListener('dragstart', handleDragStart);
            pieceElement.addEventListener('dragend', handleDragEnd);
            
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
    
    // Botones de formaciones - ¡ESTOS FALTABAN!
    const saveFormationBtn = document.getElementById('save-formation-btn');
    if (saveFormationBtn) {
        saveFormationBtn.addEventListener('click', saveFormation);
    }
    
    const loadFormationBtn = document.getElementById('load-formation-btn');
    if (loadFormationBtn) {
        loadFormationBtn.addEventListener('click', loadFormationsModal);
    }
}

/**
 * Distribuye todas las piezas en el tablero de forma aleatoria.
 
 */
function randomizeDeployment() {
    //  Limpiamos posiciones previas de TODAS las piezas para empezar de cero
    pieceInventory.pieces.forEach((piece) => {
        piece.position = null;
    });

    //  Obtenemos todas las piezas y todas las celdas del tablero
    const allPieces = pieceInventory.pieces;
    const allCells = Array.from(document.querySelectorAll('.board-cell.valid'));

    //  Mezclamos el array de celdas 
    for (let i = allCells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        // Intercambio de elementos (Destructuring assignment)
        [allCells[i], allCells[j]] = [allCells[j], allCells[i]];
    }

    //  Asignamos cada pieza a una celda mezclada
    allPieces.forEach((piece, index) => {
        if (index < allCells.length) {
            const cell = allCells[index];
            piece.position = {
                row: parseInt(cell.dataset.row),
                col: parseInt(cell.dataset.col)
            };
        }
    });

    //  Refrescamos la interfaz
    updateBoardDisplay();
    renderPieceInventory();
    checkDeploymentComplete();
}

/**
 * Guarda la formación actual en localStorage.
 */
function saveFormation() {
    if (!pieceInventory.isDeploymentComplete()) {
        alert('¡Completa el despliegue primero!');
        return;
    }
    
    const formationName = prompt('Nombre para esta formación:', 
        `Formación_${new Date().toLocaleDateString('es-ES')}`);
    
    if (!formationName) {
        return; // El usuario canceló
    }
    
    // Obtener todas las piezas colocadas
    const placedPieces = pieceInventory.getPlacedPieces();
    
    // Crear un objeto de formación que solo guarda la información esencial
    const formation = {
        name: formationName,
        date: new Date().toISOString(),
        gameType: AppState.currentGame.gameType,
        pieces: placedPieces.map(piece => ({
            type: piece.type,
            name: piece.name,
            rank: piece.rank,
            position: { ...piece.position } // Copia del objeto posición
        }))
    };
    
    // Guardar en localStorage
    const savedFormations = JSON.parse(localStorage.getItem('saved_formations') || '[]');
    
    // Verificar si ya existe una formación con ese nombre
    const existingIndex = savedFormations.findIndex(f => f.name === formationName);
    
    if (existingIndex !== -1) {
        if (confirm(`¿Reemplazar la formación "${formationName}" existente?`)) {
            savedFormations[existingIndex] = formation;
        } else {
            return; // Usuario canceló
        }
    } else {
        savedFormations.push(formation);
    }
    
    localStorage.setItem('saved_formations', JSON.stringify(savedFormations));
    
    alert(`Formación "${formationName}" guardada exitosamente.`);
    
    // Actualizar el selector de formaciones
    loadSavedFormationsToSelector();
}

/**
 * Carga las formaciones guardadas en el selector dropdown.
 */
function loadSavedFormationsToSelector() {
    const formationSelector = document.getElementById('saved-formations');
    if (!formationSelector) return;
    
    const savedFormations = JSON.parse(localStorage.getItem('saved_formations') || '[]');
    
    // Limpiar opciones excepto la primera
    formationSelector.innerHTML = '<option value="">Formaciones guardadas...</option>';
    
    // Agregar las formaciones guardadas
    savedFormations.forEach((formation, index) => {
        const date = new Date(formation.date).toLocaleDateString('es-ES');
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${formation.name} (${date}) - ${formation.gameType === 'quick' ? '10 piezas' : '40 piezas'}`;
        formationSelector.appendChild(option);
    });
    
    // Agregar evento para cargar formación seleccionada
    formationSelector.addEventListener('change', function() {
        if (this.value !== '') {
            loadFormation(parseInt(this.value));
            this.value = ''; // Resetear selector
        }
    });
}

/**
 * Muestra el modal con las formaciones guardadas.
 */
function loadFormationsModal() {
    const savedFormations = JSON.parse(localStorage.getItem('saved_formations') || '[]');
    const modalContent = document.getElementById('saved-formations-list');
    const modal = document.getElementById('formations-modal');
    
    if (!modalContent || !modal) return;
    
    if (savedFormations.length === 0) {
        modalContent.innerHTML = '<p class="empty-formations">No hay formaciones guardadas.</p>';
    } else {
        modalContent.innerHTML = savedFormations.map((formation, index) => {
            const date = new Date(formation.date).toLocaleDateString('es-ES');
            const pieceCount = formation.pieces.length;
            const gameType = formation.gameType === 'quick' ? 'Duelo Rápido (10)' : 'Guerra Clásica (40)';
            
            return `
                <div class="formation-item" data-index="${index}">
                    <h4>${formation.name}</h4>
                    <p>${date} | ${gameType} piezas | ${pieceCount} colocadas</p>
                    <div class="formation-actions">
                        <button class="btn-secondary" onclick="window.loadFormation(${index})">
                            Cargar
                        </button>
                        <button class="btn-danger" onclick="window.deleteFormation(${index})">
                            Eliminar
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    modal.classList.remove('hidden');
}

/**
 * Carga una formación específica desde localStorage.
 * @param {number} index - Índice de la formación a cargar.
 */
function loadFormation(index) {
    const savedFormations = JSON.parse(localStorage.getItem('saved_formations') || '[]');
    if (!savedFormations[index]) {
        alert('Formación no encontrada');
        return;
    }
    
    const formation = savedFormations[index];
    
    // Verificar que el tipo de juego coincide
    if (formation.gameType !== AppState.currentGame.gameType) {
        alert(`Esta formación es para ${formation.gameType === 'quick' ? 'Duelo Rápido' : 'Guerra Clásica'}. No coincide con el modo actual.`);
        return;
    }
    
    // Limpiar despliegue actual
    pieceInventory.pieces.forEach(piece => {
        piece.position = null;
    });
    
    // Aplicar formación guardada
    let loadedCount = 0;
    formation.pieces.forEach(pieceData => {
        // Buscar una pieza del mismo tipo que no tenga posición
        const piece = pieceInventory.pieces.find(p => 
            p.type === pieceData.type && !p.position
        );
        
        if (piece) {
            piece.position = { ...pieceData.position };
            loadedCount++;
        }
    });
    
    if (loadedCount < formation.pieces.length) {
        console.warn(`No se pudieron cargar todas las piezas. Cargadas: ${loadedCount}/${formation.pieces.length}`);
    }
    
    updateBoardDisplay();
    renderPieceInventory();
    checkDeploymentComplete();
    
    // Cerrar modal si está abierto
    const modal = document.getElementById('formations-modal');
    if (modal) modal.classList.add('hidden');
    
    alert(`Formación "${formation.name}" cargada (${loadedCount} piezas)`);
}

/**
 * Elimina una formación guardada.
 * @param {number} index - Índice de la formación a eliminar.
 */
function deleteFormation(index) {
    if (!confirm('¿Eliminar esta formación permanentemente?')) {
        return;
    }
    
    const savedFormations = JSON.parse(localStorage.getItem('saved_formations') || '[]');
    
    if (index >= 0 && index < savedFormations.length) {
        const formationName = savedFormations[index].name;
        savedFormations.splice(index, 1);
        localStorage.setItem('saved_formations', JSON.stringify(savedFormations));
        
        // Recargar la lista en el modal
        loadFormationsModal();
        // Actualizar el selector
        loadSavedFormationsToSelector();
        
        alert(`Formación "${formationName}" eliminada.`);
    }
}

/**
 * Cierra el modal de formaciones.
 */
function closeFormationsModal() {
    const modal = document.getElementById('formations-modal');
    if (modal) modal.classList.add('hidden');
}

// Alterna el estado de listo del jugador y gestiona la respuesta del bot
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

// Actualiza la interfaz con el estado de listo del jugador y oponente
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

// Guarda el despliegue final en localStorage y prepara el inicio de la batalla
function saveFinalDeployment() {
    const deployment = {
        gameId: AppState.currentGame.id,
        player: AppState.user ? AppState.user.id : 'invitado',
        gameType: AppState.currentGame.gameType,
        pieces: pieceInventory.getPlacedPieces().map(piece => ({
            id: piece.id,
            type: piece.type,
            name: piece.name,
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

// Verifica si todas las piezas están colocadas y habilita el botón de listo
function checkDeploymentComplete() {
    const isComplete = pieceInventory.isDeploymentComplete();
    const readyBtn = document.getElementById('ready-btn');
    if (readyBtn) {
        readyBtn.disabled = !isComplete;
    }
}

// Actualiza la información del juego y oponente en la interfaz
function updateGameInfo() {
    const gameModeDisplay = document.getElementById('game-mode-display');
    const opponentInfo = document.getElementById('opponent-info');
    
    if (gameModeDisplay) {
        gameModeDisplay.textContent = 
            AppState.currentGame.gameType === 'classic' ? 
            'Guerra Clásica (40 piezas)' : 'Duelo Rápido (10 piezas)';
    }
    
    if (opponentInfo && AppState.currentGame.opponent) {
        opponentInfo.textContent = 
            `vs ${AppState.currentGame.opponent.username || 'Oponente'}`;
    }
}

// Muestra el protocolo de comunicación activo en la interfaz
function updateProtocolDisplay() {
    const mainProtocol = document.getElementById('main-protocol');
    const secondaryProtocol = document.getElementById('secondary-protocol');
    
    if (AppState.connection.protocolMode === 'SOCKET_FIRST') {
        if (mainProtocol) mainProtocol.textContent = 'WebSockets (Movimientos)';
        if (secondaryProtocol) secondaryProtocol.textContent = 'Fetch + SSE (Chat)';
    } else {
        if (mainProtocol) mainProtocol.textContent = 'Fetch + SSE (Movimientos)';
        if (secondaryProtocol) secondaryProtocol.textContent = 'WebSockets (Chat)';
    }
}

// Hacer funciones disponibles globalmente para los onclick en HTML
window.loadFormation = loadFormation;
window.deleteFormation = deleteFormation;
window.closeFormationsModal = closeFormationsModal;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('config.html')) {
        initializeConfig();
    }
});