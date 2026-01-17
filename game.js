// game.js - Lógica completa del juego Stratego
class GameManager {
    constructor() {
        this.board = new Array(10).fill().map(() => new Array(10).fill(null));
        this.currentPlayer = 'player'; // 'player' o 'opponent'
        this.selectedPiece = null;
        this.validMoves = [];
        this.gameState = 'waiting'; // 'waiting', 'playing', 'paused', 'finished'
        this.pieces = {
            player: [],
            opponent: []
        };
        this.turnHistory = [];
        this.gameStartTime = null;
        this.moveCount = 0;
        this.gameMode = 'pvp'; // 'pvp' o 'pve'
        this.winner = null;
        this.victoryType = null; // 'flag_capture', 'annihilation', 'surrender', 'stalemate'
        
        // Configuración del bot (para PvE)
        this.botDifficulty = 'medium'; // 'easy', 'medium', 'hard'
        this.botThinkingTime = 1000; // ms
        
        // Referencias a elementos del DOM
        this.boardElement = null;
        this.turnIndicator = null;
        this.playerPiecesCount = null;
        this.opponentPiecesCount = null;
        this.moveHistoryElement = null;
        this.chatElement = null;
        
        // Estado del combate actual
        this.currentCombat = null;
        
        // Configuración del protocolo
        this.communicationManager = null;
    }
    
    initializeGame() {
        console.log('Inicializando juego...');
        
        // Obtener referencias a elementos del DOM
        this.boardElement = document.getElementById('game-board');
        this.turnIndicator = document.getElementById('turn-indicator');
        this.playerPiecesCount = document.getElementById('player-pieces-count');
        this.opponentPiecesCount = document.getElementById('opponent-pieces-count');
        this.moveHistoryElement = document.getElementById('move-history');
        this.chatElement = document.getElementById('game-chat-messages');
        
        // Configurar el gestor de comunicación
        this.communicationManager = new CommunicationManager();
        
        // Cargar estado del juego
        this.loadGameState();
        
        // Inicializar tablero
        this.initializeBoard();
        
        // Cargar despliegue
        this.loadDeployment();
        
        // Determinar primer jugador (en Stratego, el azul/jugador 1 suele comenzar)
        this.determineFirstPlayer();
        
        // Configurar event listeners
        this.setupGameEventListeners();
        
        // Actualizar interfaz
        this.updateGameDisplay();
        this.updatePiecesCount();
        this.updateProtocolDisplay();
        
        // Iniciar temporizador
        this.gameStartTime = Date.now();
        this.updateGameTimer();
        
        // Si es PvE y es turno del bot, hacer que juegue
        if (this.gameMode === 'pve' && this.currentPlayer === 'opponent') {
            setTimeout(() => this.botMakeMove(), this.botThinkingTime);
        }
        
        console.log('Juego inicializado. Turno de:', this.currentPlayer);
    }
    
    loadGameState() {
        // Cargar desde localStorage
        const savedGame = localStorage.getItem('current_game');
        if (savedGame) {
            const gameData = JSON.parse(savedGame);
            this.gameMode = gameData.mode;
            AppState.currentGame = gameData;
        }
        
        // Cargar configuración de protocolo
        const protocol = localStorage.getItem('game_protocol');
        if (protocol) {
            this.communicationManager.initialize(protocol);
        }
    }
    
    loadDeployment() {
        const deployment = JSON.parse(localStorage.getItem('game_deployment'));
        if (!deployment) {
            console.error('No se encontró despliegue guardado');
            this.showErrorModal('Error: No se pudo cargar el despliegue de piezas.');
            return;
        }
        
        console.log('Cargando despliegue...');
        
        // Cargar piezas del jugador
        deployment.pieces.forEach(pieceData => {
            const pieceConfig = PIECES_DATA.classic.find(p => p.id === pieceData.type);
            if (pieceConfig) {
                const piece = new Piece(pieceConfig, 'player');
                piece.id = pieceData.id || piece.id;
                piece.position = pieceData.position;
                this.pieces.player.push(piece);
                
                // Colocar en el tablero (fila invertida porque el jugador está en la parte inferior)
                const boardRow = 9 - piece.position.row; // Invertir para vista del tablero
                const boardCol = piece.position.col;
                
                if (this.isValidPosition(boardRow, boardCol)) {
                    this.board[boardRow][boardCol] = piece;
                }
            }
        });
        
        // Generar despliegue del oponente
        this.generateOpponentDeployment();
        
        console.log('Despliegue cargado. Jugador:', this.pieces.player.length, 'piezas');
        console.log('Oponente:', this.pieces.opponent.length, 'piezas');
    }
    
