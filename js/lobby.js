// Variables del lobby
let selectedOpponent = null;

// Inicializar lobby
function initializeLobby() {
    // Configurar lista de jugadores
    document.getElementById('players-list').addEventListener('click', (e) => {
        const playerItem = e.target.closest('.player-item');
        if (playerItem && !playerItem.classList.contains('selected')) {
            selectPlayer(playerItem);
        }
    });
    
    // Botón PvE
    document.getElementById('pve-btn').addEventListener('click', () => {
        const options = document.getElementById('pve-options');
        options.classList.toggle('hidden');
    });
    
    // Iniciar PvE
    document.getElementById('start-pve').addEventListener('click', startPvEGame);
    
    // Enviar mensaje de chat
    document.getElementById('send-message').addEventListener('click', sendChatMessage);
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
    
    // Modales de desafío
    document.getElementById('send-challenge').addEventListener('click', sendChallenge);
    document.getElementById('cancel-challenge').addEventListener('click', () => {
        document.getElementById('challenge-modal').classList.add('hidden');
    });
    
    // Desafíos recibidos
    document.getElementById('accept-challenge').addEventListener('click', acceptChallenge);
    document.getElementById('reject-challenge').addEventListener('click', rejectChallenge);
}

function selectPlayer(playerElement) {
    // Deseleccionar cualquier jugador seleccionado anteriormente
    const previouslySelected = document.querySelector('.player-item.selected');
    if (previouslySelected) {
        previouslySelected.classList.remove('selected');
    }
    
    // Seleccionar nuevo jugador
    playerElement.classList.add('selected');
    selectedOpponent = {
        id: playerElement.dataset.playerId,
        username: playerElement.querySelector('.player-name').textContent
    };
    
    // Mostrar modal de desafío
    document.getElementById('opponent-name').textContent = selectedOpponent.username;
    document.getElementById('challenge-modal').classList.remove('hidden');
}

function updatePlayersList(players) {
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = '';
    
    players.forEach(player => {
        if (player.id === AppState.user.id) return; // No mostrar al usuario actual
        
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.dataset.playerId = player.id;
        
        playerItem.innerHTML = `
            <div class="player-name">${player.username}</div>
            <div class="player-status">
                Rating: ${player.rating} | Victorias: ${player.wins || 0}
            </div>
        `;
        
        playersList.appendChild(playerItem);
    });
}

function sendChallenge() {
    if (!selectedOpponent) return;
    
    const gameMode = document.querySelector('input[name="game-mode"]:checked').value;
    const protocolMode = Math.random() < 0.5 ? 'SOCKET_FIRST' : 'FETCH_FIRST';
    
    const challenge = {
        type: 'challenge',
        from: AppState.user,
        to: selectedOpponent,
        gameMode: gameMode,
        protocolMode: protocolMode,
        timestamp: Date.now()
    };
    
    if (sendWebSocketMessage(challenge)) {
        addChatMessage('Sistema', `Desafío enviado a ${selectedOpponent.username}`, true);
        document.getElementById('challenge-modal').classList.add('hidden');
    }
}

function showIncomingChallenge(data) {
    document.getElementById('challenger-name').textContent = data.from.username;
    document.getElementById('challenge-mode').textContent = 
        data.gameMode === 'classic' ? 'Guerra Clásica' : 'Duelo Rápido';
    document.getElementById('challenge-protocol').textContent = data.protocolMode;
    
    // Guardar datos del desafío en el botón para referencia
    const acceptBtn = document.getElementById('accept-challenge');
    acceptBtn.dataset.challengeData = JSON.stringify(data);
    
    document.getElementById('incoming-challenge-modal').classList.remove('hidden');
}

function acceptChallenge() {
    const acceptBtn = document.getElementById('accept-challenge');
    const challengeData = JSON.parse(acceptBtn.dataset.challengeData);
    
    // Configurar protocolo para la partida
    AppState.connection.protocolMode = challengeData.protocolMode;
    updateProtocolDisplay();
    
    // Enviar aceptación al servidor
    sendWebSocketMessage({
        type: 'challenge_response',
        challengeId: challengeData.challengeId,
        response: 'accepted',
        user: AppState.user
    });
    
    // Preparar para el juego
    AppState.currentGame = {
        id: challengeData.gameId,
        opponent: challengeData.from,
        mode: 'pvp',
        gameType: challengeData.gameMode,
        status: 'waiting'
    };
    
    // Guardar en localStorage para persistencia
    localStorage.setItem('current_game', JSON.stringify(AppState.currentGame));
    
    // Redirigir a la pantalla de configuración
    window.location.href = 'config.html';
}

function rejectChallenge() {
    const acceptBtn = document.getElementById('accept-challenge');
    const challengeData = JSON.parse(acceptBtn.dataset.challengeData);
    
    sendWebSocketMessage({
        type: 'challenge_response',
        challengeId: challengeData.challengeId,
        response: 'rejected',
        user: AppState.user
    });
    
    document.getElementById('incoming-challenge-modal').classList.add('hidden');
    addChatMessage('Sistema', 'Has rechazado el desafío', true);
}

function startPvEGame() {
    const mode = document.getElementById('pve-mode').value;
    const protocolMode = Math.random() < 0.5 ? 'SOCKET_FIRST' : 'FETCH_FIRST';
    
    AppState.connection.protocolMode = protocolMode;
    AppState.currentGame = {
        id: 'pve_' + Date.now(),
        opponent: { username: 'Autómata de Instrucción' },
        mode: 'pve',
        gameType: mode,
        status: 'configuring'
    };
    
    localStorage.setItem('current_game', JSON.stringify(AppState.currentGame));
    window.location.href = 'config.html';
}

function sendChatMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (message) {
        sendWebSocketMessage({
            type: 'chat_message',
            sender: AppState.user,
            message: message,
            timestamp: Date.now()
        });
        
        addChatMessage(AppState.user.username, message, false);
        input.value = '';
    }
}

function addChatMessage(sender, message, isSystem) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    
    messageDiv.className = `message ${isSystem ? 'system' : 
        (sender === AppState.user.username ? 'sender' : 'player')}`;
    
    messageDiv.innerHTML = `
        <strong>${sender}:</strong> ${message}
        <span class="message-time">${new Date().toLocaleTimeString()}</span>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateProtocolDisplay() {
    const display = document.getElementById('protocol-display');
    if (AppState.connection.protocolMode === 'SOCKET_FIRST') {
        display.textContent = 'WebSockets (Principal) | Fetch+SSE (Chat)';
    } else {
        display.textContent = 'Fetch+SSE (Principal) | WebSockets (Chat)';
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('index.html') || 
        window.location.pathname === '/') {
        initializeLobby();
    }
});