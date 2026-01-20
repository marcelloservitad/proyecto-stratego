const SESSION_KEY = 'strategoSession';

/**
 * Guarda la sesión en localStorage.
 * @param {{userId: string, username: string}} session Datos de sesión.
 */
export function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/**
 * Carga la sesión desde localStorage.
 * @returns {{userId: string, username: string} | null}
 */
export function loadSession() {
    const raw = localStorage.getItem(SESSION_KEY);

    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw);
    } catch (error) {
        return null;
    }
}

/**
 * Limpia la sesión.
 */
export function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}
