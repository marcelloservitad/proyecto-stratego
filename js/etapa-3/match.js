/* js/etapa-3/match.js - FINAL CORREGIDO */

const API_BASE = 'https://stratego-api.koyeb.app/api';
const BOARD_SIZE = 10;

const LAKES = new Set([
    keyOf(2, 4), keyOf(3, 4), keyOf(2, 5), keyOf(3, 5),
    keyOf(6, 4), keyOf(7, 4), keyOf(6, 5), keyOf(7, 5),
]);

const elements = {
    board: document.getElementById('board'),
    protocolModeText: document.getElementById('protocolModeText'),
    turnText: document.getElementById('turnText'),
    statusText: document.getElementById('realtimeStatusText'),
};

const state = {
    userId: sessionStorage.getItem('strategoUserId') || localStorage.getItem('strategoUserId'),
    matchId: sessionStorage.getItem('strategoMatchId'),
    team: sessionStorage.getItem('strategoTeam') || 'RED',
    protocolMode: sessionStorage.getItem('strategoProtocolMode') || 'FETCH_FIRST',

    localPieces: loadJsonArray('strategoLocalSetupPieces'),
    opponentPositions: loadJsonArray('strategoOpponentPositions'),

    match: null,
    selectedFrom: null,
    highlightedTargets: new Set(),
    highlightedAttacks: new Set(),
    eventSource: null,

    isProcessing: false
};

// ==========================================
// 1. INYECCIÓN UI (SOLO UNA VEZ)
// ==========================================
injectGameUI();

function injectGameUI() {
    if (document.getElementById('combat-modal')) return;

    const style = document.createElement('style');
    style.innerHTML = `
        .board-locked { opacity: 0.6; pointer-events: none; filter: grayscale(0.4); transition: opacity 0.3s; }
        
        #combat-modal {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.9); display: flex; flex-direction: column; 
            justify-content: center; align-items: center; z-index: 10000; 
            opacity: 0; pointer-events: none; transition: opacity 0.3s; color: white;
            font-family: 'Courier New', Courier, monospace;
        }
        #combat-modal.active { opacity: 1; pointer-events: all; }
        
        .arena { display: flex; gap: 40px; align-items: center; margin-bottom: 30px; }
        
        .fighter { 
            display: flex; flex-direction: column; align-items: center; 
            background: rgba(255,255,255,0.1); padding: 20px; border-radius: 15px;
            width: 140px; border: 2px solid #555; transition: all 0.3s;
        }
        .fighter.winner { border-color: #2ecc71; box-shadow: 0 0 20px #2ecc71; transform: scale(1.1); }
        .fighter.loser { opacity: 0.5; filter: grayscale(1); transform: scale(0.9); }
        
        .fighter-icon { font-size: 4rem; margin-bottom: 10px; }
        .fighter-name { font-size: 0.9rem; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; }
        .fighter-rank { font-size: 2rem; font-weight: bold; color: #f1c40f; text-shadow: 2px 2px 0 #000; }
        
        .vs { font-size: 3rem; font-weight: bold; color: #e74c3c; font-style: italic;}
        
        .result-box { text-align: center; }
        .result-title { font-size: 3rem; font-weight: bold; text-shadow: 0 0 20px black; margin-bottom: 10px; }
        .result-reason { font-size: 1.2rem; color: #ccc; max-width: 80%; margin: 0 auto; }
    `;
    document.head.appendChild(style);

    const modal = document.createElement('div');
    modal.id = 'combat-modal';
    // HTML CORRECTO CON LOS IDs QUE BUSCA EL JAVASCRIPT
    modal.innerHTML = `
        <div class="arena">
            <div class="fighter" id="c-attacker-card">
                <div class="fighter-name">Atacante</div>
                <div class="fighter-icon" id="c-atk-icon"></div>
                <div class="fighter-rank" id="c-atk-rank"></div>
            </div>
            
            <div class="vs">VS</div>
            
            <div class="fighter" id="c-defender-card">
                <div class="fighter-name">Defensor</div>
                <div class="fighter-icon" id="c-def-icon"></div>
                <div class="fighter-rank" id="c-def-rank"></div>
            </div>
        </div>
        
        <div class="result-box">
            <div class="result-title" id="c-result-title"></div>
            <div class="result-reason" id="c-result-desc"></div>
        </div>
    `;
    document.body.appendChild(modal);
}

