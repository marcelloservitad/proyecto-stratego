/* chat_ws.js - Filtro de Duplicados Optimizado */

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
        // Aseguramos que los IDs sean Strings limpios para comparar bien después
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

        this.ws = new WebSocket(`${CHAT_WS_URL}?userId=${encodeURIComponent(this.userId)}`);

        this.ws.onopen = () => {
            console.log("🔵 Chat WS: Conectado.");
            this.addSystemMessage("Chat conectado.");
        };

        this.ws.onmessage = (event) => {
            try {
                const wrapper = JSON.parse(event.data);
                
                // Filtramos eventos que no sean de chat
                if (wrapper.event !== 'match_chat_message') return;

                // Extraemos el payload
                const payload = wrapper.data || wrapper.payload || wrapper;

                // --- FILTRADO DE MENSAJES (Corrección de Duplicados) ---

                // 1. Validar Match ID (Ignorar mensajes de otras partidas)
                const msgMatchId = String(payload.matchId || '').trim();
                if (msgMatchId !== this.matchId) return;

                // 2. Extraer ID del remitente de forma segura
                // Busca en payload.from.userId O en payload.userId
                const fromData = payload.from || {};
                const senderId = String(fromData.userId || payload.userId || '').trim();
                const myId = String(this.userId).trim();

                // 3. LA REGLA DE ORO: Si el ID es igual al mío, NO renderizo
                if (senderId === myId) {
                    console.log("🚫 Mensaje propio recibido por WS (Ignorado para evitar duplicado).");
                    return; 
                }

                // 4. Si llegamos aquí, es del rival -> Renderizar
                const senderName = fromData.username || 'Rival';
                this.renderMessage(senderName, payload.content, 'OPPONENT');

            } catch (e) {
                console.error("Error WS:", e);
            }
        };

        this.ws.onclose = () => setTimeout(() => this.connect(), 3000);
    },

    async sendMessage() {
        const text = this.dom.input.value.trim();
        if (!text) return;

        // 1. RENDER OPTIMISTA (Este es el que ves tú inmediatamente)
        this.renderMessage('Tú', text, 'ME');
        
        this.dom.input.value = '';
        this.dom.input.focus();

        try {
            // 2. ENVIAR AL SERVIDOR
            const response = await fetch(`${CHAT_API_URL}/matches/${this.matchId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.userId}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content: text })
            });

            if (!response.ok) {
                console.warn("❌ Error enviando mensaje:", response.status);
                this.addSystemMessage("Error: No se pudo enviar el mensaje.");
            }
        } catch (error) {
            console.error("Error de red:", error);
            this.addSystemMessage("Error de conexión.");
        }
    },

    renderMessage(sender, text, type) {
        const msgDiv = document.createElement('div');
        // Estilos básicos en línea para asegurar visualización
        msgDiv.style.padding = '8px 12px';
        msgDiv.style.borderRadius = '8px';
        msgDiv.style.maxWidth = '85%';
        msgDiv.style.wordWrap = 'break-word';
        msgDiv.style.fontSize = '0.9rem';
        msgDiv.style.marginBottom = '5px';
        msgDiv.style.boxShadow = '0 1px 2px rgba(0,0,0,0.3)';

        if (type === 'ME') {
            msgDiv.style.alignSelf = 'flex-end';
            msgDiv.style.backgroundColor = '#2980b9'; // Azul para mí
            msgDiv.style.color = '#fff';
            msgDiv.innerHTML = `<strong>Tú:</strong> ${escapeHtml(text)}`;
        } else {
            msgDiv.style.alignSelf = 'flex-start';
            msgDiv.style.backgroundColor = '#444'; // Gris para el rival
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