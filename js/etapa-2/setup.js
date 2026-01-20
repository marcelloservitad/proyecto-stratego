const BOARD_SIZE = 10;
const API_BASE = 'https://stratego-api.koyeb.app/api';

const LAKES = new Set([
    // Lago izquierdo (2x2): (2,4), (3,4), (2,5), (3,5)
    keyOf(2, 4), keyOf(3, 4), keyOf(2, 5), keyOf(3, 5),

    // Lago derecho (2x2): (6,4), (7,4), (6,5), (7,5)
    keyOf(6, 4), keyOf(7, 4), keyOf(6, 5), keyOf(7, 5),
])



const elements = {
    board: document.getElementById('board'),
    inventory: document.getElementById('inventory'),
    trash: document.getElementById('trash'),

    matchIdText: document.getElementById('matchIdText'),
    teamText: document.getElementById('teamText'),
    modeText: document.getElementById('modeText'),

    requiredCountText: document.getElementById('requiredCountText'),
    placedCountText: document.getElementById('placedCountText'),
    remainingCountText: document.getElementById('remainingCountText'),

    randomDeployButton: document.getElementById('randomDeployButton'),
    readyButton: document.getElementById('readyButton'),
    backToLobbyButton: document.getElementById('backToLobbyButton'),
    readyStatusText: document.getElementById('readyStatusText'),
      board: document.getElementById('board'),
    readyButton: document.getElementById('readyButton'),
    randomDeployButton: document.getElementById('randomDeployButton'),
    realtimeStatusText: document.getElementById('realtimeStatusText'),


};

let matchEventSource = null;
let hasRedirectedToMatch = false;
let safetyInterval = null;


const state = {
    protocolMode: sessionStorage.getItem('strategoProtocolMode') || 'FETCH_FIRST',
    userId: loadUserIdFromStorage(),
    matchId: sessionStorage.getItem('strategoMatchId') || '',
    mode: sessionStorage.getItem('strategoMode') || 'CLASSIC_WAR',
    team: sessionStorage.getItem('strategoTeam') || 'RED',
    isLocalReady: false,
    isOpponentReady: false,

    inventory: [],
    placed: new Map(), // key 'x,y' -> pieceKey
    dragData: null,
};

boot();

function boot() {
    // 1. Inicialización Visual
    if (typeof hydrateHeader === 'function') hydrateHeader(); // Si la tienes importada
    
    document.body.classList.remove('team-red', 'team-blue');
    document.body.classList.add(state.team === 'BLUE' ? 'team-blue' : 'team-red');
    
    // Funciones de tu lógica de tablero (Asumo que ya las tienes)
    buildInventory();
    renderBoard();
    renderInventory();
    updateCounters();
    wireEvents();
    renderReadyStatus();

    // 2. Validaciones
    if (!state.userId) {
        console.warn('Setup: falta userId, no se inicia SSE.');
        return;
    }

    // 3. CONEXIÓN DEL BOTÓN "VOLVER / ABANDONAR" (LO NUEVO)
    const btnBack = document.getElementById('btnBackToLobby');
    if (btnBack) {
        btnBack.addEventListener('click', handleQuitSetup);
    }

    // 4. Iniciar escucha de "match_started" o conexión rival
    startRealtimeMatchListener(); 
    startSafetyPolling();
}

function hydrateHeader() {
    elements.matchIdText.textContent = state.matchId || '—';
    elements.teamText.textContent = state.team;
    elements.modeText.textContent = formatModeText(state.mode);

    const required = getRequiredCount(state.mode);
    elements.requiredCountText.textContent = String(required);
    elements.remainingCountText.textContent = String(required);
}

function wireEvents() {
    elements.randomDeployButton.addEventListener('click', function () {
        randomDeploy();
    });

    const btnReady = document.getElementById('btnReady');
    if (btnReady) { // <--- ESTO EVITA EL ERROR
        btnReady.addEventListener('click', handleReadyClick);
    } else {
        console.warn("wireEvents: No se encontró el botón 'btnReady'");
    }

   
    elements.readyButton.addEventListener('click', async function () {
    const payload = buildSetupPayload();
    const validation = validateSetupPayload(payload);

    if (!validation.ok) {
        alert(validation.message);
        return;
    }

    try {
        // 🔒 Bloqueamos botones para evitar doble envío
        elements.readyButton.disabled = true;
        elements.randomDeployButton.disabled = true;

        // 📡 Enviamos setup al backend
        await postSetup(payload);
        sessionStorage.setItem('strategoLocalSetupPieces', JSON.stringify(payload.pieces));
        await enviarNotificacionListo();

        // ✅ Marcamos que ESTE jugador ya está listo
        state.isLocalReady = true;
        renderReadyStatus();

        // 🔒 Bloqueamos toda la UI de despliegue
        document.body.classList.add('locked');

        // 📝 Feedback visual inmediato
        elements.readyButton.textContent = 'LISTO ✓';
        safeSetStatusText('Estado: esperando al oponente...');

        // 👂 IMPORTANTE: aquí arrancamos el listener SSE
        startRealtimeMatchListener();

        let attempts = 0;

        const intervalId = setInterval(async function () {
        attempts += 1;

        if (sessionStorage.getItem('strategoMatchStarted') === 'true') {
            clearInterval(intervalId);
            return;
        }

        await pollMatchStarted();

        if (attempts >= 10) {
            clearInterval(intervalId);
        }
        }, 1500);

    } catch (error) {
        console.error(error);

        alert(`No se pudo enviar el setup. ${error.message}`);

        // 🔓 Revertimos UI si falla
        elements.readyButton.disabled = false;
        elements.randomDeployButton.disabled = false;
    }
});


    // Zona para devolver piezas
    elements.trash.addEventListener('dragover', function (event) {
        event.preventDefault();
        elements.trash.classList.add('drop-target');
    });

    elements.trash.addEventListener('dragleave', function () {
        elements.trash.classList.remove('drop-target');
    });

    elements.trash.addEventListener('drop', function (event) {
        event.preventDefault();
        elements.trash.classList.remove('drop-target');

        if (!state.dragData) {
            return;
        }

        if (state.dragData.sourceType !== 'board') {
            return;
        }

        removeFromBoard(state.dragData.sourceKey);
        state.dragData = null;

        renderBoard();
        renderInventory();
        updateCounters();
    });
}

