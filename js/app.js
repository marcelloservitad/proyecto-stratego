// Estado global de la aplicación
const AppState = {
    user: {
        id: null,
        username: null,
        rating: 1200
    },
    connection: {
        ws: null,
        isConnected: false,
        protocolMode: null // 'SOCKET_FIRST' o 'FETCH_FIRST'
    },
    currentGame: {
        id: null,
        opponent: null,
        mode: null, // 'pvp' o 'pve'
        gameType: null, // 'classic' o 'quick'
        board: null,
        turn: null,
        status: 'idle' // 'idle', 'waiting', 'playing', 'finished'
    },
    notifications: []
};

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Verificar si hay usuario guardado
    const savedUser = localStorage.getItem('stratego_user');
    
    if (savedUser) {
        AppState.user = JSON.parse(savedUser);
        safeSetTextContent('username', AppState.user.username);
    } else {
        // Solo pedir nombre en página principal 
        if (window.location.pathname.includes('index.html') || 
            window.location.pathname.endsWith('/')) {
            const username = prompt('Ingresa tu nombre de general:') || `General_${Date.now()}`;
            AppState.user = {
                id: generateId(),
                username: username,
                rating: 1200,
                wins: 0,
                losses: 0,
                pveWins: 0
            };
            localStorage.setItem('stratego_user', JSON.stringify(AppState.user));
            safeSetTextContent('username', username);
        }
    }
    
    // Solo inicializar WebSocket en páginas que lo necesiten
    if (shouldInitializeWebSocket()) {
        initializeWebSocket();
    }
    
    // Configurar event listeners solo si existen
    setupEventListeners();
}

// Función segura para establecer contenido de texto
function safeSetTextContent(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    } else {
        console.log(`Elemento #${elementId} no encontrado en esta página`);
    }
}

// Determinar si la página actual necesita WebSocket
function shouldInitializeWebSocket() {
    const currentPage = window.location.pathname;
    // Páginas que necesitan WebSocket
    const pagesWithWebSocket = [
        'index.html',
        'game.html',
        'lobby.html'
    ];
    
    // Si estamos en la raíz o en una página que necesita WebSocket
    return currentPage.endsWith('/') || 
           pagesWithWebSocket.some(page => currentPage.includes(page));
}

function generateId() {
    return 'user_' + Math.random().toString(36).substr(2, 9);
}

function initializeWebSocket() {
    const wsUrl = 'ws://localhost:3000'; // Cambiar según  el servidor
    AppState.connection.ws = new WebSocket(wsUrl);
    
    AppState.connection.ws.onopen = () => {
        console.log('WebSocket conectado');
        AppState.connection.isConnected = true;
        updateConnectionStatus(true);
        
        // Registrar usuario en el servidor
        sendWebSocketMessage({
            type: 'register',
            user: AppState.user
        });
    };
    
    AppState.connection.ws.onmessage = (event) => {
        handleWebSocketMessage(JSON.parse(event.data));
    };
    
    AppState.connection.ws.onclose = () => {
        console.log('WebSocket desconectado');
        AppState.connection.isConnected = false;
        updateConnectionStatus(false);
        
        // Intentar reconectar después de 5 segundos
        setTimeout(initializeWebSocket, 5000);
    };
    
    AppState.connection.ws.onerror = (error) => {
        console.error('Error en WebSocket:', error);
    };
}

function sendWebSocketMessage(message) {
    if (AppState.connection.ws && AppState.connection.ws.readyState === WebSocket.OPEN) {
        AppState.connection.ws.send(JSON.stringify(message));
        return true;
    }
    return false;
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'player_list':
            updatePlayersList(data.players);
            break;
        case 'chat_message':
            addChatMessage(data.sender, data.message, data.isSystem);
            break;
        case 'challenge_received':
            showIncomingChallenge(data);
            break;
        case 'challenge_accepted':
            handleChallengeAccepted(data);
            break;
        case 'challenge_rejected':
            handleChallengeRejected(data);
            break;
        case 'game_start':
            startGame(data);
            break;
        case 'game_move':
            handleGameMove(data);
            break;
        case 'game_over':
            handleGameOver(data);
            break;
        default:
            console.log('Mensaje no manejado:', data);
    }
}

function updateConnectionStatus(isConnected) {
    const statusEl = document.getElementById('connection-status');
    if (!statusEl) {
        console.log('Elemento #connection-status no encontrado en esta página');
        return;
    }
    
    const dot = statusEl.querySelector('.status-dot');
    const text = statusEl.querySelector('span:last-child');
    
    if (isConnected) {
        if (dot) dot.className = 'status-dot connected';
        if (text) text.textContent = 'Conectado';
    } else {
        if (dot) dot.className = 'status-dot disconnected';
        if (text) text.textContent = 'Desconectado';
    }
}

function setupEventListeners() {
    // Botón de logout 
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('stratego_user');
            location.reload();
        });
    }
    

}

// Funciones dummy para evitar errores 
function updatePlayersList(players) {
    console.log('Actualizando lista de jugadores:', players);
}

function addChatMessage(sender, message, isSystem) {
    console.log(`Chat: ${sender}: ${message} (${isSystem ? 'system' : 'user'})`);
}

function showIncomingChallenge(data) {
    console.log('Desafío recibido:', data);
}

function handleChallengeAccepted(data) {
    console.log('Desafío aceptado:', data);
}

function handleChallengeRejected(data) {
    console.log('Desafío rechazado:', data);
}

function startGame(data) {
    console.log('Juego iniciado:', data);
}

function handleGameMove(data) {
    console.log('Movimiento del juego:', data);
}

function handleGameOver(data) {
    console.log('Juego terminado:', data);
}