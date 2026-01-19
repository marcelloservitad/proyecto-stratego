/**
 * battlefield.js - Lógica de la escena de batalla
 */

document.addEventListener('DOMContentLoaded', () => {
    initBattlefield();
    cargarPiezasAliadas(); // Nueva función
    setupBattlefieldEventListeners();
});

const BOARD_SIZE = 10;
const LAKE_CELLS = [
    '4,2', '4,3', '5,2', '5,3', // Lago izquierdo
    '4,6', '4,7', '5,6', '5,7'  // Lago derecho
];

/**
 * Inicializa el tablero de 10x10 y define los obstáculos
 */
function initBattlefield() {
    const board = document.getElementById('battlefield');
    if (!board) return;

    board.innerHTML = ''; // Limpiar por seguridad

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const cell = document.createElement('div');
            cell.classList.add('battle-cell');
            cell.dataset.row = row;
            cell.dataset.col = col;

            // Identificar si la celda es un lago
            if (LAKE_CELLS.includes(`${row},${col}`)) {
                cell.classList.add('lake');
            } else {
                // Solo añadir eventos a las celdas que no son lagos
                cell.addEventListener('click', () => handleCellClick(row, col));
            }

            board.appendChild(cell);
        }
    }
}

/**
 * Maneja el clic en una celda (para mover piezas o atacar)
 */
function handleCellClick(row, col) {
    console.log(`Click en: Fila ${row}, Columna ${col}`);
    
    // Si existe GameManager, usar su lógica
    if (window.gameManager && typeof window.gameManager.handleCellClick === 'function') {
        window.gameManager.handleCellClick(row, col);
    } else {
        // Lógica básica para battlefield.html
        const cell = document.querySelector(`.battle-cell[data-row="${row}"][data-col="${col}"]`);
        if (cell && !cell.classList.contains('lake')) {
            // Cambiar visualmente la celda seleccionada
            document.querySelectorAll('.battle-cell.selected').forEach(c => {
                c.classList.remove('selected');
            });
            cell.classList.add('selected');
            
            // Mostrar información en el log
            addBattleLog(`Celda seleccionada: Fila ${row}, Columna ${col}`);
        }
    }
}

/**
 * Carga las piezas aliadas en el campo de batalla
 */
/**
 * Carga las piezas aliadas en el campo de batalla
 */
function cargarPiezasAliadas() {
    console.log('Cargando piezas aliadas...');
    
    // Obtener despliegue guardado
    const deploymentData = localStorage.getItem('game_deployment');
    if (!deploymentData) {
        console.error('No se encontró despliegue guardado');
        addBattleLog('Error: No se pudo cargar el despliegue de piezas', 'error');
        return;
    }
    
    let deployment;
    try {
        deployment = JSON.parse(deploymentData);
    } catch (e) {
        console.error('Error al parsear despliegue:', e);
        addBattleLog('Error: Datos de despliegue corruptos', 'error');
        return;
    }
    
    if (!deployment.pieces || !Array.isArray(deployment.pieces)) {
        console.error('Formato de despliegue inválido');
        addBattleLog('Error: Formato de despliegue inválido', 'error');
        return;
    }
    
    console.log('Despliegue cargado:', deployment.pieces.length, 'piezas');
    addBattleLog(`${deployment.pieces.length} piezas aliadas cargadas`);
    
    // Filtrar solo piezas del jugador (por si acaso)
    const playerPieces = deployment.pieces.filter(p => p.player === 'player');
    
    // Actualizar contadores
    updatePieceCounters(playerPieces.length);
    
    // Colocar piezas en el campo de batalla
    placePiecesOnBattlefield(playerPieces);
    
    // Notificar al GameManager que cargue las piezas (si está en game.html)
    if (window.gameManager && typeof window.gameManager.loadDeployment === 'function') {
        window.gameManager.loadDeployment();
    }
}
/**
 * Coloca piezas en el campo de batalla (para battlefield.html)
 */
/**
 * Coloca piezas en el campo de batalla (para battlefield.html)
 */