/**
 * Crea las piezas del inventario según el modo.
 */
function buildInventory() {
    const definitions = state.mode === 'QUICK_DUEL' ? getQuickDuelPieces() : getClassicWarPieces();
    const items = [];

    for (let i = 0; i < definitions.length; i++) {
        const def = definitions[i];

        for (let j = 0; j < def.count; j++) {
            items.push({
                pieceKey: `${def.key}-${j + 1}`,
                typeKey: def.key,
                label: def.label,
                short: def.short,
            });
        }
    }

    state.inventory = items;
}

/**
 * Render del tablero 10x10.
 * Reglas visibles:
 * - Lagos bloqueados.
 * - Solo se ve la zona de despliegue del jugador (4 filas).
 */
function renderBoard() {
    elements.board.innerHTML = '';

    const deployRange = getDeployRowRange(state.team);

    for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
            const cellKey = keyOf(x, y);
            const isLake = LAKES.has(cellKey);

            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'cell';

            const isDeployRow = y >= deployRange.min && y <= deployRange.max;

            if (isLake) {
                cell.classList.add('lake');
                cell.setAttribute('aria-label', `Lago bloqueado (${x}, ${y})`);
            } else if (isDeployRow) {
                cell.classList.add('deploy');
                cell.setAttribute('aria-label', `Celda de despliegue (${x}, ${y})`);
            } else {
                // ✅ Zona oculta: el jugador no la ve ni puede interactuar
                cell.classList.add('hidden');
                cell.setAttribute('aria-label', 'Zona oculta');
            }

            cell.dataset.x = String(x);
            cell.dataset.y = String(y);

            if (!isLake && isDeployRow) {
                wireCellDrop(cell, cellKey);
            }

            const pieceKey = state.placed.get(cellKey);

            if (pieceKey) {
                const piece = createBoardPieceElement(pieceKey, cellKey);
                cell.appendChild(piece);
            }

            elements.board.appendChild(cell);
        }
    }
}

/**
 * Activa drop en una celda válida.
 */
function wireCellDrop(cell, cellKey) {
    cell.addEventListener('dragover', function (event) {
        event.preventDefault();

        // Solo marcar si realmente se puede soltar
        if (canDropOnCell(cellKey)) {
            cell.classList.add('drop-target');
        }
    });

    cell.addEventListener('dragleave', function () {
        cell.classList.remove('drop-target');
    });

    cell.addEventListener('drop', function (event) {
        event.preventDefault();
        cell.classList.remove('drop-target');

        if (!state.dragData) {
            return;
        }

        if (!canDropOnCell(cellKey)) {
            state.dragData = null;
            return;
        }

        if (state.dragData.sourceType === 'inventory') {
            placeFromInventory(state.dragData.pieceKey, cellKey);
        } else if (state.dragData.sourceType === 'board') {
            moveOnBoard(state.dragData.sourceKey, cellKey);
        }

        state.dragData = null;

        renderBoard();
        renderInventory();
        updateCounters();
    });
}

function canDropOnCell(cellKey) {
    if (LAKES.has(cellKey)) {
        return false;
    }

    const deployRange = getDeployRowRange(state.team);
    const pos = parseKey(cellKey);

    if (pos.y < deployRange.min || pos.y > deployRange.max) {
        return false;
    }

    if (state.placed.has(cellKey)) {
        return false;
    }

    return true;
}

/**
 * Render de inventario: muestra tipos y cantidad restante.
 * No se guarda nada; se calcula en base a state.inventory menos piezas colocadas.
 */
