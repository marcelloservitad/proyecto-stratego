// server.js
const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Servir archivos estáticos
app.use(express.static(__dirname));
app.use(express.json());

// Almacenamiento en memoria (en producción usarías una base de datos)
const clients = new Map();
const games = new Map();
const lobby = new Set();

wss.on('connection', (ws) => {
    let userId = null;
    
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        switch (data.type) {
            case 'register':
                userId = data.user.id;
                clients.set(userId, ws);
                lobby.add(userId);
                broadcastPlayerList();
                break;
                
            case 'chat_message':
                broadcastChatMessage(data);
                break;
                
            case 'challenge':
                handleChallenge(data);
                break;
                
            case 'challenge_response':
                handleChallengeResponse(data);
                break;
                
            case 'player_ready':
                handlePlayerReady(data);
                break;
                
            case 'game_move':
                handleGameMove(data);
                break;
        }
    });
    
    ws.on('close', () => {
        if (userId) {
            clients.delete(userId);
            lobby.delete(userId);
            broadcastPlayerList();
        }
    });
});

function broadcastPlayerList() {
    const playerList = Array.from(lobby).map(id => ({
        id,
        username: `User_${id}` // En realidad obtendrías de una base de datos
    }));
    
    const message = JSON.stringify({
        type: 'player_list',
        players: playerList
    });
    
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

function broadcastChatMessage(data) {
    const message = JSON.stringify({
        type: 'chat_message',
        sender: data.sender.username,
        message: data.message,
        isSystem: false,
        timestamp: data.timestamp
    });
    
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// ... implementar otras funciones del servidor

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});