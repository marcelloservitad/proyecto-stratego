// Datos de las piezas 

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
        { id: 'miner', name: 'Minador', rank: 3, count: 2, movable: true, img: '../images/miner.png' },
        { id: 'scout', name: 'Explorador', rank: 2, count: 2, movable: true, special: 'long_move', img: '../images/scout.png' },
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
        this.gameType = gameType;
        this.pieces = [];
        this.initializePieces();
    }
    
    initializePieces() {
        const piecesConfig = PIECES_DATA[this.gameType] || PIECES_DATA.classic;
        piecesConfig.forEach((pieceData) => {
            for (let i = 0; i < pieceData.count; i++) {
                this.pieces.push(new Piece(pieceData, 'player', i));
            }
        });
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
        return this.getAvailablePieces().length === 0;
    }
}