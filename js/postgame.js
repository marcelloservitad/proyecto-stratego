// postgame.js - Lógica para la pantalla de resultados

document.addEventListener('DOMContentLoaded', () => {
    initializePostGame();
});

function initializePostGame() {
    // Cargar resultado de la partida
    loadGameResult();
    
    // Actualizar estadísticas del usuario
    updateUserStats();
    
    // Cargar historial de partidas
    loadGameHistory();
    
    // Configurar event listeners
    setupPostGameListeners();
}

function loadGameResult() {
    // Intentar cargar desde localStorage primero
    const gameResult = JSON.parse(localStorage.getItem('last_game_result'));
    
    if (gameResult) {
        displayGameResult(gameResult);
    } else {
        // Si no hay resultado, mostrar mensaje y redirigir
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    }
}

function displayGameResult(result) {
    const banner = document.getElementById('victory-banner');
    const title = document.getElementById('result-title');
    const subtitle = document.getElementById('result-subtitle');
    
    // Configurar según resultado
    if (result.winner === 'player') {
        banner.className = 'victory-banner';
        title.textContent = '¡VICTORIA!';
        subtitle.textContent = 'Has demostrado tu valía, General';
    } else if (result.winner === 'opponent') {
        banner.className = 'victory-banner defeat';
        title.textContent = 'DERROTA';
        subtitle.textContent = 'La derrota es una lección para la próxima batalla';
    } else {
        banner.className = 'victory-banner draw';
        title.textContent = 'TABLAS';
        subtitle.textContent = 'Ningún bando pudo prevalecer';
    }
    
    // Actualizar detalles
    const duration = formatDuration(result.duration || 0);
    document.getElementById('game-duration').textContent = duration;
    document.getElementById('total-moves').textContent = result.moves || 0;
    document.getElementById('pieces-remaining').textContent = 
        `${result.playerPiecesRemaining || 0} vs ${result.opponentPiecesRemaining || 0}`;
    
    const victoryTypes = {
        'flag_capture': 'Captura de bandera',
        'annihilation': 'Aniquilación completa',
        'surrender': 'Rendición',
        'stalemate': 'Bloqueo táctico',
        'agreement': 'Acuerdo mutuo'
    };
    
    document.getElementById('victory-type').textContent = 
        victoryTypes[result.victoryType] || result.victoryType || 'Desconocido';
}

function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function updateUserStats() {
    const user = JSON.parse(localStorage.getItem('stratego_user') || '{}');
    
    // Actualizar UI con estadísticas del usuario
    // (Podría agregarse más información aquí)
}

function loadGameHistory() {
    const historyList = document.getElementById('recent-games');
    if (!historyList) return;
    
    const gameHistory = JSON.parse(localStorage.getItem('game_history') || '[]');
    
    // Mostrar solo las últimas 5 partidas
    const recentGames = gameHistory.slice(0, 5);
    
    if (recentGames.length === 0) {
        historyList.innerHTML = '<p class="empty-history">No hay partidas recientes.</p>';
        return;
    }
    
    historyList.innerHTML = recentGames.map(game => `
        <div class="history-item ${game.winner === 'player' ? '' : 
            game.winner === 'opponent' ? 'defeat' : 'draw'}">
            <div class="history-info">
                <div class="history-date">${new Date(game.date).toLocaleDateString()}</div>
                <div class="history-mode">${game.mode === 'pvp' ? 'PvP' : 'PvE'} - ${game.victoryType || ''}</div>
            </div>
            <div class="history-result ${game.winner === 'player' ? 'win' : 
                game.winner === 'opponent' ? 'loss' : 'draw'}">
                ${game.winner === 'player' ? 'Victoria' : 
                  game.winner === 'opponent' ? 'Derrota' : 'Tablas'}
            </div>
        </div>
    `).join('');
}

function setupPostGameListeners() {
    // Botón para compartir resultado
    const shareBtn = document.getElementById('share-result');
    if (shareBtn) {
        shareBtn.addEventListener('click', shareResult);
    }
}

function shareResult() {
    const gameResult = JSON.parse(localStorage.getItem('last_game_result') || '{}');
    
    const shareText = `🎮 Stratego - Resultado de partida:
${gameResult.winner === 'player' ? '¡Victoria!' : gameResult.winner === 'opponent' ? 'Derrota' : 'Tablas'}
⏱️ Duración: ${formatDuration(gameResult.duration || 0)}
🎯 Movimientos: ${gameResult.moves || 0}
⚔️ Piezas restantes: ${gameResult.playerPiecesRemaining || 0} vs ${gameResult.opponentPiecesRemaining || 0}`;
    
    // Intentar usar Web Share API
    if (navigator.share) {
        navigator.share({
            title: 'Resultado Stratego',
            text: shareText,
            url: window.location.href
        });
    } else {
        // Copiar al portapapeles como fallback
        navigator.clipboard.writeText(shareText)
            .then(() => alert('Resultado copiado al portapapeles'))
            .catch(err => console.error('Error al copiar:', err));
    }
}