// ==========================================
// 2. BOOT
// ==========================================
boot();

async function boot() {
    applyTeamTheme();
    hydrateHeader();
    renderBoard();

    if (!state.userId || !state.matchId) {
        updateStatus('Error: Faltan credenciales.');
        return;
    }

    const btnForfeit = document.getElementById('btnForfeit');
    
    if (btnForfeit) {
        console.log("✅ Botón de rendirse detectado correctamente.");
        // Limpiamos listeners previos clonando el botón (truco para evitar duplicados)
        const newBtn = btnForfeit.cloneNode(true);
        btnForfeit.parentNode.replaceChild(newBtn, btnForfeit);
        
        // Agregamos el evento click
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("🏳️ Click en Rendirse");
            surrenderMatch();
        });
    } else {
        console.error("❌ ERROR: No se encontró el botón con id='btnForfeit'");
    }

    if (window.Chat) {
            console.log("💬 Iniciando módulo de Chat...");
            window.Chat.init(state.userId, state.matchId);
        }  

    try {
        await loadMatch();
        renderBoard();
        startRealtimeChannels();
        startSafetyPolling();
        updateStatus('Conectado. Esperando turno...');
        
        if (window.Chat) {
            window.Chat.init(state.userId, state.matchId);
        }
    } catch (error) {
        console.error('Error boot:', error);
        startRealtimeChannels();
        startSafetyPolling(); 
        updateStatus('Modo desconectado (Recuperando...).');
    }
}


// ==========================================
// 3. SINCRONIZACIÓN Y SEGURIDAD
// ==========================================
async function loadMatch() {
    try {
        const response = await fetch(`${API_BASE}/matches/${state.matchId.trim()}/state`, {
            headers: buildAuthHeaders(state.userId)
        });

        if (response.ok) {
            const data = await response.json();
            state.match = data;
            
            const pieces = data.board || [];
            state.localPieces = pieces.filter(p => p.team === state.team);
            state.opponentPositions = pieces
                .filter(p => p.team !== state.team)
                .map(p => ({ x: p.position.x, y: p.position.y }));
            
            hydrateTurnUi();

            if (isMyTurn()) {
                if (state.isProcessing) {
                    console.log("🔓 Desbloqueo de seguridad activado");
                    state.isProcessing = false;
                    renderBoard(); 
                }
            }
        }
    } catch (e) { console.warn("Sync error", e); }
}

function startSafetyPolling() {
    setInterval(() => {
        const modal = document.getElementById('combat-modal');
        if (!modal.classList.contains('active')) {
            loadMatch().then(renderBoard);
        }
    }, 3000); 
}

// ==========================================
// 4. RENDERIZADO
// ==========================================
function renderBoard() {
    if (!elements.board) return;
    elements.board.innerHTML = '';

    const isLocked = !isMyTurn() || state.isProcessing;
    if (isLocked) elements.board.classList.add('board-locked');
    else elements.board.classList.remove('board-locked');

    const localMap = buildLocalMap();
    const enemyMap = buildEnemyMap();

    for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
            const cellKey = keyOf(x, y);
            const button = document.createElement('button');
            button.className = 'cell';
            button.dataset.x = x; button.dataset.y = y;

            if (LAKES.has(cellKey)) button.classList.add('lake');
            if (isEnemyZoneRow(y)) button.classList.add('enemy-zone');
            if (isAllyZoneRow(y)) button.classList.add('ally-zone');

            if (state.selectedFrom?.x === x && state.selectedFrom?.y === y) button.classList.add('selected');
            if (state.highlightedTargets.has(cellKey)) button.classList.add('move-target');
            if (state.highlightedAttacks.has(cellKey)) button.classList.add('attack-target');

            if (localMap.has(cellKey)) {
                const p = localMap.get(cellKey);
                const span = document.createElement('span');
                span.className = 'piece ally-piece';
                if (p.isRevealed) span.classList.add('revealed');
                span.textContent = getPieceSymbol(p.type, p.rank);
                
                // Tooltip
                const tooltipText = `${p.type} (${getRankDisplay(p.type, p.rank)})`;
                button.setAttribute('data-tooltip', tooltipText);
                
                button.appendChild(span);
            } 
            else if (enemyMap.has(cellKey)) {
                const span = document.createElement('span');
                span.className = 'piece enemy-hidden';
                span.textContent = '❓';
                button.appendChild(span);
            }

            button.addEventListener('click', handleCellClick);
            elements.board.appendChild(button);
        }
    }
}