function renderInventory() {
    elements.inventory.innerHTML = '';

    const remaining = getRemainingInventoryItems();

    if (remaining.length === 0) {
        const done = document.createElement('p');
        done.className = 'muted';
        done.textContent = 'Inventario completo desplegado.';
        elements.inventory.appendChild(done);
        return;
    }

    // Agrupar por typeKey
    const groups = new Map();

    for (let i = 0; i < remaining.length; i++) {
        const item = remaining[i];

        if (!groups.has(item.typeKey)) {
            groups.set(item.typeKey, []);
        }

        groups.get(item.typeKey).push(item);
    }

    const keys = Array.from(groups.keys()).sort();

    for (let i = 0; i < keys.length; i++) {
        const typeKey = keys[i];
        const group = groups.get(typeKey);

        const chip = document.createElement('article');
        chip.className = 'piece-chip';

        const left = document.createElement('div');
        left.className = 'piece-name';

        const title = document.createElement('strong');
        title.textContent = group[0].label;

        const sub = document.createElement('span');
        sub.textContent = `Disponible: ${group.length}`;

        left.appendChild(title);
        left.appendChild(sub);

        const right = document.createElement('div');
        right.className = 'piece-count';
        right.textContent = group[0].short;

        // Hacer draggable una pieza representativa (tomamos una del grupo)
        chip.draggable = true;
        chip.addEventListener('dragstart', function () {
            state.dragData = {
                sourceType: 'inventory',
                pieceKey: group[0].pieceKey,
            };
        });

        chip.addEventListener('dragend', function () {
            state.dragData = null;
        });

        chip.appendChild(left);
        chip.appendChild(right);

        elements.inventory.appendChild(chip);
    }
}

function createBoardPieceElement(pieceKey, cellKey) {
    const item = findPlacedItem(pieceKey);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'piece';
    button.draggable = true;

    const label = item ? item.short : 'P';
    button.textContent = label;

    /**
     * Nota: En Stratego real, el rival no ve tu rango. Eso lo manejamos luego.
     * Aquí solo es tu vista de despliegue.
     */

    button.addEventListener('dragstart', function () {
        state.dragData = {
            sourceType: 'board',
            sourceKey: cellKey,
            pieceKey: pieceKey,
        };
    });

    button.addEventListener('dragend', function () {
        state.dragData = null;
    });

    return button;
}

/**
 * Coloca una pieza desde inventario a una celda.
 */
function placeFromInventory(pieceKey, cellKey) {
    const remaining = getRemainingInventoryItems();
    const exists = remaining.some(function (x) {
        return x.pieceKey === pieceKey;
    });

    if (!exists) {
        return;
    }

    state.placed.set(cellKey, pieceKey);
}

/**
 * Mueve pieza dentro del tablero (solo en tu zona de despliegue).
 */
function moveOnBoard(fromKey, toKey) {
    const pieceKey = state.placed.get(fromKey);

    if (!pieceKey) {
        return;
    }

    state.placed.delete(fromKey);
    state.placed.set(toKey, pieceKey);
}

/**
 * Quita pieza del tablero y vuelve al inventario (implícito).
 */
function removeFromBoard(cellKey) {
    state.placed.delete(cellKey);
}

/**
 * Despliegue aleatorio: llena tu zona válida con todas las piezas restantes.
 * - Limpia todo lo colocado.
 * - Reparte inventario completo aleatoriamente en celdas de despliegue libres.
 */
function randomDeploy() {
    state.placed.clear();

    const deployCells = getDeployCells(state.team);
    const items = state.inventory.slice();

    shuffleArray(items);
    shuffleArray(deployCells);

    const required = getRequiredCount(state.mode);

    if (items.length !== required) {
        // Seguridad: debería coincidir con el modo
        console.warn('Inventario no coincide con piezas requeridas.');
    }

    for (let i = 0; i < items.length && i < deployCells.length; i++) {
        state.placed.set(deployCells[i], items[i].pieceKey);
    }

    renderBoard();
    renderInventory();
    updateCounters();
}

/**
 * Actualiza contadores y habilita LISTO cuando el inventario está completo.
 */
function updateCounters() {
    const required = getRequiredCount(state.mode);
    const placedCount = state.placed.size;
    const remaining = required - placedCount;

    elements.placedCountText.textContent = String(placedCount);
    elements.remainingCountText.textContent = String(Math.max(0, remaining));

    elements.readyButton.disabled = placedCount !== required;
}

/**
 * Devuelve las piezas restantes (no colocadas).
 */
function getRemainingInventoryItems() {
    const placedPieceKeys = new Set(Array.from(state.placed.values()));
    const remaining = [];

    for (let i = 0; i < state.inventory.length; i++) {
        const item = state.inventory[i];

        if (!placedPieceKeys.has(item.pieceKey)) {
            remaining.push(item);
        }
    }

    return remaining;
}

function findPlacedItem(pieceKey) {
    for (let i = 0; i < state.inventory.length; i++) {
        if (state.inventory[i].pieceKey === pieceKey) {
            return state.inventory[i];
        }
    }

    return null;
}

function getDeployRowRange(team) {
    // ✅ Ajuste según validación real del servidor:
    // RED despliega abajo (6–9) y BLUE arriba (0–3).
    if (team === 'RED') {
        return { min: 6, max: 9 };
    }

    return { min: 0, max: 3 };
}

