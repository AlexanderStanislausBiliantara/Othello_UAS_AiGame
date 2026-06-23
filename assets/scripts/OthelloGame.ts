import { _decorator, Component, Node, Prefab, UITransform, instantiate, Sprite, Color, EventTouch, Vec3, Label, Button } from 'cc';
const { ccclass, property } = _decorator;

enum PieceType {
    EMPTY = 0,
    BLACK = 1,
    WHITE = 2
}

const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1,0], [1, 1]
]

@ccclass('OthelloGame')
export class OthelloGame extends Component {

    @property(Label)
    blackScoreLabel: Label;

    @property(Label)
    whiteScoreLabel: Label;

    @property(Label)
    winnerLabel: Label;

    @property(Button)
    resetButton: Button;

    @property(Prefab)
    diskPrefab: Prefab;

    private readonly BOARD_SIZE = 8;
    private readonly CELL_SIZE = 100;
    private readonly HALF_BOARD = 400;

    private boardState: number[][] = [];
    private currPlayer: PieceType = PieceType.BLACK;

    private diskNodes: Node[][] = [];
    private uiTransform: UITransform;

    start() {
        this.uiTransform = this.node.getComponent(UITransform);
        this.initBoard();
        this.winnerLabel.node.active = false;

        this.updateScore();

        this.node.on(Node.EventType.TOUCH_END, this.onBoardClick, this);
    }

    updateScore() {
        let scores = this.calcScores();

        if (this.blackScoreLabel) {
            this.blackScoreLabel.string = `${scores.black}`;
        }

        if (this.whiteScoreLabel) {
            this.whiteScoreLabel.string = `${scores.white}`;
        }
    }

    initBoard() {
        for (let r = 0;r < this.BOARD_SIZE;++r) {
            this.boardState[r] = [];
            this.diskNodes[r] = [];
            
            for (let c = 0;c < this.BOARD_SIZE;++c) {
                this.boardState[r][c] = PieceType.EMPTY;
                this.diskNodes[r][c] = null;
            }
        }

        this.boardState[3][3] = PieceType.WHITE;
        this.placeDisk(3, 3, PieceType.WHITE);

        this.boardState[3][4] = PieceType.BLACK;
        this.placeDisk(3, 4, PieceType.BLACK);

        this.boardState[4][3] = PieceType.BLACK;
        this.placeDisk(4, 3, PieceType.BLACK);

        this.boardState[4][4] = PieceType.WHITE;
        this.placeDisk(4, 4, PieceType.WHITE);
    }

    resetBoard() {
        this.node.removeAllChildren();
        this.currPlayer = PieceType.BLACK;

        if (this.winnerLabel) {
            this.winnerLabel.node.active = false;
        }

        this.node.off(Node.EventType.TOUCH_END, this.onBoardClick, this);
        this.node.on(Node.EventType.TOUCH_END, this.onBoardClick, this);

        this.initBoard();
        this.updateScore();
    }

    onBoardClick(event: EventTouch) {
        const touchPos = event.getUILocation();
        const localPos = this.uiTransform.convertToNodeSpaceAR(new Vec3(touchPos.x, touchPos.y, 0));
        const col = Math.floor((localPos.x + this.HALF_BOARD) / this.CELL_SIZE);
        const row = this.BOARD_SIZE - 1 - Math.floor((localPos.y + this.HALF_BOARD) / this.CELL_SIZE);

        if (row < 0 || row >= this.BOARD_SIZE || col < 0 || col >= this.BOARD_SIZE) {
            return;
        }

        if (this.isLegalMove(row, col, this.currPlayer)) {
            this.executeMove(row, col, this.currPlayer);
            this.switchPlayer();
        }
    }

    executeMove(row: number, col: number, player: PieceType) {
        this.boardState[row][col] = player;

        const piecesToFlip = this.getFlippedPieces(row, col, player);
        for (let pos of piecesToFlip) {
            this.boardState[pos[0]][pos[1]] = player;
            this.updateDiskCOlor(pos[0], pos[1], player);
        }

        this.placeDisk(row, col, player);
        this.updateScore();
    }

    getFlippedPieces(row: number, col: number, player: PieceType): number[][] {
        let allFlipped: number[][] = [];
        for (let dir of DIRECTIONS) {
            let flipped = this.checkDirections(row, col, dir[0], dir[1], player);
            allFlipped = allFlipped.concat(flipped);
        }

        return allFlipped;
    }