// ==========================================
// 5. INTERACCIÓN
// ==========================================
async function handleCellClick(event) {
    const x = parseInt(event.currentTarget.dataset.x, 10);
    const y = parseInt(event.currentTarget.dataset.y, 10);
    const cellKey = keyOf(x, y);

    if (LAKES.has(cellKey)) return;
    if (!isMyTurn() || state.isProcessing) return;

    if (state.selectedFrom) {
        if (state.highlightedTargets.has(cellKey) || state.highlightedAttacks.has(cellKey)) {
            const from = { ...state.selectedFrom };
            const to = { x, y };
            clearSelection();
            renderBoard(); 
            await sendMove(from, to);
            return;
        }
    }

    const localMap = buildLocalMap();
    if (localMap.has(cellKey)) {
        const p = localMap.get(cellKey);
        if (p.type === 'BOMB' || p.type === 'FLAG') {
            updateStatus('Unidad inmóvil 🚫');
            return;
        }
        state.selectedFrom = { x, y };
        calculateLegalMoves(p);
        renderBoard();
        return;
    }

    clearSelection();
    renderBoard();
}

// ==========================================
// 6. ENVÍO DE JUGADA
// ==========================================
async function sendMove(from, to) {
    state.isProcessing = true; 
    renderBoard(); 
    updateStatus('Enviando...');
    
    // Optimista
    const pIndex = state.localPieces.findIndex(p => p.position.x === from.x && p.position.y === from.y);
    if (pIndex !== -1) {
        state.localPieces[pIndex].position = { x: to.x, y: to.y };
        renderBoard(); 
    }

    try {
        const response = await fetch(`${API_BASE}/matches/${state.matchId.trim()}/moves`, {
            method: 'POST',
            headers: buildAuthHeaders(state.userId),
            body: JSON.stringify({ from: { x: +from.x, y: +from.y }, to: { x: +to.x, y: +to.y } }),
        });

        if (response.ok || response.status === 202) {
            updateStatus('Esperando al rival...');
        } else {
            console.warn("Rechazado");
            await loadMatch(); 
            state.isProcessing = false;
            renderBoard();
        }
    } catch (e) {
        await loadMatch();
        state.isProcessing = false;
        renderBoard();
    }
}

