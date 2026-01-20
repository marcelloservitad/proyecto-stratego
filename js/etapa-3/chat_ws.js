/* chat_ws.js - Debug Mode Activo */

const CHAT_WS_URL = 'wss://stratego-api.koyeb.app/gateway'; 
const CHAT_API_URL = 'https://stratego-api.koyeb.app/api';

const Chat = {
    ws: null,
    userId: null,
    matchId: null,
    
    dom: {
        area: null, input: null, form: null, btn: null
    },

    init(userId, matchId) {
        this.userId = String(userId).trim();
        this.matchId = String(matchId).trim();
        
        this.dom.area = document.querySelector('.chat-box');
        this.dom.input = document.getElementById('chatInput');
        this.dom.form = document.querySelector('.chat-form');
        this.dom.btn = this.dom.form ? this.dom.form.querySelector('button') : null;

        if (!this.dom.input || !this.dom.area) return;

        // Reset UI
        this.dom.area.innerHTML = '';
        this.dom.area.style.cssText = "height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 10px; background: #1a1a1a;";
        
        this.dom.input.disabled = false;
        if(this.dom.btn) this.dom.btn.disabled = false;

        this.connect();
        this.wireEvents();
    },

    connect() {
        if (this.ws) this.ws.close();

        // 1. CONEXIÓN WEBSOCKET (Escucha)
        this.ws = new WebSocket(`${CHAT_WS_URL}?userId=${encodeURIComponent(this.userId)}`);

        this.ws.onopen = () => {
            console.log("🔵 Chat WS: Conectado y escuchando...");
            this.addSystemMessage("Chat conectado.");
        };

        this.ws.onmessage = (event) => {
            try {
                // Parseamos el mensaje crudo del WebSocket
                const wrapper = JSON.parse(event.data);
                
                // Filtramos el ruido del lobby
                if (wrapper.event !== 'lobby_update') {
                    console.log("🔥 DATA CRUDA RECIBIDA:", wrapper);
                }

                // 2. DETECTAR EL EVENTO
                // A veces llega como 'event' y a veces el payload está directo. 
                // Asumimos estructura estándar: { event: "nombre", data: { ... } }
                if (wrapper.event === 'match_chat_message') {
                    
                    // Extraemos el Payload según tu documentación
                    // Puede venir en wrapper.data, wrapper.payload o ser el wrapper mismo
                    const payload = wrapper.data || wrapper.payload || wrapper;

                    console.log("📨 Payload de Chat detectado:", payload);

                    // 3. COMPARAR MATCH ID
                    // Convertimos a String para evitar errores de tipo (UUID vs String)
                    const incomingMatchId = String(payload.matchId || '').trim();
                    const currentMatchId = String(this.matchId).trim();

                    if (incomingMatchId === currentMatchId) {
                        
                        // Extraer datos del remitente
                        const fromData = payload.from || {};
                        const incomingUserId = String(fromData.userId || payload.userId || '');
                        
                        console.log(`🔎 Comparando IDs: ${incomingUserId} (Remitente) vs ${this.userId} (Yo)`);

                        // Si el mensaje NO es mío, lo muestro
                        if (incomingUserId !== this.userId) {
                            console.log("✅ ES DEL RIVAL -> RENDERIZANDO");
                            this.renderMessage(fromData.username || 'Rival', payload.content, 'OPPONENT');
                        } else {
                            console.log("⚠️ Es mi propio mensaje (ignorar)");
                        }
                    } else {
                        console.warn(`❌ MatchId no coincide: Recibido(${incomingMatchId}) vs Actual(${currentMatchId})`);
                    }
                }

            } catch (e) {
                console.error("Error procesando mensaje WS:", e);
            }
        };

        this.ws.onclose = () => setTimeout(() => this.connect(), 3000);
    },

    // 4. ENVIAR POR HTTP (POST) - Protocolo FETCH_FIRST
    async sendMessage() {
        const text = this.dom.input.value.trim();
        if (!text) return;

        // Render optimista (lo muestro yo mismo)
        this.renderMessage('Tú', text, 'ME');
        this.dom.input.value = '';
        this.dom.input.focus();

        try {
            console.log("📤 Enviando POST a:", `${CHAT_API_URL}/matches/${this.matchId}/messages`);
            
            const response = await fetch(`${CHAT_API_URL}/matches/${this.matchId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.userId}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content: text })
            });

            if (response.ok) {
                console.log("✅ Servidor aceptó mensaje (201/200)");
            } else {
                console.warn("❌ Servidor rechazó mensaje:", response.status);
            }
        } catch (error) {
            console.error("Error de red:", error);
            this.addSystemMessage("Error de conexión.");
        }
    },

    renderMessage(sender, text, type) {
        const msgDiv = document.createElement('div');
        msgDiv.style.padding = '8px 12px';
        msgDiv.style.borderRadius = '8px';
        msgDiv.style.maxWidth = '85%';
        msgDiv.style.wordWrap = 'break-word';
        msgDiv.style.fontSize = '0.9rem';
        msgDiv.style.boxShadow = '0 1px 2px rgba(0,0,0,0.3)';

        if (type === 'ME') {
            msgDiv.style.alignSelf = 'flex-end';
            msgDiv.style.backgroundColor = '#2980b9'; 
            msgDiv.style.color = '#fff';
            msgDiv.innerHTML = `<strong>Tú:</strong> ${escapeHtml(text)}`;
        } else {
            msgDiv.style.alignSelf = 'flex-start';
            msgDiv.style.backgroundColor = '#444'; 
            msgDiv.style.color = '#ecf0f1';
            msgDiv.innerHTML = `<strong>${escapeHtml(sender)}:</strong> ${escapeHtml(text)}`;
        }

        this.dom.area.appendChild(msgDiv);
        this.dom.area.scrollTop = this.dom.area.scrollHeight;
    },

    addSystemMessage(text) {
        const msg = document.createElement('div');
        msg.style.fontSize = '0.75rem';
        msg.style.color = '#f39c12';
        msg.style.textAlign = 'center';
        msg.style.margin = '5px 0';
        msg.textContent = text;
        this.dom.area.appendChild(msg);
    },

    wireEvents() {
        if(this.dom.btn) {
            this.dom.btn.addEventListener('click', (e) => { e.preventDefault(); this.sendMessage(); });
        }
        this.dom.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); this.sendMessage(); }
        });
    }
};

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.Chat = Chat;