function placePiecesOnBattlefield(pieces) {
    console.log('Colocando', pieces.length, 'piezas en el campo de batalla');
    
    // Limpiar piezas anteriores primero
    document.querySelectorAll('.battle-cell:not(.lake) .battle-piece').forEach(p => p.remove());
    document.querySelectorAll('.battle-cell:not(.lake)').forEach(cell => {
        cell.classList.remove('occupied');
    });
    
    // Colocar cada pieza en su posición
    pieces.forEach(piece => {
        if (!piece.position) {
            console.warn('Pieza sin posición:', piece);
            return;
        }
        
        // Las piezas del jugador se despliegan en las últimas 4 filas (filas 6-9)
        // En el tablero de 10x10, fila 0 es la parte superior
        const row = 9 - piece.position.row; // Invertir porque el jugador está en la parte inferior
        const col = piece.position.col;
        
        console.log(`Colocando ${piece.name} en (${row}, ${col}) [original: (${piece.position.row}, ${piece.position.col})]`);
        
        const cell = document.querySelector(`.battle-cell[data-row="${row}"][data-col="${col}"]`);
        if (cell && !cell.classList.contains('lake')) {
            // Crear elemento de pieza
            const pieceDiv = document.createElement('div');
            pieceDiv.className = 'battle-piece player';
            pieceDiv.innerHTML = `
                <div class="piece-symbol">${getPieceSymbol(piece.type)}</div>
                <div class="piece-rank">${piece.rank > 0 ? piece.rank : '★'}</div>
            `;
            pieceDiv.title = `${piece.name} (Rango: ${piece.rank > 0 ? piece.rank : 'Especial'})`;
            cell.appendChild(pieceDiv);
            cell.classList.add('occupied');
            
            console.log(`✓ ${piece.name} colocada en celda (${row}, ${col})`);
        } else {
            console.error(`No se pudo colocar ${piece.name} en (${row}, ${col}) - celda no encontrada o es lago`);
        }
    });
    
    console.log('Colocación de piezas completada');
}
/**
 * Obtiene el símbolo de una pieza
 */
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

/**
 * Actualiza los contadores de piezas
 */
function updatePieceCounters(count) {
    const aliveCount = document.getElementById('alive-count');
    const deadCount = document.getElementById('dead-count');
    
    if (aliveCount) aliveCount.textContent = count;
    if (deadCount) deadCount.textContent = 0;
}

/**
 * Agrega mensaje al log de batalla
 */
function addBattleLog(message, type = 'info') {
    const log = document.getElementById('battle-log');
    if (!log) return;
    
    const messageDiv = document.createElement('p');
    messageDiv.className = type === 'error' ? 'error-msg' : 'system-msg';
    messageDiv.textContent = `[Sistema]: ${message}`;
    
    log.appendChild(messageDiv);
    log.scrollTop = log.scrollHeight;
}

/**
 * Configura los event listeners del campo de batalla
 */
function setupBattlefieldEventListeners() {
    // Botón de rendición
    const surrenderBtn = document.querySelector('.btn-surrender');
    if (surrenderBtn) {
        surrenderBtn.addEventListener('click', () => {
            if (confirm('¿Estás seguro de que quieres rendirte?')) {
                // Aquí iría la lógica de rendición
                console.log('Jugador se rinde');
                addBattleLog('Te has rendido. ¡La batalla ha terminado!', 'error');
                
                // Si existe GameManager, usar su método
                if (window.gameManager && typeof window.gameManager.handleSurrender === 'function') {
                    window.gameManager.handleSurrender();
                } else {
                    // Redirigir al lobby como fallback
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 2000);
                }
            }
        });
    }
    
    // Temporizador de turno
    updateTurnTimer();
    setInterval(updateTurnTimer, 1000);
}

/**
 * Actualiza el temporizador de turno
 */
function updateTurnTimer() {
    const turnDisplay = document.getElementById('turn-display');
    if (turnDisplay) {
        // Simular cambio de turno cada 30 segundos para demostración
        const seconds = Math.floor(Date.now() / 1000) % 60;
        turnDisplay.textContent = seconds < 30 ? 'TU TURNO' : 'TURNO ENEMIGO';
        turnDisplay.style.color = seconds < 30 ? '#4cd137' : '#e94560';
    }
}

// Función para redirigir a game.html cuando se completa el despliegue
function redirectToGame() {
    console.log('Redirigiendo a game.html...');
    window.location.href = 'game.html';
}

// Si estamos en battlefield.html y hay un despliegue guardado, 
// podemos permitir continuar a game.html
document.addEventListener('DOMContentLoaded', () => {
    // Verificar si hay despliegue guardado
    const deployment = localStorage.getItem('game_deployment');
    if (deployment && window.location.pathname.includes('battlefield.html')) {
        // Agregar botón para continuar a juego completo si no existe
        if (!document.querySelector('.btn-continue')) {
            const continueBtn = document.createElement('button');
            continueBtn.className = 'btn-success btn-continue';
            continueBtn.textContent = '🎮 CONTINUAR A JUEGO COMPLETO';
            continueBtn.style.marginTop = '1rem';
            continueBtn.addEventListener('click', redirectToGame);
            
            const sidebar = document.querySelector('.battle-sidebar');
            if (sidebar) {
                sidebar.appendChild(continueBtn);
            }
        }
    }
});