// ==========================================
// 7. REALTIME & COMBAT MODAL
// ==========================================
function startRealtimeChannels() {
    if (state.eventSource) state.eventSource.close();
    state.eventSource = new EventSource(`${API_BASE}/events/stream?userId=${encodeURIComponent(state.userId)}`);

    state.eventSource.addEventListener('opponent_moved', () => {
        loadMatch().then(renderBoard);
    });

    state.eventSource.addEventListener('combat_result', async (e) => {
        try {
            const data = JSON.parse(e.data);
            const payload = data.info || data.data || data;
            
            console.log("⚔️ COMBATE:", payload);

            state.isProcessing = true; 
            renderBoard(); 

            await showCombatModal(payload);
            
            await loadMatch();
            renderBoard(); // Desbloqueo (se hará en loadMatch si es mi turno)

        } catch (err) {
            console.error("Error modal:", err);
            state.isProcessing = false;
            renderBoard();
        }
    });

    state.eventSource.addEventListener('game_over', (e) => {
        const data = JSON.parse(e.data);
        alert(`FIN DE JUEGO. Ganador: ${data.winner?.username || '...'}`);
        window.location.href = '../../html/etapa-4/report.html';
    });

    state.eventSource.addEventListener('match_chat_message', (e) => {
        try {
            const data = JSON.parse(e.data);
            const payload = data.info || data.data || data; 
            
            if (window.Chat && payload.matchId === state.matchId) {
                const fromObj = payload.from || {};
                const senderId = String(fromObj.userId || payload.userId || '');
                const senderName = fromObj.username || 'Rival';

                if (senderId !== state.userId) {
                    window.Chat.renderMessage(senderName, payload.content, 'OPPONENT');
                }
            }
        } catch (err) {}
    });


    state.eventSource.addEventListener('match_cancelled', (e) => {
        console.log("🚫 Evento match_cancelled recibido.");
        
        // 1. Notificar al usuario
        alert("⚠️ ¡La partida ha sido cancelada o el oponente se rindió!\n\nVolviendo al Lobby...");

        // 2. Limpiar datos de sesión (Igual que en surrenderMatch)
        sessionStorage.removeItem('strategoMatchId');
        sessionStorage.removeItem('strategoTeam');
        sessionStorage.removeItem('strategoOpponentPositions');
        sessionStorage.removeItem('strategoLocalSetupPieces');

        // 3. Redirigir al Lobby
        window.location.href = '../../html/etapa-1/lobby.html';
    });

}

function showCombatModal(data) {
    return new Promise((resolve) => {
        // 1. Obtener el Modal (ID coincidente con tu HTML)
        const modal = document.getElementById('modal-combate');
        
        // Si no existe, resolvemos para no trabar el juego
        if (!modal) { resolve(); return; }
        
        // Elementos internos
        const elTitle = document.getElementById('modal-titulo');
        const elDesc = document.getElementById('modal-desc');
        const cardAtk = document.getElementById('card-atk');
        const iconAtk = document.getElementById('icon-atk');
        const rankAtk = document.getElementById('rank-atk');
        const cardDef = document.getElementById('card-def');
        const iconDef = document.getElementById('icon-def');
        const rankDef = document.getElementById('rank-def');

        // Reset de estilos
        cardAtk.className = 'fighter-card';
        cardDef.className = 'fighter-card';

        // Datos
        const atk = data.attacker;
        const def = data.defender;
        const myTeam = state.team;

        // Renderizar Info
        iconAtk.textContent = getPieceSymbol(atk.type, atk.rank);
        rankAtk.textContent = getRankDisplay(atk.type, atk.rank);
        iconDef.textContent = getPieceSymbol(def.type, def.rank);
        rankDef.textContent = getRankDisplay(def.type, def.rank);

        // --- LÓGICA DE GANADOR ---
        const result = resolveCombatLocally(atk, def);
        let flagCaptured = false;

        // A. CASO BANDERA (El que faltaba)
        if (result === 'CAPTURE_FLAG') {
            elTitle.textContent = "¡BANDERA CAPTURADA!";
            elTitle.style.color = "#f1c40f"; // Oro
            elDesc.textContent = "Victoria inminente...";
            
            cardAtk.classList.add('winner');
            cardDef.classList.add('loser');
            flagCaptured = true;
        } 
        // B. CASO EMPATE
        else if (result === 'DRAW') {
            elTitle.textContent = "¡EMPATE!";
            elTitle.style.color = "#bdc3c7";
            elDesc.textContent = `Ambas piezas (${atk.type}) eliminadas.`;
            cardAtk.classList.add('loser');
            cardDef.classList.add('loser');
        } 
        // C. CASO NORMAL
        else {
            const winnerTeam = (result === 'ATTACKER') ? atk.team : def.team;
            const iWon = (winnerTeam === myTeam);

            if (iWon) {
                elTitle.textContent = "¡VICTORIA!";
                elTitle.style.color = "#2ecc71";
                elDesc.textContent = "Has ganado el combate.";
            } else {
                elTitle.textContent = "DERROTA";
                elTitle.style.color = "#e74c3c";
                elDesc.textContent = "Has perdido una pieza.";
            }

            if (result === 'ATTACKER') {
                cardAtk.classList.add('winner');
                cardDef.classList.add('loser');
            } else {
                cardDef.classList.add('winner');
                cardAtk.classList.add('loser');
            }
        }

        // MOSTRAR
        modal.classList.remove('hidden');

        // OCULTAR Y REDIRIGIR
        setTimeout(() => {
            modal.classList.add('hidden');
            resolve(); // Libera el juego

            // --- AQUÍ ESTÁ LA SOLUCIÓN AL FALLO ---
            if (flagCaptured) {
                console.log("🚩 Bandera capturada: Finalizando juego...");
                window.location.href = '../../html/etapa-4/report.html';
            }
        }, 3000);
    });
}

