/**
 * Conecta al WebSocket del servidor para el chat global del lobby.
 * @param {string} userId Id del oficial.
 * @param {(data: any) => void} onMessage Callback para mensajes.
 * @param {(status: 'connected' | 'disconnected' | 'error') => void} onStatus Callback de estado.
 * @returns {{sendLobbyChat: (content: string) => void, close: () => void}}
 */
export function connectGatewaySocket(userId, onMessage, onStatus) {
    const url = `wss://stratego-api.koyeb.app/gateway?userId=${encodeURIComponent(userId)}`;
    const socket = new WebSocket(url);

    socket.addEventListener('open', function () {
        onStatus('connected');
    });

    socket.addEventListener('close', function () {
        onStatus('disconnected');
    });

    socket.addEventListener('error', function () {
        onStatus('error');
    });

    socket.addEventListener('message', function (event) {
    const rawText = String(event.data);

    try {
        const data = JSON.parse(rawText);
        onMessage(data);
    } catch (error) {
        onMessage({
            event: 'raw_message',
            payload: { rawText: rawText },
        });
    }});

    /**
     * Envía un mensaje al chat global del lobby.
     * @param {string} content Contenido del mensaje.
     */
    function sendLobbyChat(content) {
    if (socket.readyState !== WebSocket.OPEN) {
        return;
    }

    const message = {
        event: 'send_lobby_chat',
        payload: { content: content },
        data: { content: content },
    };

    socket.send(JSON.stringify(message));
}

    return {
        sendLobbyChat: sendLobbyChat,
        close: function () {
            try {
                socket.close();
            } catch (error) {
                // Sin acción.
            }
        },
    };
}
