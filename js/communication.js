// Gestión de comunicación dual (WebSockets y Fetch/SSE)

class CommunicationManager {
    constructor() {
        this.wsConnection = null;
        this.sseConnection = null;
        this.activeProtocol = null; // 'websocket' o 'sse'
        this.messageQueue = [];
        this.isProcessing = false;
    }
    
    initialize(protocolMode) {
        this.activeProtocol = protocolMode === 'SOCKET_FIRST' ? 'websocket' : 'sse';
        
        if (this.activeProtocol === 'websocket') {
            this.initializeWebSocket();
        } else {
            this.initializeSSE();
        }
    }
    
    initializeWebSocket() {
        // WebSocket ya está inicializado en app.js
        // Esta función maneja mensajes específicos del juego
        console.log('WebSocket como protocolo principal');
    }
    
    initializeSSE() {
        const sseUrl = 'http://localhost:3000/sse';
        this.sseConnection = new EventSource(sseUrl);
        
        this.sseConnection.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleIncomingMessage(data);
        };
        
        this.sseConnection.onerror = (error) => {
            console.error('SSE Error:', error);
            // Intentar reconectar o cambiar a WebSocket
        };
        
        console.log('SSE como protocolo principal');
    }
    
    sendMessage(message) {
        if (this.activeProtocol === 'websocket') {
            return this.sendViaWebSocket(message);
        } else {
            return this.sendViaFetch(message);
        }
    }
    
    sendViaWebSocket(message) {
        if (AppState.connection.ws && 
            AppState.connection.ws.readyState === WebSocket.OPEN) {
            AppState.connection.ws.send(JSON.stringify(message));
            return Promise.resolve(true);
        }
        return Promise.reject('WebSocket no disponible');
    }
    
    async sendViaFetch(message) {
        try {
            const response = await fetch('http://localhost:3000/api/game/move', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...message,
                    userId: AppState.user.id,
                    gameId: AppState.currentGame.id
                })
            });
            
            if (!response.ok) {
                throw new Error('Error en la solicitud Fetch');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error enviando mensaje via Fetch:', error);
            throw error;
        }
    }
    
    sendChatMessage(message) {
        // Los mensajes de chat usan el protocolo secundario
        if (this.activeProtocol === 'websocket') {
            // Si WebSocket es principal, chat usa Fetch
            return this.sendChatViaFetch(message);
        } else {
            // Si SSE es principal, chat usa WebSocket
            return this.sendChatViaWebSocket(message);
        }
    }
    
    async sendChatViaFetch(message) {
        try {
            const response = await fetch('http://localhost:3000/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...message,
                    userId: AppState.user.id,
                    gameId: AppState.currentGame.id
                })
            });
            
            return await response.json();
        } catch (error) {
            console.error('Error enviando chat via Fetch:', error);
        }
    }
    
    sendChatViaWebSocket(message) {
        return this.sendViaWebSocket({
            ...message,
            type: 'chat_message'
        });
    }
    
    handleIncomingMessage(data) {
        // Delegar al manejador apropiado según el tipo de mensaje
        switch (data.type) {
            case 'game_state':
                GameManager.updateGameState(data.state);
                break;
            case 'move_result':
                GameManager.handleMoveResult(data);
                break;
            case 'chat_message':
                ChatManager.handleChatMessage(data);
                break;
            default:
                console.log('Mensaje no manejado:', data);
        }
    }
    
    disconnect() {
        if (this.wsConnection) {
            this.wsConnection.close();
        }
        if (this.sseConnection) {
            this.sseConnection.close();
        }
    }
}

// Instancia global del gestor de comunicación
const Comms = new CommunicationManager();