function resolveCombatRuleEngine(atk, def) {
    const rankA = atk.rank;
    const rankD = def.rank;

    if (rankA === -1 || rankD === -1) return 'DRAW'; 

    // 1. BANDERA: Detecta si la pieza defensora es la bandera (por Tipo o Rango 0)
    // Esto devolverá 'CAPTURE_FLAG' para AMBOS jugadores.
    if (def.type === 'FLAG' || def.rank === 0 || def.rank === '0') {
        return 'CAPTURE_FLAG';
    }

    // 2. Bomba
    if (def.type === 'BOMB' || def.rank === 'B' || def.rank === 11) {
        return (atk.type === 'MINER' || atk.rank === 8) ? 'ATTACKER' : 'DEFENDER';
    }
    
    // 3. Espía vs Mariscal
    if ((atk.type === 'SPY' || atk.rank === 'S' || atk.rank === 10) && 
        (def.type === 'MARSHAL' || def.rank === 1)) {
        return 'ATTACKER';
    }

    // 4. Estándar
    const rA = Number(rankA);
    const rD = Number(rankD);

    if (rA < rD) return 'ATTACKER';
    if (rA > rD) return 'DEFENDER';
    
    return 'DRAW';
}



function showCombatModal(data) {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-combate');
        if (!modal) { resolve(); return; }

        const elTitle = document.getElementById('modal-titulo');
        const elDesc = document.getElementById('modal-desc');
        const cardAtk = document.getElementById('card-atk');
        const cardDef = document.getElementById('card-def');
        
        const atk = data.attacker;
        const def = data.defender;
        const myTeam = state.team;

        // Reset Estilos
        cardAtk.className = 'fighter-card';
        cardDef.className = 'fighter-card';

        // Llenar Datos
        document.getElementById('icon-atk').textContent = getPieceSymbol(atk.type, atk.rank);
        document.getElementById('rank-atk').textContent = getRankDisplay(atk.type, atk.rank);
        document.getElementById('icon-def').textContent = getPieceSymbol(def.type, def.rank);
        document.getElementById('rank-def').textContent = getRankDisplay(def.type, def.rank);

        // --- LÓGICA DE VISUALIZACIÓN ---
        const result = resolveCombatRuleEngine(atk, def);
        let flagCaptured = false;

        // CASO 1: CAPTURA DE BANDERA (Aplica a AMBOS)
        if (result === 'CAPTURE_FLAG') {
            flagCaptured = true;
            
            // Verificamos de quién era la bandera para dar el mensaje correcto
            const isMyFlag = (def.team === myTeam);

            if (isMyFlag) {
                // YO PERDÍ (Soy el defensor y tenía la bandera)
                elTitle.textContent = "¡HAS PERDIDO LA BANDERA!";
                elTitle.style.color = "#e74c3c"; // Rojo
                elDesc.textContent = "Derrota inminente. Finalizando partida...";
                cardDef.classList.add('loser'); // Mi bandera pierde
                cardAtk.classList.add('winner');
            } else {
                // YO GANÉ (Soy el atacante y capturé su bandera)
                elTitle.textContent = "¡BANDERA CAPTURADA!";
                elTitle.style.color = "#f1c40f"; // Oro/Verde
                elDesc.textContent = "¡Victoria! Finalizando partida...";
                cardAtk.classList.add('winner'); // Yo gano
                cardDef.classList.add('loser');
            }
        } 
        // CASO 2: EMPATE
        else if (result === 'DRAW') {
            elTitle.textContent = "¡EMPATE!";
            elTitle.style.color = "#bdc3c7";
            elDesc.textContent = `Ambas piezas (${atk.type}) eliminadas.`;
            cardAtk.classList.add('loser');
            cardDef.classList.add('loser');
        } 
        // CASO 3: COMBATE NORMAL
        else {
            const winnerTeam = (result === 'ATTACKER') ? atk.team : def.team;
            const iWon = (winnerTeam === myTeam);

            if (iWon) {
                elTitle.textContent = "¡VICTORIA!";
                elTitle.style.color = "#2ecc71";
                elDesc.textContent = "Has ganado el combate.";
            } else {
                elTitle.textContent = "DERROTA";
                elTitle.style.color = "#e74c3c";
                elDesc.textContent = "Has perdido una pieza.";
            }

            if (result === 'ATTACKER') {
                cardAtk.classList.add('winner');
                cardDef.classList.add('loser');
            } else {
                cardDef.classList.add('winner');
                cardAtk.classList.add('loser');
            }
        }

        // MOSTRAR MODAL
        modal.classList.remove('hidden');

        // OCULTAR Y SALIR
        setTimeout(() => {
            modal.classList.add('hidden');
            resolve(); // Desbloquea el juego

            // 🛑 SI HUBO CAPTURA DE BANDERA, NOS VAMOS LOS DOS AL REPORTE
            if (flagCaptured) {
                console.log("🚩 Fin de juego por Bandera. Redirigiendo a ambos...");
                handleGameOver(); // Esta función ya la tienes y redirige al report.html
            }
        }, 3000); // 3 segundos de drama
    });
}



