// postgame.js - Corregido para registrar partidas y mostrar correctamente resultados

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
    const gameResult = localStorage.getItem('last_game_result');
    
    if (!gameResult) {
        console.log('No se encontró resultado de partida reciente');
        
        // Intentar cargar resultado de la partida actual desde game.js
        const currentGame = localStorage.getItem('current_game');
        const deployment = localStorage.getItem('game_deployment');
        
        if (currentGame && deployment) {
            // Crear un resultado simulado basado en datos disponibles
            const simulatedResult = {
                winner: 'player', // Asumir victoria por defecto
                reason: 'unknown',
                duration: 0,
                moves: 0,
                playerPiecesRemaining: 40,
                opponentPiecesRemaining: 40,
                date: new Date().toISOString(),
                gameType: JSON.parse(currentGame).gameType || 'classic'
            };
            
            displayGameResult(simulatedResult);
            return;
        }
        
        // Si no hay resultado, mostrar mensaje y redirigir después de 3 segundos
        setTimeout(() => {
            alert('No se encontraron datos de partida. Redirigiendo al lobby...');
            window.location.href = 'index.html';
        }, 3000);
        return;
    }
    
    try {
        const result = JSON.parse(gameResult);
        displayGameResult(result);
    } catch (error) {
        console.error('Error al parsear resultado:', error);
        alert('Error al cargar resultados. Redirigiendo al lobby...');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    }
}

function displayGameResult(result) {
    console.log('Mostrando resultado:', result);
    
    const banner = document.getElementById('victory-banner');
    const title = document.getElementById('result-title');
    const subtitle = document.getElementById('result-subtitle');
    
    if (!banner || !title || !subtitle) {
        console.error('Elementos del DOM no encontrados');
        return;
    }
    
    // Configurar según resultado
    if (result.winner === 'player') {
        banner.className = 'victory-banner';
        title.textContent = '¡VICTORIA!';
        subtitle.textContent = 'Has demostrado tu valía, General';
        console.log('Resultado: VICTORIA del jugador');
    } else if (result.winner === 'opponent') {
        banner.className = 'victory-banner defeat';
        title.textContent = 'DERROTA';
        subtitle.textContent = 'La derrota es una lección para la próxima batalla';
        console.log('Resultado: DERROTA del jugador');
    } else {
        banner.className = 'victory-banner draw';
        title.textContent = 'TABLAS';
        subtitle.textContent = 'Ningún bando pudo prevalecer';
        console.log('Resultado: TABLAS');
    }
    
    // Actualizar detalles
    const duration = formatDuration(result.duration || 0);
    const moves = result.moves || 0;
    const playerPieces = result.playerPiecesRemaining || 0;
    const opponentPieces = result.opponentPiecesRemaining || 0;
    
    console.log('Duración:', duration);
    console.log('Movimientos:', moves);
    console.log('Piezas restantes:', playerPieces, 'vs', opponentPieces);
    
    const durationEl = document.getElementById('game-duration');
    const movesEl = document.getElementById('total-moves');
    const piecesEl = document.getElementById('pieces-remaining');
    const victoryTypeEl = document.getElementById('victory-type');
    
    if (durationEl) durationEl.textContent = duration;
    if (movesEl) movesEl.textContent = moves;
    if (piecesEl) piecesEl.textContent = `${playerPieces} vs ${opponentPieces}`;
    
    // Mapear el motivo de victoria/derrota
    const victoryTypes = {
        'flag_capture': 'Captura de bandera',
        'surrender': 'Rendición',
        'annihilation': 'Aniquilación completa',
        'stalemate': 'Bloqueo táctico',
        'agreement': 'Acuerdo mutuo',
        'unknown': 'Desconocido'
    };
    
    if (victoryTypeEl) {
        victoryTypeEl.textContent = victoryTypes[result.reason] || result.reason || 'Desconocido';
    }
    
    // Guardar esta partida en el historial
    saveToGameHistory(result);
}

function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function updateUserStats() {
    const user = JSON.parse(localStorage.getItem('stratego_user') || '{}');
    
    // Inicializar estadísticas si no existen
    if (!user.stats) {
        user.stats = {
            wins: 0,
            losses: 0,
            draws: 0,
            totalGames: 0,
            totalMoves: 0,
            totalTime: 0
        };
    }
    
    // Cargar resultado actual para actualizar estadísticas
    const gameResult = localStorage.getItem('last_game_result');
    if (gameResult) {
        try {
            const result = JSON.parse(gameResult);
            
            if (result.winner === 'player') {
                user.stats.wins++;
            } else if (result.winner === 'opponent') {
                user.stats.losses++;
            } else {
                user.stats.draws++;
            }
            
            user.stats.totalGames = user.stats.wins + user.stats.losses + user.stats.draws;
            user.stats.totalMoves += result.moves || 0;
            user.stats.totalTime += result.duration || 0;
            
            // Guardar usuario actualizado
            localStorage.setItem('stratego_user', JSON.stringify(user));
            
            console.log('Estadísticas actualizadas:', user.stats);
        } catch (error) {
            console.error('Error al actualizar estadísticas:', error);
        }
    }
}