    generateOpponentDeployment() {
        // Para PvP, el servidor debería enviar el despliegue del oponente
        // Para PvE, generamos un despliegue aleatorio para el bot
        
        const gameType = AppState.currentGame?.gameType || 'classic';
        const piecesConfig = PIECES_DATA[gameType];
        
        // Crear lista de todas las piezas del oponente
        piecesConfig.forEach(pieceData => {
            for (let i = 0; i < pieceData.count; i++) {
                const piece = new Piece(pieceData, 'opponent');
                this.pieces.opponent.push(piece);
            }
        });
        
        // Posiciones válidas para el oponente (primeras 4 filas del tablero, filas 0-3)
        const validPositions = [];
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 10; col++) {
                // Evitar posiciones de lago
                if (!this.isLakePosition(row, col)) {
                    validPositions.push({ row, col });
                }
            }
        }
        
        // Mezclar posiciones
        for (let i = validPositions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [validPositions[i], validPositions[j]] = [validPositions[j], validPositions[i]];
        }
        
        // Asignar posiciones aleatorias a las piezas
        this.pieces.opponent.forEach((piece, index) => {
            if (index < validPositions.length) {
                piece.position = validPositions[index];
                this.board[piece.position.row][piece.position.col] = piece;
            }
        });
    }
    
    initializeBoard() {
        console.log('Inicializando tablero...');
        
        if (!this.boardElement) {
            console.error('Elemento del tablero no encontrado');
            return;
        }
        
        this.boardElement.innerHTML = '';
        
        // Crear tablero 10x10
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                const cell = document.createElement('div');
                cell.className = 'board-full-cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                // Determinar territorio
                if (row < 4) {
                    cell.classList.add('opponent-territory');
                    cell.title = 'Territorio enemigo';
                } else if (row > 5) {
                    cell.classList.add('player-territory');
                    cell.title = 'Tu territorio';
                } else {
                    cell.title = 'Tierra de nadie';
                }
                
                // Marcar lagos (filas 4-5, columnas 2-3 y 6-7)
                if (this.isLakePosition(row, col)) {
                    cell.classList.add('lake');
                    cell.title = 'Lago - No transitable';
                    cell.innerHTML = '🌊';
                } else {
                    // Agregar event listeners solo a celdas no-lago
                    cell.addEventListener('click', () => this.handleCellClick(row, col));
                    cell.addEventListener('dragover', (e) => this.handleDragOver(e, row, col));
                    cell.addEventListener('drop', (e) => this.handleDrop(e, row, col));
                    cell.addEventListener('dragenter', (e) => this.handleDragEnter(e, row, col));
                    cell.addEventListener('dragleave', (e) => this.handleDragLeave(e, row, col));
                    
                    // Permitir drag and drop para piezas del jugador
                    cell.addEventListener('dragstart', (e) => this.handleDragStart(e, row, col));
                    cell.draggable = true;
                }
                
                this.boardElement.appendChild(cell);
            }
        }
        
        console.log('Tablero inicializado con 10x10 celdas');
    }
    
    isLakePosition(row, col) {
        // Los lagos están en las filas 4-5, columnas 2-3 y 6-7
        const isInLakeRow = (row === 4 || row === 5);
        const isInLakeCol = (col === 2 || col === 3 || col === 6 || col === 7);
        return isInLakeRow && isInLakeCol;
    }
    
    isValidPosition(row, col) {
        return row >= 0 && row < 10 && col >= 0 && col < 10 && !this.isLakePosition(row, col);
    }
    
    determineFirstPlayer() {
        // En Stratego tradicional, el jugador rojo (oponente) comienza
        // Pero en nuestra implementación, el jugador (azul) comienza por defecto
        this.currentPlayer = 'player';
        this.gameState = 'playing';
        console.log('Primer jugador determinado:', this.currentPlayer);
    }
    
    setupGameEventListeners() {
        console.log('Configurando event listeners del juego...');
        
        // Botones de control del juego
        const surrenderBtn = document.getElementById('surrender-btn');
        const offerDrawBtn = document.getElementById('offer-draw-btn');
        const saveGameBtn = document.getElementById('save-game-btn');
        const protocolBtn = document.getElementById('toggle-protocol-btn');
        
        if (surrenderBtn) {
            surrenderBtn.addEventListener('click', () => this.handleSurrender());
        }
        
        if (offerDrawBtn) {
            offerDrawBtn.addEventListener('click', () => this.handleOfferDraw());
        }
        
        if (saveGameBtn) {
            saveGameBtn.addEventListener('click', () => this.handleSaveGame());
        }
        
        if (protocolBtn) {
            protocolBtn.addEventListener('click', () => this.toggleProtocolDisplay());
        }
        
        // Chat del juego
        const chatInput = document.getElementById('game-chat-input');
        const sendChatBtn = document.getElementById('send-game-chat');
        
        if (sendChatBtn && chatInput) {
            sendChatBtn.addEventListener('click', () => this.sendGameChat());
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendGameChat();
            });
        }
        
        // Configurar drag and drop global
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        
        document.addEventListener('drop', (e) => {
            e.preventDefault();
        });
        
        // Configurar eventos de comunicación
        this.setupCommunicationListeners();
        
        // Configurar temporizador de actualización
        setInterval(() => this.updateGameTimer(), 1000);
        
        console.log('Event listeners configurados');
    }
    
    setupCommunicationListeners() {
        // Escuchar mensajes del servidor/servidor local
        // En una implementación real, esto vendría de WebSockets o SSE
        
        // Simular mensajes para demostración
        window.addEventListener('gameMessage', (e) => {
            this.handleIncomingMessage(e.detail);
        });
    }
    
    handleIncomingMessage(message) {
        console.log('Mensaje recibido:', message);
        
        switch (message.type) {
            case 'game_move':
                this.handleOpponentMove(message.move);
                break;
            case 'chat_message':
                this.addChatMessage(message.sender, message.message, false);
                break;
            case 'game_over':
                this.handleGameOver(message);
                break;
            case 'draw_offer':
                this.handleDrawOffer(message);
                break;
            case 'draw_response':
                this.handleDrawResponse(message);
                break;
        }
    }
    
    handleCellClick(row, col) {
        if (this.gameState !== 'playing') return;
        if (this.currentPlayer !== 'player') return;
        
        const piece = this.board[row][col];
        
        // Si hay una pieza seleccionada, intentar mover/atacar
        if (this.selectedPiece) {
            const move = this.validMoves.find(m => m.row === row && m.col === col);
            if (move) {
                this.executeMove(this.selectedPiece, { row, col });
                return;
            } else {
                // Si se hace clic en otro lugar, deseleccionar
                this.selectedPiece = null;
                this.validMoves = [];
                this.updateBoardDisplay();
            }
        }
        
        // Si no hay pieza seleccionada, seleccionar pieza propia
        if (piece && piece.player === 'player' && piece.canMove()) {
            this.selectPiece(piece);
        }
    }
    
    handleDragStart(e, row, col) {
        if (this.gameState !== 'playing') return;
        if (this.currentPlayer !== 'player') return;
        
        const piece = this.board[row][col];
        if (piece && piece.player === 'player' && piece.canMove()) {
            e.dataTransfer.setData('text/plain', JSON.stringify({
                pieceId: piece.id,
                row: row,
                col: col
            }));
            e.target.classList.add('dragging');
            
            // Seleccionar la pieza visualmente
            this.selectPiece(piece);
        } else {
            e.preventDefault(); // No permitir arrastrar si no es una pieza válida
        }
    }
    
    handleDragOver(e, row, col) {
        e.preventDefault();
        
        if (this.selectedPiece) {
            const move = this.validMoves.find(m => m.row === row && m.col === col);
            if (move) {
                e.dataTransfer.dropEffect = 'move';
            } else {
                e.dataTransfer.dropEffect = 'none';
            }
        }
    }
    
    handleDragEnter(e, row, col) {
        if (this.selectedPiece) {
            const move = this.validMoves.find(m => m.row === row && m.col === col);
            if (move) {
                e.target.classList.add('drag-over-valid');
            }
        }
    }
    
    handleDragLeave(e, row, col) {
        e.target.classList.remove('drag-over-valid');
    }
    
    handleDrop(e, row, col) {
        e.preventDefault();
        e.target.classList.remove('drag-over-valid');
        
        if (!this.selectedPiece) return;
        
        const move = this.validMoves.find(m => m.row === row && m.col === col);
        if (move) {
            this.executeMove(this.selectedPiece, { row, col });
        }
    }
    
    selectPiece(piece) {
        console.log('Seleccionando pieza:', piece);
        
        this.selectedPiece = piece;
        this.calculateValidMoves(piece);
        this.updateBoardDisplay();
        
        // Mostrar información de la pieza seleccionada
        this.showPieceInfo(piece);
    }
    
    calculateValidMoves(piece) {
        this.validMoves = [];
        
        if (!piece || !piece.canMove()) return;
        
        console.log('Calculando movimientos para:', piece.name, 'en', piece.position);
        
        // Direcciones básicas: arriba, abajo, izquierda, derecha
        const directions = [
            { dr: -1, dc: 0 },  // arriba
            { dr: 1, dc: 0 },   // abajo
            { dr: 0, dc: -1 },  // izquierda
            { dr: 0, dc: 1 }    // derecha
        ];
        
        if (piece.type === 'scout') {
            // Explorador puede moverse múltiples casillas en línea recta
            this.calculateScoutMoves(piece);
        } else {
            // Otras piezas se mueven una casilla a la vez
            directions.forEach(dir => {
                const newRow = piece.position.row + dir.dr;
                const newCol = piece.position.col + dir.dc;
                
                if (this.isValidMove(piece, newRow, newCol)) {
                    this.validMoves.push({
                        row: newRow,
                        col: newCol,
                        type: this.board[newRow][newCol] ? 'attack' : 'move'
                    });
                }
            });
        }
        
        console.log('Movimientos válidos encontrados:', this.validMoves.length);
    }
    
    calculateScoutMoves(piece) {
        // El explorador puede moverse cualquier número de casillas en línea recta
        // hasta encontrar un obstáculo (lago, pieza amiga, borde del tablero)
        
        const directions = [
            { dr: -1, dc: 0 },  // arriba
            { dr: 1, dc: 0 },   // abajo
            { dr: 0, dc: -1 },  // izquierda
            { dr: 0, dc: 1 }    // derecha
        ];
        
        directions.forEach(dir => {
            let currentRow = piece.position.row;
            let currentCol = piece.position.col;
            let distance = 1;
            
            while (true) {
                const newRow = currentRow + dir.dr;
                const newCol = currentCol + dir.dc;
                
                if (!this.isValidMove(piece, newRow, newCol, true)) {
                    break;
                }
                
                this.validMoves.push({
                    row: newRow,
                    col: newCol,
                    type: this.board[newRow][newCol] ? 'attack' : 'move',
                    distance: distance
                });
                
                // Si hay una pieza en esta casilla, el explorador no puede continuar
                if (this.board[newRow][newCol]) {
                    break;
                }
                
                // Continuar en la misma dirección
                currentRow = newRow;
                currentCol = newCol;
                distance++;
            }
        });
    }
    
    isValidMove(piece, row, col, isScout = false) {
        // Verificar límites del tablero
        if (row < 0 || row >= 10 || col < 0 || col >= 10) return false;
        
        // Verificar lagos
        if (this.isLakePosition(row, col)) return false;
        
        const targetPiece = this.board[row][col];
        
        // Casilla vacía: movimiento válido
        if (!targetPiece) return true;
        
        // Mismo jugador: movimiento no válido
        if (targetPiece.player === piece.player) return false;
        
        // Pieza enemiga: ataque válido (excepto que sea un explorador moviéndose más de una casilla)
        // En Stratego oficial, un explorador NO puede atacar después de moverse múltiples casillas
        // pero muchas variantes permiten el ataque. Aquí lo permitiremos.
        if (targetPiece.player !== piece.player) {
            return true;
        }
        
        return false;
    }
    
    executeMove(piece, targetPos) {
        console.log('Ejecutando movimiento:', piece.name, 'a', targetPos);
        
        const targetPiece = this.board[targetPos.row][targetPos.col];
        
        // Registrar el movimiento
        const moveRecord = {
            moveNumber: ++this.moveCount,
            player: this.currentPlayer,
            pieceType: piece.type,
            from: { ...piece.position },
            to: targetPos,
            timestamp: Date.now()
        };
        
        if (targetPiece) {
            // Es un ataque
            moveRecord.action = 'attack';
            moveRecord.targetType = targetPiece.type;
            this.resolveCombat(piece, targetPiece, targetPos);
        } else {
            // Es un movimiento simple
            moveRecord.action = 'move';
            this.performMove(piece, targetPos);
        }
        
        // Agregar al historial
        this.turnHistory.push(moveRecord);
        this.updateMoveHistory();
        
        // Limpiar selección
        this.selectedPiece = null;
        this.validMoves = [];
        
        // Actualizar display
        this.updateBoardDisplay();
        this.updatePiecesCount();
        
        // Enviar movimiento al servidor (en PvP)
        if (this.gameMode === 'pvp') {
            this.sendMoveToServer(moveRecord);
        }
        
        // Cambiar turno
        this.switchTurn();
        
        // Verificar si el juego terminó
        setTimeout(() => this.checkGameEnd(), 100);
    }
    
    performMove(piece, newPosition) {
        console.log('Moviendo pieza', piece.name, 'a', newPosition);
        
        // Limpiar posición anterior
        const oldRow = piece.position.row;
        const oldCol = piece.position.col;
        this.board[oldRow][oldCol] = null;
        
        // Actualizar posición de la pieza
        piece.position = newPosition;
        
        // Colocar en nueva posición
        this.board[newPosition.row][newPosition.col] = piece;
        
        // Si la pieza llega a la fila final del oponente (fila 0)
        // podría tener efectos especiales según reglas de la casa
        if (newPosition.row === 0 && piece.player === 'player') {
            console.log('¡Pieza llegó al territorio enemigo!');
            // Posible habilidad especial o bonificación
        }
    }
    
    resolveCombat(attacker, defender, position) {
        console.log('Resolviendo combate:', attacker.name, 'vs', defender.name);
        
        // Mostrar modal de combate
        this.showCombatModal(attacker, defender);
        
        // Determinar resultado según reglas del Stratego
        const result = this.calculateCombatResult(attacker, defender);
        
        // Animación y actualización del estado
        setTimeout(() => {
            this.processCombatResult(attacker, defender, position, result);
        }, 1500);
    }
    
    calculateCombatResult(attacker, defender) {
        // Reglas de combate del Stratego:
        // 1. Si el atacante es un ESPÍA y el defensor es el MARISCAL: ESPÍA gana (solo si ataca primero)
        // 2. Si el defensor es una BOMBA:
        //    - Si el atacante es un MINERO: MINERO gana (desactiva la bomba)
        //    - Cualquier otra pieza: BOMBA gana
        // 3. Si el atacante y defensor tienen el mismo rango: ambos mueren
        // 4. En otros casos: la pieza con mayor rango gana
        
        // Espía vs Mariscal
        if (attacker.type === 'spy' && defender.type === 'marshal') {
            return 'attacker_wins';
        }
        
        // Bomba
        if (defender.type === 'bomb') {
            if (attacker.type === 'miner') {
                return 'attacker_wins';
            } else {
                return 'defender_wins';
            }
        }
        
        // Mismo rango
        if (attacker.rank === defender.rank) {
            return 'both_die';
        }
        
        // Comparación normal de rangos
        if (attacker.rank > defender.rank) {
            return 'attacker_wins';
        } else {
            return 'defender_wins';
        }
    }
    
    processCombatResult(attacker, defender, position, result) {
        console.log('Resultado del combate:', result);
        
        // Ocultar modal de combate
        this.hideCombatModal();
        
        // Procesar resultado
        switch (result) {
            case 'attacker_wins':
                this.removePiece(defender);
                this.performMove(attacker, position);
                this.addGameMessage(`¡${attacker.name} derrotó a ${defender.name}!`);
                break;
                
            case 'defender_wins':
                this.removePiece(attacker);
                this.addGameMessage(`¡${defender.name} derrotó a ${attacker.name}!`);
                break;
                
            case 'both_die':
                this.removePiece(attacker);
                this.removePiece(defender);
                // Limpiar la casilla de combate
                this.board[position.row][position.col] = null;
                this.addGameMessage(`¡${attacker.name} y ${defender.name} se eliminaron mutuamente!`);
                break;
        }
        
        // Revelar las piezas que participaron en el combate
        attacker.revealed = true;
        defender.revealed = true;
        
        // Si la bandera fue capturada, el juego termina
        if (defender.type === 'flag') {
            this.endGame('player', 'flag_capture');
            return;
        }
        
        // Actualizar display
        this.updateBoardDisplay();
        this.updatePiecesCount();
    }
    
    removePiece(piece) {
        console.log('Eliminando pieza:', piece.name);
        
        // Remover del tablero
        if (piece.position) {
            this.board[piece.position.row][piece.position.col] = null;
        }
        
        // Remover de la lista de piezas
        const pieceList = piece.player === 'player' ? this.pieces.player : this.pieces.opponent;
        const index = pieceList.findIndex(p => p.id === piece.id);
        if (index !== -1) {
            pieceList.splice(index, 1);
        }
        
        // Animación de eliminación (se maneja en CSS)
        const cell = document.querySelector(`[data-row="${piece.position.row}"][data-col="${piece.position.col}"]`);
        if (cell) {
            const pieceElement = cell.querySelector('.game-piece');
            if (pieceElement) {
                pieceElement.classList.add('eliminating');
                setTimeout(() => {
                    cell.innerHTML = '';
                }, 500);
            }
        }
    }
    
    switchTurn() {
        this.currentPlayer = this.currentPlayer === 'player' ? 'opponent' : 'player';
        console.log('Cambiando turno. Ahora es turno de:', this.currentPlayer);
        
        this.updateTurnIndicator();
        
        // Si es turno del bot (en PvE), hacer que juegue
        if (this.gameMode === 'pve' && this.currentPlayer === 'opponent' && this.gameState === 'playing') {
            setTimeout(() => this.botMakeMove(), this.botThinkingTime);
        }
        
        // Verificar si el oponente tiene movimientos legales
        if (this.currentPlayer === 'opponent') {
            const hasLegalMoves = this.hasLegalMoves('opponent');
            if (!hasLegalMoves) {
                console.log('Oponente no tiene movimientos legales');
                this.endGame('player', 'stalemate');
            }
        }
    }
    
    hasLegalMoves(player) {
        const pieces = player === 'player' ? this.pieces.player : this.pieces.opponent;
        
        for (const piece of pieces) {
            if (!piece.canMove()) continue;
            
            // Verificar movimientos básicos
            const directions = [
                { dr: -1, dc: 0 },
                { dr: 1, dc: 0 },
                { dr: 0, dc: -1 },
                { dr: 0, dc: 1 }
            ];
            
            for (const dir of directions) {
                const newRow = piece.position.row + dir.dr;
                const newCol = piece.position.col + dir.dc;
                
                if (this.isValidMove(piece, newRow, newCol)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    botMakeMove() {
        if (this.gameState !== 'playing') return;
        if (this.currentPlayer !== 'opponent') return;
        
        console.log('Bot pensando...');
        
        // Estrategia simple del bot:
        // 1. Encontrar todas las piezas móviles
        // 2. Para cada pieza, calcular movimientos válidos
        // 3. Elegir el mejor movimiento según la dificultad
        
        const movablePieces = this.pieces.opponent.filter(p => p.canMove());
        
        if (movablePieces.length === 0) {
            console.log('Bot no tiene piezas móviles');
            this.endGame('player', 'annihilation');
            return;
        }
        
        // Recolectar todos los movimientos posibles
        const allMoves = [];
        
        movablePieces.forEach(piece => {
            this.calculateValidMoves(piece);
            this.validMoves.forEach(move => {
                allMoves.push({
                    piece: piece,
                    target: move,
                    priority: this.calculateMovePriority(piece, move)
                });
            });
        });
        
        if (allMoves.length === 0) {
            console.log('Bot no tiene movimientos válidos');
            this.switchTurn(); // Pasar turno
            return;
        }
        
        // Ordenar por prioridad (más alta primero)
        allMoves.sort((a, b) => b.priority - a.priority);
        
        // Elegir movimiento según dificultad
        let chosenMove;
        
        switch (this.botDifficulty) {
            case 'easy':
                // Movimiento aleatorio
                chosenMove = allMoves[Math.floor(Math.random() * allMoves.length)];
                break;
                
            case 'medium':
                // Mejor movimiento de los primeros 3
                const topMoves = allMoves.slice(0, Math.min(3, allMoves.length));
                chosenMove = topMoves[Math.floor(Math.random() * topMoves.length)];
                break;
                
            case 'hard':
                // Mejor movimiento disponible
                chosenMove = allMoves[0];
                break;
                
            default:
                chosenMove = allMoves[0];
        }
        
        console.log('Bot eligió movimiento:', chosenMove);
        
        // Ejecutar movimiento
        this.selectedPiece = chosenMove.piece;
        setTimeout(() => {
            this.executeMove(chosenMove.piece, chosenMove.target);
        }, 500);
    }
    
    calculateMovePriority(piece, move) {
        let priority = 0;
        const targetCell = this.board[move.row][move.col];
        
        // Ataques
        if (targetCell) {
            if (targetCell.type === 'flag') {
                priority += 1000; // ¡Capturar la bandera!
            } else if (targetCell.type === 'marshal') {
                priority += 500; // Atacar al mariscal
            } else if (piece.type === 'miner' && targetCell.type === 'bomb') {
                priority += 400; // Minero desactivando bomba
            } else if (piece.type === 'spy' && targetCell.type === 'marshal') {
                priority += 300; // Espía atacando mariscal
            } else if (piece.rank > targetCell.rank) {
                priority += 200; // Ataque favorable
            } else if (piece.rank === targetCell.rank) {
                priority += 50; // Intercambio igualado
            } else {
                priority -= 100; // Ataque desfavorable
            }
        } else {
            // Movimientos
            // Avanzar hacia el territorio enemigo
            if (move.row > piece.position.row) { // Moviéndose hacia abajo (hacia el jugador)
                priority += 10;
            }
            
            // Moverse hacia el centro
            const distanceFromCenter = Math.abs(move.col - 4.5) + Math.abs(move.row - 4.5);
            priority += (9 - distanceFromCenter) * 2;
        }
        
        // Penalizar exponer piezas valiosas
        if (piece.rank > 7) { // Piezas de alto rango
            priority -= 20;
        }
        
        return priority;
    }
    
    checkGameEnd() {
        // Verificar condiciones de victoria
        
        // 1. Bandera capturada
        const playerFlag = this.pieces.player.find(p => p.type === 'flag');
        const opponentFlag = this.pieces.opponent.find(p => p.type === 'flag');
        
        if (!playerFlag) {
            this.endGame('opponent', 'flag_capture');
            return;
        }
        
        if (!opponentFlag) {
            this.endGame('player', 'flag_capture');
            return;
        }
        
        // 2. Aniquilación (sin piezas móviles)
        const playerHasMovablePieces = this.pieces.player.some(p => p.canMove());
        const opponentHasMovablePieces = this.pieces.opponent.some(p => p.canMove());
        
        if (!playerHasMovablePieces) {
            this.endGame('opponent', 'annihilation');
            return;
        }
        
        if (!opponentHasMovablePieces) {
            this.endGame('player', 'annihilation');
            return;
        }
        
        // 3. Bloqueo táctico (sin movimientos legales en el turno actual)
        // Esto se verifica en switchTurn()
        
        console.log('Juego continúa...');
    }
    
    endGame(winner, victoryType) {
        console.log('¡Juego terminado! Ganador:', winner, 'Tipo:', victoryType);
        
        this.gameState = 'finished';
        this.winner = winner;
        this.victoryType = victoryType;
        
        // Calcular duración del juego
        const gameDuration = Date.now() - this.gameStartTime;
        const minutes = Math.floor(gameDuration / 60000);
        const seconds = Math.floor((gameDuration % 60000) / 1000);
        
        // Mostrar modal de fin de juego
        this.showGameOverModal(winner, victoryType, minutes, seconds);
        
        // Actualizar estadísticas
        this.updateStatistics(winner);
        
        // Guardar resultado
        this.saveGameResult();
        
        // En PvP, notificar al servidor
        if (this.gameMode === 'pvp') {
            this.sendGameResultToServer();
        }
        
        // Redirigir a pantalla de post-juego después de un tiempo
        setTimeout(() => {
            window.location.href = 'postgame.html';
        }, 5000);
    }
    
    updateStatistics(winner) {
        const user = JSON.parse(localStorage.getItem('stratego_user') || '{}');
        
        if (this.gameMode === 'pvp') {
            if (winner === 'player') {
                user.wins = (user.wins || 0) + 1;
                user.rating = (user.rating || 1200) + 10;
            } else {
                user.losses = (user.losses || 0) + 1;
                user.rating = Math.max(800, (user.rating || 1200) - 10);
            }
        } else {
            if (winner === 'player') {
                user.pveWins = (user.pveWins || 0) + 1;
            }
        }
        
        localStorage.setItem('stratego_user', JSON.stringify(user));
    }
    
    saveGameResult() {
        const gameResult = {
            id: AppState.currentGame?.id || Date.now(),
            mode: this.gameMode,
            winner: this.winner,
            victoryType: this.victoryType,
            duration: Date.now() - this.gameStartTime,
            moves: this.moveCount,
            date: new Date().toISOString(),
            playerPiecesRemaining: this.pieces.player.length,
            opponentPiecesRemaining: this.pieces.opponent.length
        };
        
        // Guardar en historial
        const gameHistory = JSON.parse(localStorage.getItem('game_history') || '[]');
        gameHistory.unshift(gameResult);
        localStorage.setItem('game_history', JSON.stringify(gameHistory.slice(0, 50))); // Mantener solo las 50 últimas
    }
    
    // Métodos de UI
    updateBoardDisplay() {
        if (!this.boardElement) return;
        
        const cells = this.boardElement.querySelectorAll('.board-full-cell:not(.lake)');
        
        cells.forEach(cell => {
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            const piece = this.board[row][col];
            
            // Limpiar clases anteriores
            cell.className = 'board-full-cell';
            cell.classList.add(row < 4 ? 'opponent-territory' : 
                              row > 5 ? 'player-territory' : '');
            
            // Limpiar contenido
            cell.innerHTML = '';
            
            // Si hay una pieza en esta celda
            if (piece) {
                const pieceElement = this.createPieceElement(piece);
                cell.appendChild(pieceElement);
                
                // Resaltar si está seleccionada
                if (this.selectedPiece && 
                    this.selectedPiece.id === piece.id) {
                    cell.classList.add('selected');
                }
            }
            
            // Resaltar movimientos válidos
            this.validMoves.forEach(move => {
                if (move.row === row && move.col === col) {
                    const targetPiece = this.board[row][col];
                    if (targetPiece) {
                        cell.classList.add('attack-target');
                    } else {
                        cell.classList.add('valid-move');
                    }
                }
            });
        });
    }
    
    createPieceElement(piece) {
        const isPlayerPiece = piece.player === 'player';
        const isRevealed = piece.revealed || isPlayerPiece;
        
        const div = document.createElement('div');
        div.className = 'game-piece';
        div.classList.add(piece.player);
        if (isRevealed) div.classList.add('revealed');
        if (piece.type) div.classList.add(piece.type);
        
        // Símbolo de la pieza
        const symbol = this.getPieceSymbol(piece.type);
        
        div.innerHTML = `
            <div class="piece-symbol">${symbol}</div>
            <div class="piece-rank">${isRevealed ? piece.rank : '?'}</div>
            ${isRevealed ? `<div class="piece-name">${piece.name}</div>` : ''}
        `;
        
        // Tooltip con información
        div.title = isRevealed ? 
            `${piece.name} (Rango: ${piece.rank})` : 
            'Pieza desconocida';
        
        return div;
    }
    
    getPieceSymbol(type) {
        const symbols = {
            'marshal': '🎖️',
            'general': '⭐',
            'colonel': '🦅',
            'major': '⚔️',
            'captain': '🛡️',
            'lieutenant': '⚜️',
            'sergeant': '🔰',
            'miner': '⛏️',
            'scout': '👁️',
            'spy': '🕵️',
            'bomb': '💣',
            'flag': '🏁'
        };
        
        return symbols[type] || '❓';
    }
    
    updateTurnIndicator() {
        if (!this.turnIndicator) return;
        
        if (this.currentPlayer === 'player') {
            this.turnIndicator.textContent = '🎮 TU TURNO';
            this.turnIndicator.className = 'turn-indicator your-turn';
        } else {
            this.turnIndicator.textContent = this.gameMode === 'pvp' ? 
                '⏳ TURNO DEL OPONENTE' : '🤖 TURNO DEL BOT';
            this.turnIndicator.className = 'turn-indicator opponent-turn';
        }
    }
    
    updatePiecesCount() {
        if (this.playerPiecesCount) {
            this.playerPiecesCount.textContent = this.pieces.player.length;
        }
        
        if (this.opponentPiecesCount) {
            this.opponentPiecesCount.textContent = this.pieces.opponent.length;
        }
    }
    
    updateMoveHistory() {
        if (!this.moveHistoryElement) return;
        
        // Mostrar solo los últimos 10 movimientos
        const recentMoves = this.turnHistory.slice(-10);
        
        this.moveHistoryElement.innerHTML = recentMoves.map(move => `
            <div class="move-item">
                <span class="move-number">${move.moveNumber}.</span>
                <span class="move-player">${move.player === 'player' ? 'Tú' : 'Op'}</span>
                <span class="move-action">${move.action === 'move' ? 'movió' : 'atacó'}</span>
                <span class="move-piece">${move.pieceType}</span>
                <span class="move-target">${move.targetType ? '→ ' + move.targetType : ''}</span>
            </div>
        `).join('');
        
        // Auto-scroll al final
        this.moveHistoryElement.scrollTop = this.moveHistoryElement.scrollHeight;
    }
    
    updateGameTimer() {
        const timerElement = document.getElementById('game-timer');
        if (!timerElement || !this.gameStartTime) return;
        
        const elapsed = Date.now() - this.gameStartTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    updateProtocolDisplay() {
        const protocolElement = document.getElementById('game-protocol-display');
        if (!protocolElement) return;
        
        const protocol = localStorage.getItem('game_protocol') || 'SOCKET_FIRST';
        
        if (protocol === 'SOCKET_FIRST') {
            protocolElement.textContent = 'WebSockets (Principal)';
            protocolElement.title = 'Movimientos por WebSockets, Chat por Fetch+SSE';
        } else {
            protocolElement.textContent = 'Fetch+SSE (Principal)';
            protocolElement.title = 'Movimientos por Fetch+SSE, Chat por WebSockets';
        }
    }
    
    // Métodos de UI - Modales
    showPieceInfo(piece) {
        // Crear o actualizar tooltip de información de pieza
        const infoElement = document.getElementById('piece-info') || this.createPieceInfoElement();
        
        const isRevealed = piece.revealed || piece.player === 'player';
        
        infoElement.innerHTML = `
            <h3>${isRevealed ? piece.name : 'Pieza Desconocida'}</h3>
            ${isRevealed ? `
                <p><strong>Rango:</strong> ${piece.rank}</p>
                <p><strong>Tipo:</strong> ${piece.type}</p>
                <p><strong>Puede mover:</strong> ${piece.canMove() ? 'Sí' : 'No'}</p>
                ${piece.special ? `<p><strong>Habilidad:</strong> ${this.getSpecialDescription(piece.special)}</p>` : ''}
            ` : `
                <p>Esta pieza aún no ha sido revelada.</p>
                <p>Haz clic en un movimiento válido para atacar o mover.</p>
            `}
        `;
        
        infoElement.classList.remove('hidden');
    }
    
    createPieceInfoElement() {
        const div = document.createElement('div');
        div.id = 'piece-info';
        div.className = 'piece-info-modal';
        document.querySelector('.game-container').appendChild(div);
        return div;
    }
    
    getSpecialDescription(special) {
        const descriptions = {
            'long_move': 'Puede moverse múltiples casillas en línea recta',
            'attack_marshal': 'Puede vencer al Mariscal si ataca primero',
            'immobile_explodes': 'No se mueve. Elimina cualquier atacante excepto Mineros',
            'objective': 'Objetivo del juego. Si es capturada, pierdes.',
            'defuse_bomb': 'Puede desactivar Bombas'
        };
        
        return descriptions[special] || special;
    }
    
    showCombatModal(attacker, defender) {
        const modal = document.getElementById('combat-modal') || this.createCombatModal();
        
        const attackerRevealed = attacker.revealed || attacker.player === 'player';
        const defenderRevealed = defender.revealed || defender.player === 'player';
        
        modal.innerHTML = `
            <div class="modal-content">
                <h2>⚔️ ¡COMBATE!</h2>
                <div class="combat-result">
                    <div class="combatant player">
                        <div class="combat-piece">${this.getPieceSymbol(attacker.type)}</div>
                        <div class="combat-details">
                            <h3>${attackerRevealed ? attacker.name : 'Pieza Desconocida'}</h3>
                            <p class="piece-rank">Rango: ${attackerRevealed ? attacker.rank : '?'}</p>
                            <p class="player-name">${attacker.player === 'player' ? '(Tú)' : '(Oponente)'}</p>
                        </div>
                    </div>
                    
                    <div class="vs-text">VS</div>
                    
                    <div class="combatant opponent">
                        <div class="combat-piece">${this.getPieceSymbol(defender.type)}</div>
                        <div class="combat-details">
                            <h3>${defenderRevealed ? defender.name : 'Pieza Desconocida'}</h3>
                            <p class="piece-rank">Rango: ${defenderRevealed ? defender.rank : '?'}</p>
                            <p class="player-name">${defender.player === 'player' ? '(Tú)' : '(Oponente)'}</p>
                        </div>
                    </div>
                </div>
                
                <div class="combat-outcome" id="combat-outcome">
                    <p>Calculando resultado...</p>
                </div>
                
                <div class="modal-footer">
                    <button class="btn-primary" onclick="window.gameManager?.hideCombatModal()">
                        Continuar
                    </button>
                </div>
            </div>
        `;
        
        modal.classList.remove('hidden');
        
        // Calcular y mostrar resultado después de un breve retraso
        setTimeout(() => {
            const result = this.calculateCombatResult(attacker, defender);
            const outcomeElement = document.getElementById('combat-outcome');
            
            let outcomeText = '';
            let outcomeClass = '';
            
            switch (result) {
                case 'attacker_wins':
                    outcomeText = `¡${attackerRevealed ? attacker.name : 'Tu pieza'} gana!`;
                    outcomeClass = 'outcome-victory';
                    break;
                case 'defender_wins':
                    outcomeText = `¡${defenderRevealed ? defender.name : 'Pieza enemiga'} gana!`;
                    outcomeClass = 'outcome-victory';
                    break;
                case 'both_die':
                    outcomeText = '¡Ambas piezas son eliminadas!';
                    outcomeClass = 'outcome-draw';
                    break;
            }
            
            outcomeElement.innerHTML = `<p>${outcomeText}</p>`;
            outcomeElement.className = `combat-outcome ${outcomeClass}`;
        }, 1000);
    }
    
    createCombatModal() {
        const div = document.createElement('div');
        div.id = 'combat-modal';
        div.className = 'modal combat-modal hidden';
        document.body.appendChild(div);
        return div;
    }
    
    hideCombatModal() {
        const modal = document.getElementById('combat-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
    
    showGameOverModal(winner, victoryType, minutes, seconds) {
        const modal = document.getElementById('game-over-modal') || this.createGameOverModal();
        
        const isPlayerWinner = winner === 'player';
        const victoryMessages = {
            'flag_capture': 'Bandera Capturada',
            'annihilation': 'Aniquilación Completa',
            'surrender': 'Rendición',
            'stalemate': 'Bloqueo Táctico'
        };
        
        modal.innerHTML = `
            <div class="modal-content">
                <h2>${isPlayerWinner ? '🎉 ¡VICTORIA!' : '💀 ¡DERROTA!'}</h2>
                
                <div class="victory-details">
                    <p><strong>Tipo de victoria:</strong> ${victoryMessages[victoryType] || victoryType}</p>
                    <p><strong>Duración:</strong> ${minutes}:${seconds.toString().padStart(2, '0')}</p>
                    <p><strong>Movimientos:</strong> ${this.moveCount}</p>
                    <p><strong>Piezas restantes:</strong> ${this.pieces.player.length} vs ${this.pieces.opponent.length}</p>
                </div>
                
                <div class="winner-announcement">
                    <h3>${isPlayerWinner ? '¡Has demostrado tu valía, General!' : 'La derrota es una lección para la próxima batalla.'}</h3>
                </div>
                
                <div class="modal-footer">
                    <button class="btn-success" onclick="window.gameManager?.goToPostGame()">
                        Ver Reporte Detallado
                    </button>
                    <button class="btn-primary" onclick="window.gameManager?.returnToLobby()">
                        Volver al Lobby
                    </button>
                </div>
            </div>
        `;
        
        modal.classList.remove('hidden');
    }
    
    createGameOverModal() {
        const div = document.createElement('div');
        div.id = 'game-over-modal';
        div.className = 'modal game-over-modal hidden';
        document.body.appendChild(div);
        return div;
    }
    
    showErrorModal(message) {
        const modal = document.getElementById('error-modal') || this.createErrorModal();
        
        modal.innerHTML = `
            <div class="modal-content">
                <h2>⚠️ Error</h2>
                <p>${message}</p>
                <div class="modal-footer">
                    <button class="btn-primary" onclick="this.closest('.modal').classList.add('hidden')">
                        Aceptar
                    </button>
                </div>
            </div>
        `;
        
        modal.classList.remove('hidden');
    }
    
    createErrorModal() {
        const div = document.createElement('div');
        div.id = 'error-modal';
        div.className = 'modal error-modal hidden';
        document.body.appendChild(div);
        return div;
    }
    
    // Métodos de Chat
    sendGameChat() {
        const input = document.getElementById('game-chat-input');
        const message = input?.value.trim();
        
        if (!message) return;
        
        // En PvP, enviar al oponente
        if (this.gameMode === 'pvp') {
            this.communicationManager.sendChatMessage({
                type: 'game_chat',
                message: message,
                gameId: AppState.currentGame?.id
            });
        }
        
        // Mostrar en el chat local
        this.addChatMessage(AppState.user?.username || 'Tú', message, true);
        
        // Limpiar input
        if (input) input.value = '';
    }
    
    addChatMessage(sender, message, isOwn) {
        if (!this.chatElement) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwn ? 'sender' : 'player'}`;
        
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageDiv.innerHTML = `
            <span class="message-sender">${sender}:</span>
            <span class="message-text">${message}</span>
            <span class="message-time">${time}</span>
        `;
        
        this.chatElement.appendChild(messageDiv);
        this.chatElement.scrollTop = this.chatElement.scrollHeight;
    }
    
    addGameMessage(message) {
        this.addChatMessage('Sistema', message, false);
    }
    
    // Métodos de Control del Juego
    handleSurrender() {
        if (confirm('¿Estás seguro de que quieres rendirte? Esto concederá la victoria a tu oponente.')) {
            this.endGame('opponent', 'surrender');
        }
    }
    
    handleOfferDraw() {
        if (this.gameMode !== 'pvp') {
            alert('Las tablas solo están disponibles en partidas PvP.');
            return;
        }
        
        if (confirm('¿Ofrecer tablas a tu oponente?')) {
            this.communicationManager.sendMessage({
                type: 'draw_offer',
                gameId: AppState.currentGame?.id
            });
            
            this.addGameMessage('Has ofrecido tablas a tu oponente.');
        }
    }
    
    handleSaveGame() {
        const gameState = {
            board: this.board.map(row => row.map(cell => cell ? {
                id: cell.id,
                type: cell.type,
                player: cell.player,
                revealed: cell.revealed,
                position: cell.position
            } : null)),
            currentPlayer: this.currentPlayer,
            pieces: {
                player: this.pieces.player.map(p => ({
                    id: p.id,
                    type: p.type,
                    position: p.position,
                    revealed: p.revealed
                })),
                opponent: this.pieces.opponent.map(p => ({
                    id: p.id,
                    type: p.type,
                    position: p.position,
                    revealed: p.revealed
                }))
            },
            turnHistory: this.turnHistory,
            moveCount: this.moveCount,
            gameStartTime: this.gameStartTime
        };
        
        const saveName = prompt('Nombre para guardar la partida:', 
            `Partida_${new Date().toLocaleDateString()}`);
        
        if (saveName) {
            const savedGames = JSON.parse(localStorage.getItem('saved_games') || '{}');
            savedGames[saveName] = {
                data: gameState,
                date: new Date().toISOString(),
                mode: this.gameMode
            };
            
            localStorage.setItem('saved_games', JSON.stringify(savedGames));
            alert(`Partida "${saveName}" guardada exitosamente.`);
        }
    }
    
    toggleProtocolDisplay() {
        const protocolElement = document.getElementById('game-protocol-display');
        if (protocolElement) {
            protocolElement.classList.toggle('detailed');
        }
    }
    
    // Métodos de Navegación
    goToPostGame() {
        window.location.href = 'postgame.html';
    }
    
    returnToLobby() {
        // Limpiar datos de la partida actual
        localStorage.removeItem('current_game');
        localStorage.removeItem('game_deployment');
        
        window.location.href = 'index.html';
    }
    
    // Métodos de Comunicación (simulados)
    sendMoveToServer(move) {
        // En una implementación real, esto enviaría al servidor
        console.log('Enviando movimiento al servidor:', move);
        
        // Simular respuesta del oponente después de un retraso
        if (this.gameMode === 'pvp') {
            setTimeout(() => {
                this.simulateOpponentResponse();
            }, 2000);
        }
    }
    
    sendGameResultToServer() {
        console.log('Enviando resultado al servidor:', {
            winner: this.winner,
            victoryType: this.victoryType
        });
    }
    
    simulateOpponentResponse() {
        // Solo para demostración - en una implementación real vendría del servidor
        console.log('Simulando respuesta del oponente');
        
        // Simular que el oponente hace un movimiento aleatorio
        if (this.gameState === 'playing' && this.currentPlayer === 'opponent') {
            this.botMakeMove();
        }
    }
    
    handleOpponentMove(moveData) {
        if (this.gameState !== 'playing') return;
        if (this.currentPlayer !== 'opponent') return;
        
        console.log('Procesando movimiento del oponente:', moveData);
        
        // Buscar la pieza del oponente
        const piece = this.pieces.opponent.find(p => 
            p.position.row === moveData.from.row && 
            p.position.col === moveData.from.col
        );
        
        if (piece) {
            this.selectedPiece = piece;
            setTimeout(() => {
                this.executeMove(piece, moveData.to);
            }, 1000);
        }
    }
    
    handleGameOver(data) {
        this.endGame(data.winner, data.victoryType);
    }
    
    handleDrawOffer(data) {
        if (confirm(`${data.from} ofrece tablas. ¿Aceptas?`)) {
            this.communicationManager.sendMessage({
                type: 'draw_response',
                gameId: data.gameId,
                response: 'accepted'
            });
            
            // Terminar juego en empate
            this.endGame('draw', 'agreement');
        } else {
            this.communicationManager.sendMessage({
                type: 'draw_response',
                gameId: data.gameId,
                response: 'rejected'
            });
            
            this.addGameMessage('Has rechazado la oferta de tablas.');
        }
    }
    
    handleDrawResponse(data) {
        if (data.response === 'accepted') {
            this.endGame('draw', 'agreement');
        } else {
            this.addGameMessage('Tu oferta de tablas fue rechazada.');
        }
    }
}

// Inicializar el juego cuando la página esté lista
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('game.html')) {
        window.gameManager = new GameManager();
        window.gameManager.initializeGame();
        
        // Exponer métodos útiles para eventos desde HTML
        window.handleSurrender = () => window.gameManager.handleSurrender();
        window.handleOfferDraw = () => window.gameManager.handleOfferDraw();
        window.handleSaveGame = () => window.gameManager.handleSaveGame();
    }
});*/