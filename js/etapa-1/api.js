const BASE_URL = 'https://stratego-api.koyeb.app';

/**
 * Construye headers de autenticación.
 * Nota: Se usa Authorization: Bearer {userId}. Si tu backend prefiere X-USER-ID, se puede alternar.
 */
function buildAuthHeaders(userId) {
    return {
        'Authorization': `Bearer ${userId}`,
        'X-USER-ID': userId,
    };
}

/*function buildAuthHeaders(userId) {
    return {
        'Authorization': `Bearer ${userId}`,
    };
}*/

/**
 * Realiza el registro/login del oficial (sin contraseña).
 * @param {string} username Nombre de usuario (3-30, alfanumérico).
 * @returns {Promise<{userId: string, username: string}>}
 */
export async function postSession(username) {
    const response = await fetch(`${BASE_URL}/api/sessions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`No se pudo iniciar sesión. Código: ${response.status}. Detalle: ${text}`);
    }

    return await response.json();
}

/**
 * Cierra la sesión actual.
 * @param {string} userId Id del oficial.
 * @returns {Promise<void>}
 */
export async function deleteCurrentSession(userId) {
    const response = await fetch(`${BASE_URL}/api/sessions/current`, {
        method: 'DELETE',
        headers: {
            ...buildAuthHeaders(userId),
        },
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`No se pudo cerrar sesión. Código: ${response.status}. Detalle: ${text}`);
    }
}

/**
 * Obtiene el lobby (usuarios conectados).
 * @param {string} userId Id del oficial para autenticación.
 * @returns {Promise<{users: Array<{userId: string, username: string, status: string}>}>}
 */
export async function getConnectedUsers(userId) {
    const response = await fetch(`${BASE_URL}/api/users?status=connected`, {
        method: 'GET',
        headers: {
            ...buildAuthHeaders(userId),
        },
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`No se pudo obtener el lobby. Código: ${response.status}. Detalle: ${text}`);
    }

    return await response.json();
}

export function getBaseUrl() {
    return BASE_URL;
}

/**
 * Envía un reto a otro oficial o al bot.
 * @param {string} userId Id del oficial (auth).
 * @param {{targetUserId: string, mode: string, protocolMode: string}} payload Payload del reto.
 * @returns {Promise<{challengeId: string}>}
 */

export async function postChallenge(userId, payload) {
    const response = await fetch(`${BASE_URL}/api/challenges`, {
        method: 'POST',
        headers: {
            ...buildAuthHeaders(userId),
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        let errorText = '';

        try {
            errorText = await response.text();
        } catch (error) {
            errorText = '';
        }

        throw new Error(`POST /api/challenges fallo. status=${response.status}. body=${errorText}`);
    }

    return await response.json();
}


/**
 * Responde un reto (aceptar o rechazar).
 * @param {string} userId Id del oficial (auth).
 * @param {string} challengeId Id del reto.
 * @param {'ACCEPTED' | 'REJECTED'} answer Respuesta.
 * @returns {Promise<any>}
 */

export async function patchChallenge(userId, challengeId, answer) {
    // El servidor espera 'status' en lugar de 'answer'
    // Y los valores permitidos son PENDING, ACCEPTED o REJECTED
    const statusValue = answer.toUpperCase(); 

    const response = await fetch(`${BASE_URL}/api/challenges/${challengeId}`, {
        method: 'PATCH',
        headers: {
            ...buildAuthHeaders(userId),
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        // ELIMINAMOS challengeId del body y CAMBIAMOS answer por status
        body: JSON.stringify({
            status: statusValue 
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        console.error("Detalle del error 400:", text);
        throw new Error(`Error ${response.status}: ${text}`);
    }

    const contentType = response.headers.get('content-type') || '';
    return contentType.includes('application/json') ? await response.json() : {};
}