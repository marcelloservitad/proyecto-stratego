// Datos de las piezas - CORREGIDO para 10 piezas exactas

const PIECES_DATA = {
    classic: [
        { id: 'marshal', name: 'Mariscal', rank: 10, count: 1, movable: true, img: '../images/marshal.png' },
        { id: 'general', name: 'General', rank: 9, count: 1, movable: true, img: '../images/general.png' },
        { id: 'colonel', name: 'Coronel', rank: 8, count: 2, movable: true, img: '../images/colonel.png' },
        { id: 'major', name: 'Comandante', rank: 7, count: 3, movable: true, img: '../images/major.png' },
        { id: 'captain', name: 'Capitán', rank: 6, count: 4, movable: true, img: '../images/captain.png' },
        { id: 'lieutenant', name: 'Teniente', rank: 5, count: 4, movable: true, img: '../images/lieutenant.png' },
        { id: 'sergeant', name: 'Sargento', rank: 4, count: 4, movable: true, img: '../images/sergeant.png' },
        { id: 'miner', name: 'Minador', rank: 3, count: 5, movable: true, img: '../images/miner.png' },
        { id: 'scout', name: 'Explorador', rank: 2, count: 8, movable: true, special: 'long_move', img: '../images/scout.png' },
        { id: 'spy', name: 'Espía', rank: 1, count: 1, movable: true, special: 'attack_marshal', img: '../images/spy.png' },
        { id: 'bomb', name: 'Bomba', rank: 0, count: 6, movable: false, special: 'immobile_explodes', img: '../images/bomb.png' },
        { id: 'flag', name: 'Bandera', rank: -1, count: 1, movable: false, special: 'objective', img: '../images/flag.png' }
    ],
    quick: [
        { id: 'marshal', name: 'Mariscal', rank: 10, count: 1, movable: true, img: '../images/marshal.png' },
        { id: 'colonel', name: 'Coronel', rank: 8, count: 1, movable: true, img: '../images/colonel.png' },
        { id: 'major', name: 'Comandante', rank: 7, count: 1, movable: true, img: '../images/major.png' },
        { id: 'captain', name: 'Capitán', rank: 6, count: 1, movable: true, img: '../images/captain.png' },
        { id: 'lieutenant', name: 'Teniente', rank: 5, count: 1, movable: true, img: '../images/lieutenant.png' },
        { id: 'miner', name: 'Minador', rank: 3, count: 1, movable: true, img: '../images/miner.png' },
        { id: 'scout', name: 'Explorador', rank: 2, count: 1, movable: true, special: 'long_move', img: '../images/scout.png' },
        { id: 'spy', name: 'Espía', rank: 1, count: 1, movable: true, special: 'attack_marshal', img: '../images/spy.png' },
        { id: 'bomb', name: 'Bomba', rank: 0, count: 1, movable: false, special: 'immobile_explodes', img: '../images/bomb.png' },
        { id: 'flag', name: 'Bandera', rank: -1, count: 1, movable: false, special: 'objective', img: '../images/flag.png' }
    ]
};

/**
 * Representa una pieza individual del juego.
 */
class Piece {
    /**
     * @param {Object} data - Datos base de la pieza.
     * @param {string} player - Identificador del jugador.
     * @param {number} index - Índice para asegurar ID único.
     */
    constructor(data, player, index) {
        this.id = `${data.id}_${player}_${index}`;
        this.type = data.id;
        this.name = data.name;
        this.rank = data.rank;
        this.player = player;
        this.movable = data.movable;
        this.special = data.special;
        this.image = data.img; // Asignación directa desde la data
        this.revealed = false;
        this.position = null; 
    }
}

/**
 * Gestiona el conjunto de piezas disponibles para un jugador.
 */
class PieceInventory {
    constructor(gameType) {
        this.gameType = localStorage.getItem('mode') ;
        this.pieces = [];
        this.initializePieces();
        
        // Verificar que la cantidad sea correcta
        console.log(`Inventario creado para ${gameType}: ${this.pieces.length} piezas`);
    }
    
    initializePieces() {
        const piecesConfig = PIECES_DATA[this.gameType] || PIECES_DATA.classic;
        piecesConfig.forEach((pieceData) => {
            for (let i = 0; i < pieceData.count; i++) {
                this.pieces.push(new Piece(pieceData, 'player', i));
            }
        });
        
        // Verificación de cantidad
        const totalCount = piecesConfig.reduce((sum, piece) => sum + piece.count, 0);
        console.log(`Configuración para ${this.gameType}: ${totalCount} piezas totales`);
    }
    
    getPieceById(id) {
        return this.pieces.find((p) => { return p.id === id; });
    }
    
    getAvailablePieces() {
        return this.pieces.filter((p) => { return !p.position; });
    }
    
    getPlacedPieces() {
        return this.pieces.filter((p) => { return p.position !== null; });
    }
    
    isDeploymentComplete() {
        const available = this.getAvailablePieces().length;
        const placed = this.getPlacedPieces().length;
        const total = this.pieces.length;
        
        console.log(`Despliegue: ${placed}/${total} piezas colocadas`);
        
        return available === 0;
    }
    
    // Método para verificar la composición del ejército
    getArmyComposition() {
        const composition = {};
        this.pieces.forEach(piece => {
            if (!composition[piece.type]) {
                composition[piece.type] = 0;
            }
            composition[piece.type]++;
        });
        return composition;
    }
}