// Función auxiliar necesaria
function getRankDisplay(type, rank) {
    if (type === 'BOMB') return 'B';
    if (type === 'FLAG') return 'F';
    if (type === 'SPY') return 'S';
    return rank;
}

function resolveCombatLocally(atk, def) {
    const a = Number(atk.rank);
    const d = Number(def.rank);
    
    // --- 1. DETECCIÓN DE BANDERA (CORREGIDO) ---
    // Verificamos si es Tipo 'FLAG' O si el Rango es 0
    if (def.type === 'FLAG' || def.rank === 0 || def.rank === '0') {
        return 'CAPTURE_FLAG';
    }

    // --- 2. REGLAS ESPECIALES ---
    // Bomba (11 o 'B'): Solo el Minero (8) gana
    if (def.type === 'BOMB' || def.rank === 'B' || def.rank === 11) {
        return (atk.type === 'MINER' || atk.rank === 8) ? 'ATTACKER' : 'DEFENDER';
    }
    
    // Espía (S o 10): Gana al Mariscal (1) si ataca
    if ((atk.type === 'SPY' || atk.rank === 'S' || atk.rank === 10) && 
        (def.type === 'MARSHAL' || def.rank === 1)) {
        return 'ATTACKER';
    }
    
    // --- 3. COMBATE ESTÁNDAR ---
    // Menor rango gana (Ej: 1 gana a 9)
    if (a < d) return 'ATTACKER';
    if (a > d) return 'DEFENDER';
    return 'DRAW'; 
}

function getRankDisplay(type, rank) {
    if (type === 'BOMB') return 'B';
    if (type === 'FLAG') return 'F';
    if (type === 'SPY') return 'S';
    return rank;
}

// ==========================================
// 8. HELPERS & ABANDONO
// ==========================================
function calculateLegalMoves(piece) {
    state.highlightedTargets.clear();
    state.highlightedAttacks.clear();
    const { x, y } = piece.position;
    const localMap = buildLocalMap();
    const enemyMap = buildEnemyMap();
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    const maxDist = piece.type === 'SCOUT' ? 9 : 1;

    dirs.forEach(([dx, dy]) => {
        for (let i = 1; i <= maxDist; i++) {
            const nx = x + (dx * i);
            const ny = y + (dy * i);
            const key = keyOf(nx, ny);
            if (!isInside(nx, ny) || LAKES.has(key) || localMap.has(key)) break;
            if (enemyMap.has(key)) {
                state.highlightedAttacks.add(key);
                break; 
            }
            state.highlightedTargets.add(key);
        }
    });
}

