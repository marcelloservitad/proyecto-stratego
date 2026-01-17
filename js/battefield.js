/**
 * battlefield.js - Lógica de la escena de batalla
 */

document.addEventListener('DOMContentLoaded', () => {
    initBattlefield();
    cargarPiezasAliadas(); // Nueva función
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
    // Aquí irá la lógica de selección y movimiento más adelante
}