/**
 * Genera lista de celdas válidas de despliegue (excluye lagos).
 */
function getDeployCells(team) {
    const range = getDeployRowRange(team);
    const cells = [];

    for (let y = range.min; y <= range.max; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
            const k = keyOf(x, y);

            if (!LAKES.has(k)) {
                cells.push(k);
            }
        }
    }

    return cells;
}

function getRequiredCount(mode) {
    return mode === 'QUICK_DUEL' ? 10 : 40;
}

function formatModeText(mode) {
    if (mode === 'QUICK_DUEL') {
        return 'Duelo Rápido';
    }

    if (mode === 'CLASSIC_WAR') {
        return 'Guerra Clásica';
    }

    return mode;
}

/**
 * Inventario CLASSIC_WAR (40 piezas).
 * Nota: Esto sigue el estándar común de Stratego.
 */

function getClassicWarPieces() {
    return [
        { key: 'FLAG',       label: 'Bandera',    short: '🏁', count: 1 },
        { key: 'BOMB',       label: 'Bomba',      short: '💣', count: 6 },
        { key: 'SPY',        label: 'Espía',      short: '🕵️', count: 1 },
        { key: 'SCOUT',      label: 'Explorador', short: '👁️', count: 8 },
        { key: 'MINER',      label: 'Minero',     short: '⛏️', count: 5 },
        { key: 'SERGEANT',   label: 'Sargento',   short: '🔰', count: 4 },
        { key: 'LIEUTENANT', label: 'Teniente',   short: '⚜️', count: 4 },
        { key: 'CAPTAIN',    label: 'Capitán',    short: '🛡️', count: 4 },
        { key: 'MAJOR',      label: 'Mayor',      short: '⚔️', count: 3 },
        { key: 'COLONEL',    label: 'Coronel',    short: '🦅', count: 2 },
        { key: 'GENERAL',    label: 'General',    short: '⭐', count: 1 },
        { key: 'MARSHAL',    label: 'Mariscal',   short: '🎖️', count: 1 },
    ];
}


/**
 * Inventario QUICK_DUEL (10 piezas) según tu especificación.
 */

function getQuickDuelPieces() {
    return [
        { key: 'MARSHAL',    label: 'Mariscal',   short: '🎖️', count: 1 },
        { key: 'GENERAL',    label: 'General',    short: '⭐', count: 1 },
        { key: 'MINER',      label: 'Minero',     short: '⛏️', count: 2 },
        { key: 'SCOUT',      label: 'Explorador', short: '👁️', count: 2 },
        { key: 'SPY',        label: 'Espía',      short: '🕵️', count: 1 },
        { key: 'BOMB',       label: 'Bomba',      short: '💣', count: 2 },
        { key: 'FLAG',       label: 'Bandera',    short: '🏁', count: 1 },
    ];
}


function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = array[i];
        array[i] = array[j];
        array[j] = tmp;
    }
}

function keyOf(x, y) {
    return `${x},${y}`;
}

function parseKey(key) {
    const parts = key.split(',');
    return { x: Number(parts[0]), y: Number(parts[1]) };
}

function loadUserIdFromStorage() {
    try {
        const raw = localStorage.getItem('strategoSession');

        if (!raw) {
            return '';
        }

        const session = JSON.parse(raw);
        return session && session.userId ? String(session.userId) : '';
    } catch (error) {
        return '';
    }
}

function validateSetupPayload(payload) {
    const required = getRequiredCount(state.mode);

    if (!payload || !Array.isArray(payload.pieces)) {
        return { ok: false, message: 'Payload inválido.' };
    }

    if (payload.pieces.length !== required) {
        return { ok: false, message: 'Debes colocar todas las piezas antes de continuar.' };
    }

    const range = getDeployRowRange(state.team);
    const seen = new Set();

    for (let i = 0; i < payload.pieces.length; i++) {
        const p = payload.pieces[i];

        const k = keyOf(p.position.x, p.position.y);

        if (seen.has(k)) {
            return { ok: false, message: 'Hay piezas duplicadas en la misma casilla.' };
        }

        seen.add(k);

        if (p.position.x < 0 || p.position.x > 9 || p.position.y < 0 || p.position.y > 9) {
            return { ok: false, message: 'Hay piezas fuera del tablero.' };
        }

        if (LAKES.has(k)) {
            return { ok: false, message: 'No puedes colocar piezas en los lagos.' };
        }

        if (p.position.y < range.min || p.position.y > range.max) {
            return { ok: false, message: 'Hay piezas fuera de tu zona de despliegue.' };
        }

        if (p.team !== state.team) {
            return { ok: false, message: 'Equipo inválido en piezas.' };
        }

        if (p.isRevealed !== false) {
            return { ok: false, message: 'isRevealed debe ser false en el setup.' };
        }
    }

    return { ok: true, message: '' };
}

