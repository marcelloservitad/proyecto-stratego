import { postSession, deleteCurrentSession, getConnectedUsers, getBaseUrl,patchChallenge,postChallenge } from './api.js';
import { loadSession, saveSession, clearSession } from './session.js';
import { connectEventStream } from './sse.js';
import { connectGatewaySocket } from './ws.js';
import { renderUsers, appendChatMessage, showToast } from './ui.js';

const USERNAME_PATTERN = /^[a-zA-Z0-9]{3,30}$/;

let sseConnection = null;
let wsConnection = null;

const elements = {
    loginForm: document.getElementById('loginForm'),
    usernameInput: document.getElementById('usernameInput'),
    loginButton: document.getElementById('loginButton'),

    sessionPanel: document.getElementById('sessionPanel'),
    currentUsername: document.getElementById('currentUsername'),
    currentUserId: document.getElementById('currentUserId'),
    logoutButton: document.getElementById('logoutButton'),

    usersList: document.getElementById('usersList'),
    presenceStatus: document.getElementById('presenceStatus'),

    userFilterInput: document.getElementById('userFilterInput'),
    clearFilterButton: document.getElementById('clearFilterButton'),

    chatList: document.getElementById('chatList'),
    chatForm: document.getElementById('chatForm'),
    chatInput: document.getElementById('chatInput'),
    chatSendButton: document.getElementById('chatSendButton'),
    chatStatus: document.getElementById('chatStatus'),
    challengeDialog: document.getElementById('challengeDialog'),

    challengeTitle: document.getElementById('challengeTitle'),
    challengeSubtitle: document.getElementById('challengeSubtitle'),
    challengeDetails: document.getElementById('challengeDetails'),
    challengeModePicker: document.getElementById('challengeModePicker'),
    challengeModeSelect: document.getElementById('challengeModeSelect'),
    challengeRejectButton: document.getElementById('challengeRejectButton'),
    challengeAcceptButton: document.getElementById('challengeAcceptButton'),
    challengeSendButton: document.getElementById('challengeSendButton'),

    toast: document.getElementById('toast'),
};

const state = {
    session: null,
    users: [],
    userFilter: '',
    challengeContext: null,
};

bootLobby();

function bootLobby() {
    wireEvents();
    console.log('[MATCH] userId:', state.userId);

    const existingSession = loadSession();

    if (existingSession) {
        state.session = existingSession;
        applyAuthenticatedUi();

        connectRealtimeChannels();

        /**
         * Nota importante:
         * Si el backend marca OFFLINE cuando se cierra el navegador, un userId viejo puede no estar "activo".
         * Por eso intentamos refrescar; si falla por auth/estado, pedimos re-login.
         */
        refreshLobbyUsers().catch(function () {
            clearSession();
            state.session = null;
            disconnectRealtimeChannels();
            applyGuestUi();
            showToast(elements.toast, 'Tu sesión anterior no está activa. Inicia sesión de nuevo.');
        });
    } else {
        applyGuestUi();
    }
}

function wireEvents() {
    elements.loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        await handleLogin();
    });

    elements.logoutButton.addEventListener('click', async function () {
        await handleLogout();
    });

    elements.chatForm.addEventListener('submit', function (event) {
        event.preventDefault();
        handleChatSend();
    });

    elements.userFilterInput.addEventListener('input', function () {
        state.userFilter = elements.userFilterInput.value.trim();
        renderLobbyUsers();
    });

    elements.clearFilterButton.addEventListener('click', function () {
        state.userFilter = '';
        elements.userFilterInput.value = '';
        renderLobbyUsers();
    });

    elements.challengeSendButton.addEventListener('click', async function () {
    await handleChallengeSend();});

    elements.challengeAcceptButton.addEventListener('click', async function () {
        await handleChallengeAnswer('ACCEPTED');
    });

    elements.challengeRejectButton.addEventListener('click', async function () {
        await handleChallengeAnswer('REJECTED');
    });
    

    window.addEventListener('beforeunload', function () {
        disconnectRealtimeChannels();
    });
}

/**
 * Maneja el login/registro del oficial.
 */
async function handleLogin() {
    const username = elements.usernameInput.value.trim();

    if (!USERNAME_PATTERN.test(username)) {
        showToast(elements.toast, 'Nombre inválido. Usa 3–30 caracteres alfanuméricos.');
        return;
    }

    setLoginBusy(true);

    try {
        const session = await postSession(username);

        state.session = session;
        
        localStorage.setItem('strategoUserId', session.userId);
        localStorage.setItem('strategoUsername', session.username);
        console.log("Sesión guardada correctamente:", session.userId);

        saveSession(session);

        applyAuthenticatedUi();

        connectRealtimeChannels();
        await refreshLobbyUsers();

        showToast(elements.toast, 'Sesión iniciada. Bienvenido al Club de Oficiales.');
    } catch (error) {
        showToast(elements.toast, 'No se pudo iniciar sesión. Verifica el nombre e inténtalo de nuevo.');
    } finally {
        setLoginBusy(false);
    }
}

