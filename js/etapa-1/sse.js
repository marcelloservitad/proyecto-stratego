/**
 * Conecta al stream SSE del servidor.
 * @param {string} baseUrl Base URL del backend.
 * @param {string} userId Id del oficial (va en query param).
 * @param {(eventName: string, data: any) => void} onEvent Callback para eventos.
 * @param {(status: 'connected' | 'disconnected' | 'error') => void} onStatus Callback de estado.
 * @returns {{close: () => void}}
 */
export function connectEventStream(baseUrl, userId, onEvent, onStatus) {
    const url = `${baseUrl}/api/events/stream?userId=${encodeURIComponent(userId)}`;

    /**
     * Nota: EventSource no permite custom headers en navegador.
     * Por eso el backend pide userId por query param.
     */
    const eventSource = new EventSource(url);

    eventSource.onopen = function () {
        onStatus('connected');
    };

    eventSource.onerror = function () {
        onStatus('error');
    };

    eventSource.addEventListener('challenge_received', function (messageEvent) {
        try {
            const data = JSON.parse(messageEvent.data);
            onEvent('challenge_received', data);
        } catch (error) {
            onEvent('challenge_received', null);
        }
    });

    eventSource.addEventListener('challenge_answered', function (messageEvent) {
        try {
            const data = JSON.parse(messageEvent.data);
            onEvent('challenge_answered', data);
        } catch (error) {
            onEvent('challenge_answered', null);
        }
    });

    /**
     * Evento específico del lobby: lobby_update.
     */
    eventSource.addEventListener('lobby_update', function (messageEvent) {
        try {
            const data = JSON.parse(messageEvent.data);
            onEvent('lobby_update', data);
        } catch (error) {
            onEvent('lobby_update', null);
        }
    });

    return {
        close: function () {
            try {
                eventSource.close();
            } catch (error) {
                // Sin acción.
            }

            onStatus('disconnected');
        },
    };
}