    isLegalMove(row: number, col: number, player: PieceType): boolean {
        if (this.boardState[row][col] !== PieceType.EMPTY) {
            return false;
        }

        for (let dir of DIRECTIONS) {
            if (this.checkDirections(row, col, dir[0], dir[1], player).length > 0) {
                return true;
            }
        }

        return false;
    }

    checkDirections(row: number, col: number, dRow: number, dCol: number, player: PieceType): number[][] {
        let opponent = null;
        if (player === PieceType.BLACK) {
            opponent = PieceType.WHITE;
        } else {
            opponent = PieceType.BLACK;
        }

        let flipped: number[][] = [];

        let r = row + dRow;
        let c = col + dCol;

        while (r >= 0 && r < this.BOARD_SIZE && c >= 0 && c < this.BOARD_SIZE && this.boardState[r][c] === opponent) {
            flipped.push([r, c]);
            r += dRow;
            c += dCol;
        }

        if (r < 0 || r >= this.BOARD_SIZE || c < 0 || c >= this.BOARD_SIZE) {
            return [];
        }

        if (this.boardState[r][c] === PieceType.EMPTY) {
            return [];
        }

        return flipped;
    }

    placeDisk(row: number, col: number, player: PieceType) {
        const x = -this.HALF_BOARD + (col * this.CELL_SIZE) + (this.CELL_SIZE / 2);
        const y = this.HALF_BOARD - (row * this.CELL_SIZE) - (this.CELL_SIZE / 2);

        let diskNode: Node;

        if (this.diskNodes[row][col]) {
            diskNode = this.diskNodes[row][col];
        } else {
            diskNode = instantiate(this.diskPrefab);
            this.node.addChild(diskNode);
            this.diskNodes[row][col] = diskNode;
        }

        console.log('placing disk');
        diskNode.setPosition(x, y, 0);
        this.setDiskColor(diskNode, player);
    }

    setDiskColor(node: Node, player: PieceType) {
        const sprite = node.getComponent(Sprite);
        if (sprite) {
            if (player === PieceType.BLACK) {
                sprite.color = Color.BLACK;
            } else {
                sprite.color = Color.WHITE;
            }
        }
    }

    updateDiskCOlor(row: number, col: number, player: PieceType) {
        if (this.diskNodes[row][col]) {
            this.setDiskColor(this.diskNodes[row][col], player);
        }
    }

    switchPlayer() {
        let nextPlayer = null;
        if (this.currPlayer === PieceType.BLACK) {
            nextPlayer = PieceType.WHITE;
        } else {
            nextPlayer = PieceType.BLACK;
        }

        if (!this.hasAnyLegalMoves(nextPlayer)) {
            if (!this.hasAnyLegalMoves(this.currPlayer)) {
                this.triggerGameOver();
                return;
            } else {
                return;
            }
        }

        this.currPlayer = nextPlayer;
    }

    hasAnyLegalMoves(player: PieceType): boolean {
        for (let r = 0;r < this.BOARD_SIZE;++r) {
            for (let c = 0;c < this.BOARD_SIZE;++c) {
                if (this.isLegalMove(r, c, player)) {
                    return true;
                }
            }
        }

        return false;
    }

    calcScores(): { black: number, white: number } {
        let blackCount = 0;
        let whiteCount = 0;

        for (let r = 0;r < this.BOARD_SIZE;++r) {
            for (let c = 0;c < this.BOARD_SIZE;++c) {
                if (this.boardState[r][c] === PieceType.BLACK) {
                    ++blackCount;
                } else if (this.boardState[r][c] === PieceType.WHITE) {
                    ++whiteCount;
                }
            }
        }

        return { black: blackCount, white: whiteCount };
    }

    triggerGameOver() {
        this.node.off(Node.EventType.TOUCH_END, this.onBoardClick, this);

        if (this.winnerLabel) {
            this.winnerLabel.node.active = true;
        }

        let scores = this.calcScores();
        let winText = "";

        if (scores.black > scores.white) {
            winText = "Black Wins!";
        } else if (scores.black < scores.white) {
            winText = "White Wins!";
        } else {
            winText = "Tie!";
        }

        if (this.winnerLabel) {
            this.winnerLabel.string = winText;
        }
    }

    update(deltaTime: number) {
        
    }
}