/**
 * Maneja el logout del oficial.
 */
async function handleLogout() {
    if (!state.session) {
        return;
    }

    elements.logoutButton.disabled = true;

    try {
        await deleteCurrentSession(state.session.userId);
    } catch (error) {
        // Si falla el logout en servidor, igual limpiamos local para evitar sesión rota en UI.
    } finally {
        disconnectRealtimeChannels();

        clearSession();
        state.session = null;
        state.users = [];

        elements.usersList.innerHTML = '';
        elements.chatList.innerHTML = '';

        applyGuestUi();
        elements.logoutButton.disabled = false;

        showToast(elements.toast, 'Sesión cerrada.');
    }
}

function setLoginBusy(isBusy) {
    elements.loginButton.disabled = isBusy;
    elements.usernameInput.disabled = isBusy;
}

/**
 * Conecta SSE (presencia) y WS (chat global).
 */
function connectRealtimeChannels() {
    if (!state.session) {
        return;
    }

    const baseUrl = getBaseUrl();

    if (!sseConnection) {
        sseConnection = connectEventStream(
            baseUrl,
            state.session.userId,
            handleSseEvent,
            function (status) {
                if (status === 'connected') {
                    elements.presenceStatus.textContent = 'Conectado (SSE).';
                }

                if (status === 'disconnected') {
                    elements.presenceStatus.textContent = 'Desconectado.';
                }

                if (status === 'error') {
                    elements.presenceStatus.textContent = 'Error de conexión. Reintentando automáticamente...';
                }
            }
        );
    }

    if (!wsConnection) {
        wsConnection = connectGatewaySocket(
            state.session.userId,
            handleWsMessage,
            function (status) {
                if (status === 'connected') {
                    elements.chatStatus.textContent = 'Conectado (WebSocket).';
                    setChatEnabled(true);
                }

                if (status === 'disconnected') {
                    elements.chatStatus.textContent = 'Desconectado.';
                    setChatEnabled(false);
                }

                if (status === 'error') {
                    elements.chatStatus.textContent = 'Error de conexión.';
                    setChatEnabled(false);
                }
            }
        );
    }
}

function disconnectRealtimeChannels() {
    if (sseConnection) {
        sseConnection.close();
        sseConnection = null;
    }

    if (wsConnection) {
        wsConnection.close();
        wsConnection = null;
    }

    setChatEnabled(false);
}

function setChatEnabled(isEnabled) {
    elements.chatInput.disabled = !isEnabled;
    elements.chatSendButton.disabled = !isEnabled;
}

/**
 * Maneja eventos SSE.
 * @param {string} eventName Nombre del evento.
 * @param {any} data Payload del evento.
 */

function handleSseEvent(eventName, data) {
    if (eventName === 'lobby_update') {
        refreshLobbyUsers();
        return;
    }

    if (eventName === 'challenge_received') {
        if (data) {
            openIncomingChallengeDialog(data);
        }
        return;
    }
    
    if (eventName === 'challenge_answered') {
    console.log('challenge_answered raw:', data);

        const matchId = extractMatchId(data);
        

        if (!matchId) {
            showToast(elements.toast, 'Reto aceptado, pero falta matchId (ver consola).');
            console.error('challenge_answered sin matchId:', data);
            return;
        }

        const payload = normalizeEventPayload(data);

        // Equipo según challenger/challenged vs mi userId
        const myUserId = state.session ? String(state.session.userId) : '';
        const challenger = payload.challenger || {};
        const challenged = payload.challenged || {};

        let team = '';

        if (myUserId && challenger.userId && String(challenger.userId) === myUserId) {
            team = 'RED';
        } else if (myUserId && challenged.userId && String(challenged.userId) === myUserId) {
            team = 'BLUE';
        } else {
            const role = sessionStorage.getItem('strategoLastChallengeRole') || '';
            team = role === 'CHALLENGED' ? 'BLUE' : 'RED';
        }

        showToast(elements.toast, 'Partida creada. Pasando a la Etapa II...');

        sessionStorage.setItem('strategoMatchId', matchId);
        sessionStorage.setItem('strategoTeam', team);

        

        if (payload.protocolMode) {
            sessionStorage.setItem('strategoProtocolMode', String(payload.protocolMode));
        }

        if (payload.mode) {
            sessionStorage.setItem('strategoMode', String(payload.mode));
        }

        window.location.href = '../etapa-2/setup.html';
        return; 
    }
    
}