async function postSetup(payload) {
    if (!state.matchId) {
        throw new Error('matchId faltante.');
    }

    if (!state.userId) {
        throw new Error('userId faltante. Vuelve al lobby e inicia sesión.');
    }

    const response = await fetch(`https://stratego-api.koyeb.app/api/matches/${encodeURIComponent(state.matchId)}/setup`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${state.userId}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (response.status !== 202) {
        const text = await response.text();
        throw new Error(`Setup rechazado. status=${response.status}. body=${text}`);
    }

    return {};
}

let matchStartEventSource = null;



/**
 * Construye el payload del setup según las piezas colocadas.
 * @returns {{pieces: Array<{type: string, rank: number, team: string, position: {x: number, y: number}, isRevealed: boolean}>}}
 */
function buildSetupPayload() {
    const pieces = [];
    const entries = Array.from(state.placed.entries());

    for (let i = 0; i < entries.length; i++) {
        const cellKey = entries[i][0];
        const pieceKey = entries[i][1];

        const item = findPlacedItem(pieceKey);

        if (!item) {
            continue;
        }

        const pos = parseKey(cellKey);

        pieces.push({
            type: item.typeKey,
            rank: getRankByType(item.typeKey),
            team: state.team,
            position: { x: pos.x, y: pos.y },
            isRevealed: false,
        });
    }

    return { pieces: pieces };
}

/**
 * Devuelve el rank numérico oficial de una pieza según las reglas del juego.
 * El número MENOR indica mayor jerarquía (excepto reglas especiales).
 *
 * FLAG (0): Inmóvil. Perder si es capturada.
 * MARSHAL (1): Máximo rango normal.
 * ...
 * BOMB (11): Inmóvil. Solo MINER puede derrotarla.
 *
 * @param {string} type Tipo de pieza.
 * @returns {number}
 */
function getRankByType(type) {
    const rankMap = {
        FLAG: 0,

        MARSHAL: 1,
        GENERAL: 2,
        COLONEL: 3,
        MAJOR: 4,
        CAPTAIN: 5,
        LIEUTENANT: 6,
        SERGEANT: 7,
        MINER: 8,
        SCOUT: 9,
        SPY: 10,

        BOMB: 11,
    };

    return Object.prototype.hasOwnProperty.call(rankMap, type)
        ? rankMap[type]
        : -1;
}

function renderReadyStatus() {
    const localText = state.isLocalReady ? 'Listo' : 'No listo';
    const opponentText = state.isOpponentReady ? 'Listo' : 'No listo';

    elements.readyStatusText.innerHTML = `Tú: <strong>${localText}</strong> • Oponente: <strong>${opponentText}</strong>`;
}


function startRealtimeMatchListener() {
    // Si ya existe, salimos para no duplicar
    if (matchEventSource) {
        // Opcional: si quieres reiniciar la conexión, descomenta la siguiente línea:
        // matchEventSource.close();
        return; 
    }

    console.log("Conectando canal de eventos...");
    
    // 1. DEFINICIÓN CORRECTA DE LA VARIABLE
    matchEventSource = new EventSource(
        `https://stratego-api.koyeb.app/api/events/stream?userId=${encodeURIComponent(state.userId)}`
    );

    // Listener genérico (Atrapa el inicio)
    matchEventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.event === 'match_started' || data.status === 'STARTED') {
                console.log("¡Evento detectado!");
                window.location.href = '../../html/etapa-3/match.html';
            }
        } catch (e) {}
    };

    // Listener nombrado (Atrapa el inicio explícito)
    matchEventSource.addEventListener('match_started', (e) => {
        console.log("Evento match_started recibido");
        window.location.href = '../../html/etapa-3/match.html';
    });

    // 3. ESCUCHADOR DE CHAT (Para detectar [SYSTEM_READY])
    matchEventSource.addEventListener('match_chat_message', (event) => {
        try {
            const data = JSON.parse(event.data);
            const content = data.content || (data.payload && data.payload.content);
            if (content === "[SYSTEM_READY]") {
                state.isOpponentReady = true;
                if(typeof renderReadyStatus === 'function') renderReadyStatus();
                console.log("Oponente listo detectado por chat.");
            }
        } catch (e) {}
    });

    // 4. ESCUCHADOR DE INICIO (Evento Nombrado)
    matchEventSource.addEventListener('match_started', (event) => {
        console.log("Evento match_started recibido");
        goToMatch(); // Usamos la función segura
    });

    // Listener de cancelación (CORREGIDO: usa matchEventSource, no evtSource)
    matchEventSource.addEventListener('match_cancelled', (e) => {
        alert("Partida cancelada.");
        cleanMatchSession(); // Asegúrate de tener esta función o borra esta línea
        window.location.href = '../etapa-1/lobby.html';
    });

    
    // Manejo de errores
    matchEventSource.onerror = (err) => {
        // console.warn("SSE Error - Reconectando...");
        // No cerramos, el navegador intenta reconectar solo
    };
}

// Función centralizada para no repetir código

