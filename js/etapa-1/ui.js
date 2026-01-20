const BOT_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Renderiza la lista de oficiales conectados.
 * @param {HTMLElement} listElement Elemento <ul>.
 * @param {Array<{userId: string, username: string, status: string}>} users Usuarios conectados.
 * @param {string} currentUserId Id del usuario actual.
 */
export function renderUsers(listElement, users, currentUserId, onChallengeClick) {
    listElement.innerHTML = '';

    for (let i = 0; i < users.length; i++) {
        const user = users[i];

        const item = document.createElement('li');

        const row = document.createElement('article');
        row.className = 'user-row';

        const name = document.createElement('strong');
        name.textContent = buildUserLabel(user, currentUserId);

        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = buildStatusLabel(user);

        row.appendChild(name);
        row.appendChild(badge);

        if (user.userId !== currentUserId && user.status === 'AVAILABLE') {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = 'Desafiar';
            button.addEventListener('click', function () {
                onChallengeClick(user);
        });

    row.appendChild(button);
}

        

        item.appendChild(row);
        listElement.appendChild(item);
    }
}

/**
 * Agrega un mensaje al chat (sin persistencia).
 * @param {HTMLElement} listElement Elemento <ul>.
 * @param {{from?: {userId?: string, username?: string}, content?: string, timestamp?: string}} message Mensaje.
 * @param {string} currentUserId Id del usuario actual.
 */
export function appendChatMessage(listElement, message, currentUserId) {
    const item = document.createElement('li');

    const fromUserId = message.from && message.from.userId ? message.from.userId : '';
    const fromName = message.from && message.from.username ? message.from.username : 'Sistema';
    const content = message.content ? message.content : '';
    const timestamp = message.timestamp ? formatTimestamp(message.timestamp) : '';

    const isOwn = fromUserId && currentUserId && fromUserId === currentUserId;

    item.className = `chat-message ${isOwn ? 'own' : 'other'}`;

    const bubble = document.createElement('article');
    bubble.className = 'chat-bubble';

    const meta = document.createElement('header');
    meta.className = 'chat-meta';

    const author = document.createElement('strong');
    author.textContent = isOwn ? 'Tú' : fromName;

    const time = document.createElement('span');
    time.textContent = timestamp;

    meta.appendChild(author);
    meta.appendChild(time);

    const body = document.createElement('p');
    body.className = 'chat-content';
    body.textContent = content;

    bubble.appendChild(meta);
    bubble.appendChild(body);

    item.appendChild(bubble);
    listElement.appendChild(item);

    // Mantener “en vivo” bajando automáticamente al último mensaje
    const scrollPanel = listElement.closest('.scroll-panel');

        if (scrollPanel) {
            scrollPanel.scrollTop = scrollPanel.scrollHeight;
        }
}

/**
 * Muestra un toast simple.
 * @param {HTMLElement} toastElement Elemento del toast.
 * @param {string} text Texto en español.
 */
export function showToast(toastElement, text) {
    toastElement.textContent = text;
    toastElement.hidden = false;

    window.setTimeout(function () {
        toastElement.hidden = true;
        toastElement.textContent = '';
    }, 2500);
}

function buildUserLabel(user, currentUserId) {
    if (user.userId === currentUserId) {
        return `${user.username} (tú)`;
    }

    if (user.userId === BOT_USER_ID) {
        return `${user.username} (PvE)`;
    }

    return user.username;
}

function buildStatusLabel(user) {
    if (user.userId === BOT_USER_ID) {
        return 'DISPONIBLE';
    }

    if (user.status === 'AVAILABLE') {
        return 'DISPONIBLE';
    }

    if (user.status === 'IN_MATCH') {
        return 'EN PARTIDA';
    }

    return user.status ? user.status : 'DESCONOCIDO';
}

function formatTimestamp(iso) {
    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
        return iso;
    }

    return date.toLocaleString('es-VE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function escapeHtml(text) {
    return String(text)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