function normalizeEventPayload(data) {
    if (!data || typeof data !== 'object') {
        return {};
    }

    // Algunos eventos vienen como { info: {...} }
    if (data.info && typeof data.info === 'object') {
        return data.info;
    }

    // Otros vienen como { data: {...} }
    if (data.data && typeof data.data === 'object') {
        return data.data;
    }

    // Otros como { payload: {...} }
    if (data.payload && typeof data.payload === 'object') {
        return data.payload;
    }

    // Si ya viene plano
    return data;
}

function extractMatchId(data) {
    // 1. BLINDAJE: Si data es un string, lo convertimos a objeto
    let parsedData = data;
    if (typeof data === 'string') {
        try {
            parsedData = JSON.parse(data);
        } catch (e) {
            console.error("Error parseando data de SSE:", e);
            return '';
        }
    }

    // 2. Usamos el normalizador con el objeto ya parseado
    const payload = normalizeEventPayload(parsedData);
    console.log("Payload normalizado para búsqueda:", payload);

    // 3. Búsqueda exhaustiva (Prioridad absoluta al matchId)
    if (payload.matchId) return String(payload.matchId);
    
    // Si viene dentro de match: { id: ... }
    if (payload.match?.id) return String(payload.match.id);
    if (payload.match?.matchId) return String(payload.match.matchId);
    
    // Si viene en la raíz de la data original
    if (parsedData.matchId) return String(parsedData.matchId);

    return '';
}

/**
 * Refresca la lista de usuarios conectados.
 * @returns {Promise<void>}
 */
async function refreshLobbyUsers() {
    if (!state.session) {
        return;
    }

    const result = await getConnectedUsers(state.session.userId);
    const users = Array.isArray(result.users) ? result.users : [];

    state.users = users;
    renderLobbyUsers();
}

/**
 * Renderiza usuarios aplicando filtro por nombre.
 */
function renderLobbyUsers() {
    if (!state.session) {
        return;
    }

    const filter = state.userFilter.toLowerCase();

    const filteredUsers = state.users.filter(function (user) {
        if (!filter) {
            return true;
        }

        const username = user.username ? user.username.toLowerCase() : '';
        return username.includes(filter);
    });

    renderUsers(elements.usersList, filteredUsers, state.session.userId, function (user) {
        openChallengeComposer(user);
    });

}

/**
 * Envía un mensaje al chat global.
 */

function handleChatSend() {
    if (!wsConnection || !state.session) {
        showToast(elements.toast, 'Chat no disponible. Revisa tu conexión.');
        return;
    }

    const content = elements.chatInput.value.trim();

    if (!content) {
        return;
    }

    // ✅ Mostrar de inmediato (sin guardar nada, solo en pantalla)
    appendChatMessage(
        elements.chatList,
        {
            from: { userId: state.session.userId, username: state.session.username },
            content: content,
            timestamp: new Date().toISOString(),
        },
        state.session.userId
    );

    wsConnection.sendLobbyChat(content);
    elements.chatInput.value = '';
}

/**
 * Maneja mensajes entrantes del WebSocket.
 * @param {any} data Mensaje recibido (JSON).
 */

function handleWsMessage(data) {
    if (!state.session) {
        return;
    }

    // ✅ El servidor manda eventos con { event, data }
    if (data && data.event === 'lobby_update') {
        const users = data.data && Array.isArray(data.data.users) ? data.data.users : null;

        if (users) {
            state.users = users;
            renderLobbyUsers();
            return;
        }

        // Fallback: si viene raro, hacemos refresh por REST
        refreshLobbyUsers();
        return;
    }

    // ✅ Chat global: soportar { event:'lobby_chat_message', data:{...} } o variantes
    if (data && data.event === 'lobby_chat_message') {
        const message = data.data || data.payload || data;

        if (message && message.from && message.content) {
            appendChatMessage(elements.chatList, message, state.session.userId);
            return;
        }
    }

    // ✅ Broadcast directo (por si el server manda sin wrapper)
    if (data && data.from && data.content) {
        appendChatMessage(elements.chatList, data, state.session.userId);
    }
}



function applyGuestUi() {
    elements.loginForm.hidden = false;
    elements.sessionPanel.hidden = true;

    elements.currentUsername.textContent = '—';
    elements.currentUserId.textContent = '—';

    elements.presenceStatus.textContent = 'Sin conexión.';
    elements.chatStatus.textContent = 'Sin conexión.';

    elements.userFilterInput.value = '';
    state.userFilter = '';

    setChatEnabled(false);
}

function applyAuthenticatedUi() {
    elements.loginForm.hidden = true;
    elements.sessionPanel.hidden = false;

    elements.currentUsername.textContent = state.session.username;
    elements.currentUserId.textContent = state.session.userId;

    elements.presenceStatus.textContent = 'Conectando (SSE)...';
    elements.chatStatus.textContent = 'Conectando (WebSocket)...';
}