function handleStartRedirect(payload) {
    if (hasRedirectedToMatch) return;
    hasRedirectedToMatch = true;

    // Aseguramos extraer la data correctamente
    const data = payload.info || payload.data || payload;

    console.log("🚀 EJECUTANDO REDIRECCIÓN REAL A ETAPA 3", data);

    // 1. Guardar IDs críticos
    const finalMatchId = data.matchId || sessionStorage.getItem('strategoMatchId');
    sessionStorage.setItem('strategoMatchId', finalMatchId);
    sessionStorage.setItem('strategoMatchStarted', 'true');

    // 2. Guardar Turno (Vital para la Etapa 3)
    if (typeof data.yourTurn === 'boolean') {
        sessionStorage.setItem('strategoYourTurn', data.yourTurn);
    }
    
    // 3. Feedback visual
    if (elements.readyButton) {
        elements.readyButton.textContent = "¡PARTIDA INICIADA!";
        elements.readyButton.style.backgroundColor = "#28a745"; // Verde
    }
    safeSetStatusText("Partida iniciada. Redirigiendo...");

    // 4. Cerrar SSE para evitar fugas de memoria
    if (matchEventSource) matchEventSource.close();

    // 5. REDIRECCIÓN (CORREGIDO)
    setTimeout(() => {
        // Usamos href porque replace = "..." no funciona
        window.location.href = '../../html/etapa-3/match.html';
    }, 500);
}

/**
 * Maneja match_started: ambos listos.
 * @param {MessageEvent} event Evento SSE.
 */

function handleMatchStarted(event) {
    state.isOpponentReady = true;
    renderReadyStatus();

    elements.realtimeStatusText.textContent = 'Estado: ambos están listos. Listo para ir a etapa 3.';

    alert('Listo para ir a etapa 3');

    // Si quieres, aquí luego redirigimos a la Etapa III.
    // window.location.href = '../etapa-3/match.html';
}

/**
 * Maneja eventos que podrían indicar cambios de listo.
 * @param {string} eventName Nombre del evento.
 * @param {MessageEvent} event Evento SSE.
 */
function handleReadyLikeEvent(eventName, event) {
    let data = null;

    try {
        data = JSON.parse(event.data);
    } catch (error) {
        return;
    }

    // Muchos backends envuelven en "info" o "data"
    const payload = data && data.info ? data.info : (data && data.data ? data.data : data);

    // Si viene matchId, solo reaccionamos al match actual
    const payloadMatchId = extractMatchIdFromPayload(payload);

    if (payloadMatchId && state.matchId && payloadMatchId !== state.matchId) {
        return;
    }

    const updated = tryUpdateOpponentReady(payload);

    if (updated) {
        renderReadyStatus();

        if (state.isOpponentReady && state.isLocalReady) {
            elements.realtimeStatusText.textContent = 'Estado: ambos están listos. Esperando match_started...';
        } else if (state.isOpponentReady) {
            elements.realtimeStatusText.textContent = 'Estado: el oponente está listo. Falta que tú presiones LISTO.';
        }
    }
}

/**
 * Extrae matchId de un payload de forma tolerante.
 * @param {any} payload Payload posible.
 * @returns {string}
 */
function extractMatchIdFromPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return '';
    }

    if (payload.matchId) {
        return String(payload.matchId);
    }

    if (payload.match && typeof payload.match === 'object') {
        if (payload.match.matchId) {
            return String(payload.match.matchId);
        }

        if (payload.match.id) {
            return String(payload.match.id);
        }
    }

    return '';
}

/**
 * Intenta deducir si el oponente está listo desde el payload.
 * Soporta estructuras comunes: ready por equipos, contadores, booleanos, etc.
 *
 * @param {any} payload Payload del evento.
 * @returns {boolean} true si actualizó algo.
 */
function tryUpdateOpponentReady(payload) {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    const myTeam = state.team;
    const opponentTeam = myTeam === 'RED' ? 'BLUE' : 'RED';

    // Caso A: { ready: { RED: true, BLUE: false } }
    if (payload.ready && typeof payload.ready === 'object') {
        const opp = payload.ready[opponentTeam];

        if (typeof opp === 'boolean') {
            state.isOpponentReady = opp;
            return true;
        }
    }

    // Caso B: { setups: { RED: true, BLUE: true } }
    if (payload.setups && typeof payload.setups === 'object') {
        const opp = payload.setups[opponentTeam];

        if (typeof opp === 'boolean') {
            state.isOpponentReady = opp;
            return true;
        }
    }

    // Caso C: { opponentReady: true }
    if (typeof payload.opponentReady === 'boolean') {
        state.isOpponentReady = payload.opponentReady;
        return true;
    }

    // Caso D: { readyTeam: "BLUE" } (o "RED")
    if (payload.readyTeam && typeof payload.readyTeam === 'string') {
        if (String(payload.readyTeam) === opponentTeam) {
            state.isOpponentReady = true;
            return true;
        }
    }

    // Caso E: { setupsReceived: 2 } o { readyCount: 2 }
    if (typeof payload.setupsReceived === 'number') {
        if (payload.setupsReceived >= 2) {
            state.isOpponentReady = true;
            return true;
        }

        if (payload.setupsReceived === 1 && state.isLocalReady) {
            state.isOpponentReady = false;
            return true;
        }
    }

    if (typeof payload.readyCount === 'number') {
        if (payload.readyCount >= 2) {
            state.isOpponentReady = true;
            return true;
        }
    }

    return false;
}

