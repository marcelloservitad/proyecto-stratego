// Datos de las piezas según las reglas europeas
const PIECES_DATA = {
    classic: [
        { id: 'marshal', name: 'Mariscal', rank: 10, count: 1, movable: true, image: 'marshal.png' },
        { id: 'general', name: 'General', rank: 9, count: 1, movable: true, image: 'general.png' },
        { id: 'colonel', name: 'Coronel', rank: 8, count: 2, movable: true, image: 'colonel.png' },
        { id: 'major', name: 'Comandante', rank: 7, count: 3, movable: true, image: 'major.png' },
        { id: 'captain', name: 'Capitán', rank: 6, count: 4, movable: true, image: 'captain.png' },
        { id: 'lieutenant', name: 'Teniente', rank: 5, count: 4, movable: true, image: 'lieutenant.png' },
        { id: 'sergeant', name: 'Sargento', rank: 4, count: 4, movable: true, image: 'sergeant.png' },
        { id: 'miner', name: 'Minador', rank: 3, count: 5, movable: true, image: 'miner.png' },
        { id: 'scout', name: 'Explorador', rank: 2, count: 8, movable: true, special: 'long_move', image: 'scout.png' },
        { id: 'spy', name: 'Espía', rank: 1, count: 1, movable: true, special: 'attack_marshal', image: 'spy.png' },
        { id: 'bomb', name: 'Bomba', rank: 0, count: 6, movable: false, special: 'immobile_explodes', image: 'bomb.png' },
        { id: 'flag', name: 'Bandera', rank: -1, count: 1, movable: false, special: 'objective', image: 'flag.png' }
    ],
    quick: [
        { id: 'marshal', name: 'Mariscal', rank: 10, count: 1, movable: true, image: 'marshal.png' },
        { id: 'colonel', name: 'Coronel', rank: 8, count: 1, movable: true, image: 'colonel.png' },
        { id: 'major', name: 'Comandante', rank: 7, count: 1, movable: true, image: 'major.png' },
        { id: 'captain', name: 'Capitán', rank: 6, count: 1, movable: true, image: 'captain.png' },
        { id: 'miner', name: 'Minador', rank: 3, count: 2, movable: true, image: 'miner.png' },
        { id: 'scout', name: 'Explorador', rank: 2, count: 2, movable: true, special: 'long_move', image: 'scout.png' },
        { id: 'spy', name: 'Espía', rank: 1, count: 1, movable: true, special: 'attack_marshal', image: 'spy.png' },
        { id: 'bomb', name: 'Bomba', rank: 0, count: 1, movable: false, special: 'immobile_explodes', image: 'bomb.png' },
        { id: 'flag', name: 'Bandera', rank: -1, count: 1, movable: false, special: 'objective', image: 'flag.png' }
    ]
};

// Clase para manejar piezas individuales
class Piece {
    constructor(data, player) {
        this.id = data.id + '_' + player + '_' + Date.now();
        this.type = data.id;
        this.name = data.name;
        this.rank = data.rank;
        this.player = player; // 'player1' o 'player2'
        this.movable = data.movable;
        this.special = data.special;
        this.revealed = false;
        this.position = null;
        this.image = data.image;
    }
    
    getDisplayName() {
        return this.revealed ? this.name : '?';
    }
    
    canMove() {
        return this.movable && this.type !== 'flag';
    }
    
    getAttackPower() {
        return this.rank;
    }
}

// Clase para manejar el inventario de piezas
class PieceInventory {
    constructor(gameType) {
        this.gameType = gameType;
        this.pieces = [];
        this.initializePieces();
    }
    
    initializePieces() {
        const piecesConfig = PIECES_DATA[this.gameType];
        piecesConfig.forEach(pieceData => {
            for (let i = 0; i < pieceData.count; i++) {
                this.pieces.push(new Piece(pieceData, 'player'));
            }
        });
        
        // Mezclar las piezas
        this.shufflePieces();
    }
    
    shufflePieces() {
        for (let i = this.pieces.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.pieces[i], this.pieces[j]] = [this.pieces[j], this.pieces[i]];
        }
    }
    
    getPieceById(id) {
        return this.pieces.find(piece => piece.id === id);
    }
    
    removePiece(id) {
        const index = this.pieces.findIndex(piece => piece.id === id);
        if (index !== -1) {
            return this.pieces.splice(index, 1)[0];
        }
        return null;
    }
    
    addPiece(piece) {
        this.pieces.push(piece);
    }
    
    getAvailablePieces() {
        return this.pieces.filter(piece => !piece.position);
    }
    
    getPlacedPieces() {
        return this.pieces.filter(piece => piece.position);
    }
    
    isDeploymentComplete() {
        return this.getAvailablePieces().length === 0;
    }
}