function pickProtocolMode() {
    return Math.random() < 0.5 ? 'FETCH_FIRST' : 'SOCKET_FIRST';
}

function formatProtocolLabel(protocolMode) {
    if (protocolMode === 'FETCH_FIRST') {
        return 'Principal: Fetch + SSE • Secundario: WebSockets';
    }

    return 'Principal: WebSockets • Secundario: Fetch + SSE';
}

function openChallengeComposer(targetUser) {
    if (!state.session) {
        return;
    }

    const protocolMode = pickProtocolMode();

    state.challengeContext = {
        type: 'outgoing',
        targetUser: targetUser,
        protocolMode: protocolMode,
    };

    elements.challengeTitle.textContent = 'Enviar reto';
    elements.challengeSubtitle.textContent = `Vas a desafiar a: ${targetUser.username}`;
    elements.challengeDetails.textContent =
        `Transporte asignado: ${protocolMode}.\n${formatProtocolLabel(protocolMode)}\n` +
        'Elige el modo y envía el reto.';

    elements.challengeModePicker.hidden = false;

    elements.challengeRejectButton.hidden = true;
    elements.challengeAcceptButton.hidden = true;
    elements.challengeSendButton.hidden = false;

    elements.challengeDialog.showModal();
}

async function handleChallengeSend() {
    if (!state.session || !state.challengeContext || state.challengeContext.type !== 'outgoing') {
        return;
    }

    const targetUser = state.challengeContext.targetUser;
    const mode = elements.challengeModeSelect.value;
    const protocolMode = state.challengeContext.protocolMode;

    try {
        await postChallenge(state.session.userId, {
            targetUserId: targetUser.userId,
            mode: mode,
            protocolMode: protocolMode,
        });

        elements.challengeDialog.close();
        showToast(elements.toast, 'Reto enviado. Esperando respuesta...');
        sessionStorage.setItem('strategoLastChallengeRole', 'CHALLENGER');
    } catch (error) {
        console.error(error);
        showToast(elements.toast, `No se pudo enviar el reto. ${error.message}`);
    }
}

    function openIncomingChallengeDialog(challengeData) {
        // ✅ Regla de Oro: challengeId en la raíz del payload
        const payload = challengeData && challengeData.info ? challengeData.info : challengeData;

        const challengeId = payload && payload.challengeId ? String(payload.challengeId) : '';

        if (!challengeId) {
                showToast(elements.toast, 'Reto recibido, pero falta challengeId.');
                console.error('challenge_received sin challengeId:', challengeData);
                return;
        }

        const challenger = payload.challenger ? payload.challenger : {};
        const challengerName = challenger.username ? challenger.username : 'Oficial';

        const mode = payload.mode ? payload.mode : 'CLASSIC_WAR';
        const protocolMode = payload.protocolMode ? payload.protocolMode : 'FETCH_FIRST';

            state.challengeContext = {
                type: 'incoming',
                challengeId: challengeId,
                protocolMode: protocolMode,
                mode: mode,
                challenger: challenger,
            };

        elements.challengeTitle.textContent = 'Reto recibido';
        elements.challengeSubtitle.textContent = `Te desafía: ${challengerName}`;

        elements.challengeDetails.textContent =
            `Modo: ${mode === 'CLASSIC_WAR' ? 'Guerra Clásica (40 piezas)' : 'Duelo Rápido (10 piezas)'}\n` +
            `Transporte asignado: ${protocolMode}.\n${formatProtocolLabel(protocolMode)}\n` +
            '¿Deseas aceptar el reto?';

        elements.challengeModePicker.hidden = true;

        elements.challengeRejectButton.hidden = false;
        elements.challengeAcceptButton.hidden = false;
        elements.challengeSendButton.hidden = true;
        sessionStorage.setItem('strategoLastChallengeRole', 'CHALLENGED');

        elements.challengeDialog.showModal();
    }



async function handleChallengeAnswer(answer) {
    if (!state.session || !state.challengeContext || state.challengeContext.type !== 'incoming') {
        return;
    }

    const challengeId = state.challengeContext.challengeId;
    if (!challengeId) {
    showToast(elements.toast, 'No se pudo responder el reto: challengeId inválido.');
    console.error('challengeId vacío. challengeContext:', state.challengeContext);
    return;}

    try {
        sessionStorage.setItem('strategoLastChallengeRole', 'CHALLENGED');
        await patchChallenge(state.session.userId, challengeId, answer);
        elements.challengeDialog.close();

        if (answer === 'ACCEPTED') {
            showToast(elements.toast, 'Reto aceptado. Esperando inicio de partida...');
        } else {
            showToast(elements.toast, 'Reto rechazado.');
        }
    } catch (error) {
        showToast(elements.toast, 'No se pudo responder el reto. Intenta de nuevo.');
    }
}