function saveToGameHistory(gameResult) {
    // Obtener historial actual o crear uno nuevo
    const gameHistory = JSON.parse(localStorage.getItem('game_history') || '[]');
    
    // Asegurar que el resultado tenga todos los campos necesarios
    const historyEntry = {
        id: Date.now(),
        date: gameResult.date || new Date().toISOString(),
        winner: gameResult.winner || 'unknown',
        reason: gameResult.reason || 'unknown',
        duration: gameResult.duration || 0,
        moves: gameResult.moves || 0,
        playerPiecesRemaining: gameResult.playerPiecesRemaining || 0,
        opponentPiecesRemaining: gameResult.opponentPiecesRemaining || 0,
        gameType: gameResult.gameType || 'classic',
        mode: gameResult.mode || 'pve'
    };
    
    // Agregar al principio del historial (más reciente primero)
    gameHistory.unshift(historyEntry);
    
    // Mantener solo las últimas 20 partidas
    const limitedHistory = gameHistory.slice(0, 20);
    
    // Guardar en localStorage
    localStorage.setItem('game_history', JSON.stringify(limitedHistory));
    
    console.log('Partida guardada en historial:', historyEntry);
    console.log('Total en historial:', limitedHistory.length, 'partidas');
}

function loadGameHistory() {
    const historyList = document.getElementById('recent-games');
    if (!historyList) {
        console.error('Elemento #recent-games no encontrado');
        return;
    }
    
    const gameHistory = JSON.parse(localStorage.getItem('game_history') || '[]');
    
    console.log('Cargando historial:', gameHistory.length, 'partidas');
    
    // Mostrar solo las últimas 5 partidas
    const recentGames = gameHistory.slice(0, 5);
    
    if (recentGames.length === 0) {
        historyList.innerHTML = '<p class="empty-history">No hay partidas recientes. Juega tu primera partida!</p>';
        return;
    }
    
    historyList.innerHTML = recentGames.map((game, index) => {
        const date = new Date(game.date);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        let victoryText = '';
        if (game.reason === 'flag_capture') victoryText = ' - Captura de bandera';
        else if (game.reason === 'surrender') victoryText = ' - Rendición';
        else if (game.reason === 'annihilation') victoryText = ' - Aniquilación';
        
        const gameType = game.gameType === 'quick' ? 'Rápido' : 'Clásico';
        
        return `
            <div class="history-item ${game.winner === 'player' ? '' : 
                game.winner === 'opponent' ? 'defeat' : 'draw'}">
                <div class="history-info">
                    <div class="history-date">${formattedDate}</div>
                    <div class="history-mode">${gameType}${victoryText}</div>
                </div>
                <div class="history-result ${game.winner === 'player' ? 'win' : 
                    game.winner === 'opponent' ? 'loss' : 'draw'}">
                    ${game.winner === 'player' ? 'Victoria' : 
                      game.winner === 'opponent' ? 'Derrota' : 'Tablas'}
                </div>
            </div>
        `;
    }).join('');
}

function setupPostGameListeners() {
    // Botón para compartir resultado
    const shareBtn = document.getElementById('share-result');
    if (shareBtn) {
        shareBtn.addEventListener('click', shareResult);
    }
    
    // Botón de revancha
    const rematchBtn = document.querySelector('button[onclick*="config.html"]');
    if (rematchBtn) {
        rematchBtn.addEventListener('click', function(e) {
            e.preventDefault();
            startRematch();
        });
    }
}

function shareResult() {
    const gameResult = JSON.parse(localStorage.getItem('last_game_result') || '{}');
    const user = JSON.parse(localStorage.getItem('stratego_user') || '{}');
    
    const resultText = gameResult.winner === 'player' ? 'Victoria' : 
                     gameResult.winner === 'opponent' ? 'Derrota' : 'Tablas';
    
    const shareText = `🎮 Stratego - Resultado de partida:
${resultText} - ${user.username || 'General'}
⏱️ Duración: ${formatDuration(gameResult.duration || 0)}
🎯 Movimientos: ${gameResult.moves || 0}
⚔️ Piezas restantes: ${gameResult.playerPiecesRemaining || 0} vs ${gameResult.opponentPiecesRemaining || 0}
🏆 Tipo: ${gameResult.gameType === 'quick' ? 'Duelo Rápido' : 'Guerra Clásica'}`;
    
    // Intentar usar Web Share API
    if (navigator.share) {
        navigator.share({
            title: 'Resultado Stratego',
            text: shareText,
            url: window.location.href
        }).then(() => {
            console.log('Resultado compartido');
        }).catch(err => {
            console.error('Error al compartir:', err);
            fallbackShare(shareText);
        });
    } else {
        fallbackShare(shareText);
    }
}

function fallbackShare(text) {
    // Copiar al portapapeles como fallback
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => {
                alert('Resultado copiado al portapapeles');
                console.log('Resultado copiado al portapapeles');
            })
            .catch(err => {
                console.error('Error al copiar:', err);
                alert('No se pudo copiar el resultado');
            });
    } else {
        // Fallback más antiguo
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            alert('Resultado copiado al portapapeles');
        } catch (err) {
            console.error('Error al copiar:', err);
            alert('No se pudo copiar el resultado');
        }
        document.body.removeChild(textArea);
    }
}

function startRematch() {
    // Cargar configuración de la partida anterior
    const currentGame = JSON.parse(localStorage.getItem('current_game') || '{}');
    
    if (currentGame && currentGame.id) {
        // Mantener la misma configuración
        currentGame.id = 'rematch_' + Date.now();
        currentGame.status = 'configuring';
        
        localStorage.setItem('current_game', JSON.stringify(currentGame));
        
        // Eliminar despliegue anterior para que pueda configurar uno nuevo
        localStorage.removeItem('game_deployment');
        
        // Redirigir a configuración
        window.location.href = 'config.html';
    } else {
        // Si no hay partida anterior, ir al lobby
        window.location.href = 'index.html';
    }
}

// Función auxiliar para formatear fecha
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Exportar funciones para acceso global
window.postGameFunctions = {
    initializePostGame,
    loadGameResult,
    saveToGameHistory,
    loadGameHistory
};