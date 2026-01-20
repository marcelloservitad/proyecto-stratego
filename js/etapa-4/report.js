const API_BASE = 'https://stratego-api.koyeb.app/api';

const state = {
    userId: sessionStorage.getItem('strategoUserId'),
    matchId: sessionStorage.getItem('strategoMatchId'),
    team: sessionStorage.getItem('strategoTeam')
};

// ==========================================
// 1. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Verificación de seguridad SUAVE
    // Si no hay matchId, quizás recargó la página. Lo mandamos al lobby.
    if (!state.matchId || !state.userId) {
        console.warn("Faltan datos de sesión. Redirigiendo...");
        window.location.href = '../etapa-1/lobby.html';
        return;
    }

    // Configurar botón de salida
    document.getElementById('btnBackToLobby').addEventListener('click', handleExit);

    // Cargar datos
    loadReport();
});

// ==========================================
// 2. OBTENER DATOS DEL SERVIDOR
// ==========================================
async function loadReport() {
    try {
        // Intentamos obtener el estado final de la partida
        // Usamos el endpoint genérico o el de estado
        const response = await fetch(`${API_BASE}/matches/${state.matchId}`, {
            headers: {
                'Authorization': `Bearer ${state.userId}`,
                'Content-Type': 'application/json'
            }
        });

        // NOTA: Si el servidor ya borró la partida (404), mostramos datos genéricos
        if (response.status === 404) {
            renderFallbackResult();
            return;
        }

        if (response.ok) {
            const data = await response.json();
            renderResult(data);
        } else {
            renderFallbackResult();
        }

    } catch (error) {
        console.error("Error cargando reporte:", error);
        renderFallbackResult();
    }
}

// ==========================================
// 3. RENDERIZADO (UI)
// ==========================================
function renderResult(matchData) {
    const titleEl = document.getElementById('outcome-text');
    const reasonEl = document.getElementById('reason-text');
    const winnerEl = document.getElementById('winner-name');
    const timeEl = document.getElementById('match-duration');
    const teamEl = document.getElementById('my-team');
    const idEl = document.getElementById('match-id-display');
    const container = document.getElementById('report-card');

    // 1. Determinar si gané o perdí
    const winnerId = matchData.winner ? matchData.winner.userId : null; // Depende de tu API structure
    const winnerTeam = matchData.winnerTeam; // O winnerTeam: 'RED'/'BLUE'

    let isVictory = false;

    // Lógica A: Si viene el objeto winner con userId
    if (winnerId) {
        isVictory = (String(winnerId) === String(state.userId));
    } 
    // Lógica B: Si viene solo el equipo ganador (RED/BLUE)
    else if (winnerTeam) {
        isVictory = (winnerTeam === state.team);
    }

    // 2. Pintar UI
    if (isVictory) {
        titleEl.textContent = "¡VICTORIA!";
        document.body.classList.add('win-theme');
        container.style.borderColor = "#2ecc71";
    } else {
        titleEl.textContent = "DERROTA";
        document.body.classList.add('lose-theme');
        container.style.borderColor = "#e74c3c";
    }

    // 3. Razón (Captura bandera, Rendición, etc)
    // Muchas APIs no envían la razón exacta en el GET, así que ponemos un genérico o lo buscamos
    reasonEl.textContent = "Partida finalizada oficial.";

    // 4. Datos extra
    winnerEl.textContent = isVictory ? "Tú" : "Oponente";
    teamEl.textContent = state.team;
    idEl.textContent = state.matchId;
    
    // Calcular duración si hay fechas
    if (matchData.createdAt && matchData.finishedAt) {
        const start = new Date(matchData.createdAt);
        const end = new Date(matchData.finishedAt);
        const diffMins = Math.round((end - start) / 60000);
        timeEl.textContent = `${diffMins} min`;
    } else {
        timeEl.textContent = "--";
    }
}

// Si la API falla o da 404 (partida borrada), mostramos esto para no dejar pantalla en blanco
function renderFallbackResult() {
    const titleEl = document.getElementById('outcome-text');
    const reasonEl = document.getElementById('reason-text');
    
    titleEl.textContent = "FIN DEL JUEGO";
    reasonEl.textContent = "La partida ha concluido (Datos no disponibles).";
    
    document.getElementById('winner-name').textContent = "?";
    document.getElementById('match-id-display').textContent = state.matchId;
}

// ==========================================
// 4. SALIDA SEGURA (LIMPIEZA)
// ==========================================
function handleExit() {
    // AQUI y SOLO AQUI es donde borramos la sesión de la partida
    sessionStorage.removeItem('strategoMatchId');
    sessionStorage.removeItem('strategoTeam');
    sessionStorage.removeItem('strategoOpponentPositions');
    sessionStorage.removeItem('strategoLocalSetupPieces');
    
    // NO borramos userId para seguir logueados
    
    window.location.href = '../etapa-1/lobby.html';
}