function safeSetStatusText(text) {
    if (elements.realtimeStatusText) {
        elements.realtimeStatusText.textContent = text;
    }
}

function extractSetupsFromMatchStarted(payload, myTeam, opponentTeam) {
    // Devuelve:
    // - localPieces: piezas completas (si el servidor las manda)
    // - opponentPositions: posiciones del rival (si el servidor manda piezas, igual ocultamos tipo luego)
    const result = {
        localPieces: [],
        opponentPositions: [],
    };

    if (!payload || typeof payload !== 'object') {
        return result;
    }

    // Caso A: payload.pieces = [{team, position, ...}]
    if (Array.isArray(payload.pieces)) {
        const local = [];
        const opp = [];

        for (let i = 0; i < payload.pieces.length; i++) {
            const p = payload.pieces[i];

            if (!p || !p.position) {
                continue;
            }

            if (p.team === myTeam) {
                local.push(p);
            } else if (p.team === opponentTeam) {
                opp.push({ x: p.position.x, y: p.position.y });
            }
        }

        result.localPieces = local;
        result.opponentPositions = opp;
        return result;
    }

    // Caso B: payload.setups = { RED: [...], BLUE: [...] }
    if (payload.setups && typeof payload.setups === 'object') {
        const localArr = payload.setups[myTeam];
        const oppArr = payload.setups[opponentTeam];

        if (Array.isArray(localArr)) {
            result.localPieces = localArr;
        }

        if (Array.isArray(oppArr)) {
            const opp = [];

            for (let i = 0; i < oppArr.length; i++) {
                const p = oppArr[i];

                if (p && p.position) {
                    opp.push({ x: p.position.x, y: p.position.y });
                }
            }

            result.opponentPositions = opp;
        }

        return result;
    }

    // Caso C: payload.teams = { RED: { pieces: [...] }, BLUE: { pieces: [...] } }
    if (payload.teams && typeof payload.teams === 'object') {
        const localTeam = payload.teams[myTeam];
        const oppTeam = payload.teams[opponentTeam];

        if (localTeam && Array.isArray(localTeam.pieces)) {
            result.localPieces = localTeam.pieces;
        }

        if (oppTeam && Array.isArray(oppTeam.pieces)) {
            const opp = [];

            for (let i = 0; i < oppTeam.pieces.length; i++) {
                const p = oppTeam.pieces[i];

                if (p && p.position) {
                    opp.push({ x: p.position.x, y: p.position.y });
                }
            }

            result.opponentPositions = opp;
        }
    }

    return result;
}

