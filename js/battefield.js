/**
 * battlefield.js - Lógica de la escena de batalla
 */

document.addEventListener('DOMContentLoaded', () => {
    initBattlefield();
    cargarPiezasAliadas();
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
    console.log('Datos del despliegue:', deployment);
    addBattleLog(`${deployment.pieces.length} piezas aliadas cargadas`);
    
    // Filtrar solo piezas del jugador (por si acaso)
    const playerPieces = deployment.pieces.filter(p => p.player === 'player');
    
    console.log('Piezas del jugador:', playerPieces);
    
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
        
        // CORRECCIÓN IMPORTANTE:
        // En el tablero de despliegue (configuración), las filas van de 0 a 3 (4 filas del jugador)
        // En el tablero de batalla (10x10), las filas del jugador son las 6-9 (últimas 4 filas)
        // Pero debemos mantener la relación: la primera fila del despliegue (fila 0) 
        // corresponde a la primera fila del territorio del jugador en el campo de batalla (fila 6)
        
        const row = piece.position.row + 6;  // Fila 0 del despliegue -> Fila 6 del campo de batalla
        const col = piece.position.col;      // La columna se mantiene igual
        
        console.log(`Colocando ${piece.name} (${piece.type}) en (${row}, ${col}) [original: (${piece.position.row}, ${piece.position.col})]`);
        
        const cell = document.querySelector(`.battle-cell[data-row="${row}"][data-col="${col}"]`);
        if (cell && !cell.classList.contains('lake')) {
            // Crear elemento de pieza
            const pieceDiv = document.createElement('div');
            pieceDiv.className = 'battle-piece player';
            
            // Obtener el símbolo correcto para la pieza
            const symbol = getPieceSymbol(piece.type);
            const rankDisplay = piece.rank > 0 ? piece.rank : '★';
            
            pieceDiv.innerHTML = `
                <div class="piece-symbol">${symbol}</div>
                <div class="piece-rank">${rankDisplay}</div>
            `;
            
            pieceDiv.title = `${piece.name || piece.type} (Rango: ${piece.rank > 0 ? piece.rank : 'Especial'})`;
            cell.appendChild(pieceDiv);
            cell.classList.add('occupied');
            
            console.log(`✓ ${piece.name || piece.type} colocada en celda (${row}, ${col})`);
        } else {
            console.error(`No se pudo colocar ${piece.name || piece.type} en (${row}, ${col}) - celda no encontrada o es lago`);
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
                        window.location.href = '/html/etapa-1/lobby.html';
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
    
    // Agregar botón para volver a configurar si no hay despliegue
    if (!deployment && window.location.pathname.includes('battlefield.html')) {
        const backBtn = document.createElement('button');
        backBtn.className = 'btn-secondary';
        backBtn.textContent = '⬅️ VOLVER A CONFIGURAR';
        backBtn.style.marginTop = '1rem';
        backBtn.addEventListener('click', () => {
            window.location.href = 'config.html';
        });
        
        const sidebar = document.querySelector('.battle-sidebar');
        if (sidebar) {
            sidebar.appendChild(backBtn);
        }
        
        addBattleLog('No se encontró despliegue. Vuelve a configurar tus piezas.', 'error');
    }
});