function getPieceSymbol(type, rank) {
    if (type === 'HIDDEN' || rank === -1) return '❓'; 
    const t = type ? type.toLowerCase() : '';
    const symbols = {
        'marshal': '🎖️', 'general': '⭐', 'colonel': '🦅', 'major': '⚔️',
        'captain': '🛡️', 'lieutenant': '⚜️', 'sergeant': '🔰', 'miner': '⛏️',
        'scout': '👁️', 'spy': '🕵️', 'bomb': '💣', 'flag': '🏁'
    };
    return symbols[t] || rank;
}

async function surrenderMatch() {
    const confirmacion = confirm("⚠️ ¿Estás seguro de que quieres rendirte?\n\nEsta acción terminará la partida inmediatamente y contarás con una derrota.");
    
    if (!confirmacion) return;
    
    console.log("Enviando petición de rendición...");
    updateStatus("Enviando rendición...");
    state.isProcessing = true; // Bloqueamos el tablero

    try {
        const response = await fetch(`${API_BASE}/matches/${state.matchId}/forfeit`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.userId}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: "VOLUNTARY" })
        });

        if (response.ok || response.status === 202) {
            console.log("Rendición aceptada. Redirigiendo...");
            updateStatus("Te has rendido. Volviendo al Lobby...");
            
            // --- CAMBIO: Redirección manual al Lobby tras 1.5 segundos ---
            setTimeout(() => {
                // Importante: Limpiamos datos de la partida actual para evitar errores al entrar a una nueva
                sessionStorage.removeItem('strategoMatchId');
                sessionStorage.removeItem('strategoTeam');
                sessionStorage.removeItem('strategoOpponentPositions');
                sessionStorage.removeItem('strategoLocalSetupPieces');
                
                // Redirigir al Lobby
                window.location.href = '../../html/etapa-1/lobby.html';
            }, 1500);

        } else {
            console.error("Error al rendirse:", await response.text());
            state.isProcessing = false;
            alert("Error: El servidor no procesó la rendición.");
        }

    } catch (error) {
        console.error(error);
        state.isProcessing = false;
        alert("Error de conexión al intentar rendirse.");
    }
}

function updateStatus(msg) { if (elements.statusText) elements.statusText.textContent = msg; }
function clearSelection() { state.selectedFrom = null; state.highlightedTargets.clear(); state.highlightedAttacks.clear(); }
function hydrateHeader() { if(elements.protocolModeText) elements.protocolModeText.textContent = state.protocolMode; }
function hydrateTurnUi() {
    if (elements.turnText && state.match) {
        const myTurn = state.match.turn === state.team;
        elements.turnText.textContent = myTurn ? "TU TURNO" : "TURNO RIVAL";
        elements.turnText.style.color = myTurn ? "#2ecc71" : "#e74c3c";
    }
}
function buildLocalMap() { const m = new Map(); state.localPieces.forEach(p => m.set(keyOf(p.position.x, p.position.y), p)); return m; }
function buildEnemyMap() { const m = new Set(); state.opponentPositions.forEach(p => m.add(keyOf(p.x, p.y))); return m; }
function isMyTurn() { return state.match?.turn === state.team; }
function buildAuthHeaders(uid) { return { 'Authorization': `Bearer ${uid}`, 'X-USER-ID': uid, 'Content-Type': 'application/json' }; }
function keyOf(x, y) { return `${x},${y}`; }
function isInside(x, y) { return x >= 0 && x < 10 && y >= 0 && y < 10; }
function isEnemyZoneRow(y) { return y >= 0 && y <= 3; }
function isAllyZoneRow(y) { return y >= 6 && y <= 9; }
function loadJsonArray(k) { try { return JSON.parse(sessionStorage.getItem(k)) || []; } catch { return []; } }
function applyTeamTheme() { document.body.classList.add(state.team === 'BLUE' ? 'team-blue' : 'team-red'); }