async function pollMatchStarted() {
    if (!state.userId || !state.matchId) {
        return;
    }

    const endpoints = [
        `https://stratego-api.koyeb.app/api/matches/${state.matchId}`,
        `https://stratego-api.koyeb.app/api/matches/${state.matchId}/state`,
    ];

    for (let i = 0; i < endpoints.length; i++) {
        try {
            const response = await fetch(endpoints[i], {
                method: 'GET',
                headers: {
                    ...buildAuthHeaders(state.userId),
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                continue;
            }

            const data = await response.json();

            // Heurísticas comunes: status === 'STARTED', phase === 'PLAYING', started === true
            const status = data && data.status ? String(data.status) : '';
            const phase = data && data.phase ? String(data.phase) : '';
            const started = data && typeof data.started === 'boolean' ? data.started : false;

            const isStarted = started || status === 'STARTED' || phase === 'PLAYING';

            if (isStarted) {
                sessionStorage.setItem('strategoMatchStarted', 'true');
                window.location.assign = '../../html/etapa-3/match.html';
                return;
            }
        } catch (error) {
            // Ignorar y seguir intentando
        }
    }
}

async function enviarNotificacionListo() {
    const payload = { content: "[SYSTEM_READY]" };

    try {
        const response = await fetch(`https://stratego-api.koyeb.app/api/matches/${encodeURIComponent(state.matchId)}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.userId}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log("Alarma enviada.");
            mostrarAvisoVisual("Se envió tu notificación"); // Mensaje para el emisor
        }
    } catch (error) {
        console.error("Error al enviar notificación:", error);
    }
}


/**
 * Muestra una pequeña notificación visual en la pantalla.
 */
function mostrarAvisoVisual(mensaje) {
    // 1. Intentar usar el texto de estado que ya tienes
    safeSetStatusText(mensaje);

    // 2. Crear un "Toast" (notificación flotante) temporal
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = '#333';
    toast.style.color = '#fff';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '5px';
    toast.style.zIndex = '9999';
    toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
    toast.textContent = mensaje;

    document.body.appendChild(toast);

    // Desaparecer después de 3 segundos
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s ease';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// FUNCIÓN ÚNICA DE SALIDA
function goToMatch() {
    if (hasRedirected) return;
    hasRedirected = true;
    
    console.log("🚀 Redirigiendo a Etapa 3...");
    if (matchEventSource) matchEventSource.close();
    
    // Pequeño delay para asegurar que el usuario vea el cambio de estado
    setTimeout(() => {
        window.location.href = '../etapa-3/match.html';
    }, 500);
}

// PLAN B: PREGUNTAR AL SERVIDOR (Si el SSE falla, esto nos salva)
function startFallbackPolling() {
    console.log("Plan B activado: Verificando estado cada 3s...");
    const interval = setInterval(async () => {
        if (hasRedirected) return clearInterval(interval);

        try {
            const res = await fetch(`${API_BASE}/matches/${state.matchId}`, {
                headers: { 'Authorization': `Bearer ${state.userId}`, 'X-USER-ID': state.userId }
            });
            
            if (res.ok) {
                const match = await res.json();
                // Si el status ya no es 'SETUP', es que ya empezó
                if (match.status !== 'SETUP' && match.status !== 'WAITING') {
                    console.log("¡Confirmado por Polling: La partida inició!");
                    clearInterval(interval);
                    goToMatch();
                }
            }
        } catch (e) {
            console.warn("Fallo en polling de seguridad");
        }
    }, 3000);
}

async function handleQuitSetup() {
    const confirmExit = confirm("⚠️ ¿Abandonar la preparación?\n\nEsto cancelará la partida y contará como derrota/abandono.");
    
    if (!confirmExit) return;

    const btnBack = document.getElementById('btnBackToLobby');
    if(btnBack) {
        btnBack.disabled = true;
        btnBack.textContent = "Cancelando partida...";
    }

    try {
        // 1. AVISAR AL SERVIDOR (Forfeit)
        // Incluso en setup, debemos decir "me rindo/me voy" para liberar al rival
        if (state.matchId && state.userId) {
            await fetch(`${API_BASE}/matches/${state.matchId}/forfeit`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${state.userId}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reason: "VOLUNTARY" })
            });
            console.log("Partida cancelada en servidor.");
        }

    } catch (error) {
        console.warn("Error avisando al servidor (quizás ya estaba cerrada):", error);
    } finally {
        // 2. LIMPIEZA CRÍTICA DE SESIÓN (Lo que pediste)
        // Borramos SOLO los datos de la partida, pero dejamos el userId para seguir logueados
        cleanMatchSession();

        // 3. REDIRECCIÓN
        window.location.href = '../etapa-1/lobby.html';
    }
}

function cleanMatchSession() {
    // Eliminamos rastros de la partida actual para que el Lobby nos vea "libres"
    sessionStorage.removeItem('strategoMatchId');
    sessionStorage.removeItem('strategoTeam');
    sessionStorage.removeItem('strategoEnemyId');
    
    // Opcional: Limpiar piezas guardadas si quieres que el próximo setup empiece de cero
    // sessionStorage.removeItem('strategoLocalSetupPieces'); 
    
    console.log("Sesión de partida limpiada. Usuario sigue conectado.");
}

// ==========================================
// MONITOR DE SEGURIDAD (POLLING)
// ==========================================
function startSafetyPolling() {
    if (safetyInterval) clearInterval(safetyInterval);

    console.log("🛡️ Iniciando monitor de seguridad (Versión Tolerante)...");

    safetyInterval = setInterval(async () => {
        if (!state.matchId || !state.userId) return;

        try {
            // CAMBIO 1: Usamos '/state' porque es el que sale en tu imagen
            const res = await fetch(`${API_BASE}/matches/${state.matchId}/state`, {
                headers: { 'Authorization': `Bearer ${state.userId}` }
            });

            // CAMBIO 2: Si da 404, LO IGNORAMOS.
            // Puede ser que el 'state' no exista hasta que empiece la partida.
            // No te sacamos del juego.
            if (res.status === 404) {
                // console.warn("Polling: 404 (Esperando creación del estado...)");
                return; 
            }

            if (res.ok) {
                const data = await res.json();
                
                // Verificamos si la partida ya arrancó
                // A veces el estado viene directo, a veces envuelto.
                // Buscamos indicios de que ya hay juego (status, turn, board)
                const status = data.status || data.matchStatus; 
                
                if (status === 'PLAYING' || status === 'ACTIVE' || data.turn || data.board) {
                    console.log("🚀 Polling: ¡Partida activa detectada!");
                    
                    if (matchEventSource) matchEventSource.close();
                    clearInterval(safetyInterval);
                    
                    window.location.href = '../etapa-3/match.html';
                }
                
                // Solo salimos si dice explícitamente CANCELLED
                if (status === 'CANCELLED' || status === 'FINISHED') {
                    console.log("Polling: Partida finalizada por el servidor.");
                    clearInterval(safetyInterval);
                    alert("La partida ha finalizado.");
                    window.location.href = '../etapa-1/lobby.html';
                }
            }
        } catch (e) {
            // Ignorar errores de red
        }
    }, 3000); 
}