import { _decorator, Component, Node, Prefab, UITransform, instantiate, Sprite, Color, EventTouch, Vec3, Label, Button, random, randomRangeInt } from 'cc';
const { ccclass, property } = _decorator;

enum PieceType {
    EMPTY = 0,
    BLACK = 1,
    WHITE = 2
}

// Difficulty Level menentukan seberapa dalam AI menelusuri pohon Minimax.
// Semakin dalam (lebih tinggi angkanya), semakin cerdas AI-nya.
enum Difficulty {
    EASY = 1,  // Depth 1: AI hanya lihat 1 langkah ke depan
    MEDIUM = 4,  // Depth 4: AI lihat 4 langkah ke depan (default)
    HARD = 6   // Depth 6: AI lihat 6 langkah ke depan
}

const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
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

    @property(Prefab)
    validMovePrefab: Prefab;

    // Node panel berisi tombol Easy/Medium/Hard
    @property(Node)
    difficultyPanel: Node;

    private readonly BOARD_SIZE = 8;
    private readonly CELL_SIZE = 100;
    private readonly HALF_BOARD = 400;

    private boardState: number[][] = [];
    private currPlayer: PieceType = PieceType.BLACK;

    private aiDepth: number = Difficulty.MEDIUM;

    private diskNodes: Node[][] = [];
    private uiTransform: UITransform;

    private legalMoves: Node[][] = [];

    start() {
        this.uiTransform = this.node.getComponent(UITransform);
        this.initBoard();
        this.winnerLabel.node.active = false;

        this.updateScore();

        if (this.difficultyPanel) this.difficultyPanel.active = true;

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
        for (let r = 0; r < this.BOARD_SIZE; ++r) {
            this.boardState[r] = [];
            this.diskNodes[r] = [];
            this.legalMoves[r] = [];


            for (let c = 0; c < this.BOARD_SIZE; ++c) {
                this.boardState[r][c] = PieceType.EMPTY;
                this.diskNodes[r][c] = null;

                // fill the legalmove board with the pieces
                // only show the legalmove circle if it's a legal move later on
                const x = -this.HALF_BOARD + (c * this.CELL_SIZE) + (this.CELL_SIZE / 2);
                const y = this.HALF_BOARD - (r * this.CELL_SIZE) - (this.CELL_SIZE / 2);

                let diskNode: Node;
                diskNode = instantiate(this.validMovePrefab);
                this.node.addChild(diskNode);
                this.legalMoves[r][c] = diskNode;
                diskNode.setPosition(x, y, 0);
                diskNode.active = false;
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
        this.updateLegalMoveDisplay();
    }

    resetBoard() {
        if (this.difficultyPanel) this.difficultyPanel.active = true;
        this.performReset();
    }

    private performReset() {
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
        if (this.currPlayer == PieceType.BLACK) {
            const touchPos = event.getUILocation();
            const localPos = this.uiTransform.convertToNodeSpaceAR(new Vec3(touchPos.x, touchPos.y, 0));
            const col = Math.floor((localPos.x + this.HALF_BOARD) / this.CELL_SIZE);
            const row = this.BOARD_SIZE - 1 - Math.floor((localPos.y + this.HALF_BOARD) / this.CELL_SIZE);

            if (row < 0 || row >= this.BOARD_SIZE || col < 0 || col >= this.BOARD_SIZE) {
                return;
            }

            if (this.isLegalMove(row, col, this.currPlayer, this.boardState)) {
                this.executeMove(row, col, this.currPlayer);
                this.switchPlayer();
            }
        }

    }

    //a general apply move function
    //needed for temp boards that will be calculated at minmax process
    applyMove(row: number, col: number, player: PieceType, board: number[][]) {
        board[row][col] = player;
        const piecesToFlip = this.getFlippedPieces(row, col, player, board);
        for (let pos of piecesToFlip) {
            board[pos[0]][pos[1]] = player;
        }
        return piecesToFlip
    }

    executeMove(row: number, col: number, player: PieceType) {
        //applies the moves and also returns pieces to flip
        let piecesToFlip = this.applyMove(row, col, player, this.boardState)

        for (let pos of piecesToFlip) {
            this.boardState[pos[0]][pos[1]] = player;
            this.updateDiskCOlor(pos[0], pos[1], player);
        }

        this.placeDisk(row, col, player);
        this.updateScore();
        this.updateLegalMoveDisplay();
    }

    updateLegalMoveDisplay() {
        for (let r = 0; r < this.BOARD_SIZE; r++) {
            for (let c = 0; c < this.BOARD_SIZE; c++) {
                if (this.isLegalMove(r, c, this.currPlayer, this.boardState)) {  //if a move is legal here now then show 
                    this.legalMoves[r][c].active = true;
                }
                else {
                    this.legalMoves[r][c].active = false;       //if a move is not legal here now hide
                }
            }
        }
    }

    getFlippedPieces(row: number, col: number, player: PieceType, board: number[][]): number[][] {
        let allFlipped: number[][] = [];
        for (let dir of DIRECTIONS) {
            let flipped = this.checkDirections(row, col, dir[0], dir[1], player, board);
            allFlipped = allFlipped.concat(flipped);
        }

        return allFlipped;
    }

    isLegalMove(row: number, col: number, player: PieceType, board: number[][]): boolean {
        if (board[row][col] !== PieceType.EMPTY) {
            return false;
        }

        for (let dir of DIRECTIONS) {
            if (this.checkDirections(row, col, dir[0], dir[1], player, board).length > 0) {
                return true;
            }
        }

        return false;
    }

    checkDirections(row: number, col: number, dRow: number, dCol: number, player: PieceType, board: number[][]): number[][] {
        let opponent = null;
        if (player === PieceType.BLACK) {
            opponent = PieceType.WHITE;
        } else {
            opponent = PieceType.BLACK;
        }

        let flipped: number[][] = [];

        let r = row + dRow;
        let c = col + dCol;

        while (r >= 0 && r < this.BOARD_SIZE && c >= 0 && c < this.BOARD_SIZE && board[r][c] === opponent) {
            flipped.push([r, c]);
            r += dRow;
            c += dCol;
        }

        if (r < 0 || r >= this.BOARD_SIZE || c < 0 || c >= this.BOARD_SIZE) {
            return [];
        }

        if (board[r][c] === PieceType.EMPTY) {
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
        let nextPlayer: PieceType;
        if (this.currPlayer === PieceType.BLACK) {
            nextPlayer = PieceType.WHITE;
        } else {
            nextPlayer = PieceType.BLACK;
        }

        if (!this.hasAnyLegalMoves(nextPlayer)) {
            if (!this.hasAnyLegalMoves(this.currPlayer)) {
                this.triggerGameOver();
                this.updateLegalMoveDisplay();
                return;
            } else {
                if (this.currPlayer === PieceType.WHITE) {
                    this.scheduleOnce(() => { this.AIMove(); }, 0.5);
                }
                this.updateLegalMoveDisplay();
                return;
            }
        }

        this.currPlayer = nextPlayer;
        this.updateLegalMoveDisplay();

        // Jika giliran AI (WHITE), jalankan AIMove setelah jeda singkat
        // Menggunakan scheduleOnce (native Cocos Creator) agar lebih stabil
        // dibanding setTimeout di lingkungan browser Cocos
        if (this.currPlayer === PieceType.WHITE) {
            this.scheduleOnce(() => { this.AIMove(); }, 0.5);
        }
    }

    hasAnyLegalMoves(player: PieceType): boolean {
        for (let r = 0; r < this.BOARD_SIZE; ++r) {
            for (let c = 0; c < this.BOARD_SIZE; ++c) {
                if (this.isLegalMove(r, c, player, this.boardState)) {
                    return true;
                }
            }
        }

        return false;
    }

    calcScores(): { black: number, white: number } {
        let blackCount = 0;
        let whiteCount = 0;

        for (let r = 0; r < this.BOARD_SIZE; ++r) {
            for (let c = 0; c < this.BOARD_SIZE; ++c) {
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

    AIMove() {
        let bestScore = -Infinity;
        let bestMoveR = -1;
        let bestMoveC = -1;

        let alpha = -Infinity;
        const beta = Infinity;

        for (let r = 0; r < this.BOARD_SIZE; r++) {
            for (let c = 0; c < this.BOARD_SIZE; c++) {
                if (this.isLegalMove(r, c, PieceType.WHITE, this.boardState)) {
                    let newBoard = this.boardState.map(row => [...row]);
                    this.applyMove(r, c, PieceType.WHITE, newBoard);

                    // Setelah WHITE bermain, giliran BLACK (MIN player, isMaximizing=false)
                    // Kirim alpha & beta untuk memulai pruning dari level pertama
                    // Kirim juga this.aiDepth sebagai batas kedalaman sesuai difficulty
                    let score = this.minmax(1, newBoard, PieceType.BLACK, alpha, beta, this.aiDepth);

                    if (score > bestScore) {
                        bestScore = score;
                        bestMoveR = r;
                        bestMoveC = c;
                    }

                    // Cabang berikutnya tidak perlu dieksplorasi jika tidak bisa mengalahkan alpha saat ini
                    if (bestScore > alpha) {
                        alpha = bestScore;
                    }
                }
            }
        }

        this.executeMove(bestMoveR, bestMoveC, PieceType.WHITE);
        this.switchPlayer();
    }

    // Dipanggil oleh tombol Easy / Medium / Hard di scene
    setDifficulty(event: any, customEventData?: string) {
        let level = typeof event === 'number' ? event : parseInt(customEventData);

        if (isNaN(level)) {
            console.warn('[Difficulty] CustomEventData kosong, fallback ke Medium');
            level = Difficulty.MEDIUM;
        }

        this.aiDepth = level;

        if (this.difficultyPanel) this.difficultyPanel.active = false;
        this.performReset();
    }

    // Minimax dengan Alpha-Beta Pruning
    // alpha    : nilai terbaik yang sudah pasti bisa dicapai MAX player (WHITE)
    // beta     : nilai terbaik yang sudah pasti bisa dicapai MIN player (BLACK)
    // maxDepth : batas kedalaman pencarian, ditentukan oleh difficulty (Easy=1, Medium=4, Hard=6)
    // Pruning terjadi di 3 kondisi:
    //   1. Kondisi α-β : beta <= alpha = hentikan eksplorasi cabang saat ini
    //   2. Depth limit : depth >= maxDepth = evaluasi state
    //   3. Terminal    : tidak ada legal move untuk kedua player = evaluasi state
    minmax(depth: number, tempBoard: number[][], player: PieceType, alpha: number, beta: number, maxDepth: number): number {

        // Pruning 2: Depth limit
        // Berhenti menelusuri jika sudah mencapai kedalaman maksimum sesuai difficulty
        if (depth >= maxDepth) {
            return this.evaluateBoard(tempBoard);
        }

        let nextPlayer: PieceType;
        if (player == PieceType.BLACK) {
            nextPlayer = PieceType.WHITE;
        } else {
            nextPlayer = PieceType.BLACK;
        }

        // WHITE adalah MAX player (skor lebih tinggi = lebih baik untuk AI)
        // BLACK adalah MIN player (skor lebih rendah = lebih baik untuk lawan)
        let bestScore = (player == PieceType.WHITE) ? -Infinity : Infinity;
        let isLegalMoveAvailable = false;

        for (let r = 0; r < this.BOARD_SIZE; r++) {
            for (let c = 0; c < this.BOARD_SIZE; c++) {
                if (this.isLegalMove(r, c, player, tempBoard)) {
                    isLegalMoveAvailable = true;

                    // Buat salinan papan untuk simulasi tanpa mengubah state asli
                    let newBoard = tempBoard.map(row => [...row]);
                    this.applyMove(r, c, player, newBoard);
                    let score = this.minmax(depth + 1, newBoard, nextPlayer, alpha, beta, maxDepth);

                    if (player == PieceType.WHITE) {
                        // MAX player: update jika score lebih besar
                        if (score > bestScore) {
                            bestScore = score;
                        }
                        // Update alpha — nilai terbaik yang sudah bisa dijamin MAX player
                        if (bestScore > alpha) {
                            alpha = bestScore;
                        }
                    } else {
                        // MIN player: update jika score lebih kecil
                        if (score < bestScore) {
                            bestScore = score;
                        }
                        // Update beta - nilai terbaik yang sudah bisa dijamin MIN player
                        if (bestScore < beta) {
                            beta = bestScore;
                        }
                    }

                    // Pruning 1: Alpha-Beta (β <= α)
                    // MAX player tidak akan mendapat lebih dari beta dari langkah sebelum MIN,
                    // dan MIN player tidak akan mendapat kurang dari alpha dari langkah sebelum MAX.
                    // Jika kondisi ini terpenuhi, tidak perlu mengeksplorasi cabang lain.
                    if (beta <= alpha) {
                        break;
                    }
                }
            }

            //break loop luar jika sudah dipangkas
            if (beta <= alpha) {
                break;
            }
        }

        // Pruning 3: Terminal state (tidak ada legal move)
        // Jika player saat ini tidak punya move, giliran dilewati ke player berikutnya.
        // Jika player berikutnya tidak punya move, game berakhir = evaluasi.
        if (!isLegalMoveAvailable) {
            let nextHasMove = false;
            for (let r = 0; r < this.BOARD_SIZE; r++) {
                for (let c = 0; c < this.BOARD_SIZE; c++) {
                    if (this.isLegalMove(r, c, nextPlayer, tempBoard)) {
                        nextHasMove = true;
                        break;
                    }
                }
                if (nextHasMove) break;
            }

            if (!nextHasMove) {
                // Kedua player tidak punya move = game over = evaluasi final
                return this.evaluateBoard(tempBoard);
            }

            // Hanya player saat ini yang tidak punya move = skip giliran
            return this.minmax(depth + 1, tempBoard, nextPlayer, alpha, beta, maxDepth);
        }

        return bestScore;
    }

    evaluateBoard(board: number[][]): number {
        // Variasi move: tambahkan noise kecil secara acak agar AI tidak selalu memilih
        // move yang identik ketika beberapa move memiliki skor yang sama persis.
        let score = randomRangeInt(-5, 5);

        // 1. Corner Capture (+100 per pojok)
        //    Pojok adalah posisi paling berharga karena tidak bisa dibalik.
        const corners = [
            [0, 0], [0, this.BOARD_SIZE - 1],
            [this.BOARD_SIZE - 1, 0], [this.BOARD_SIZE - 1, this.BOARD_SIZE - 1]
        ];
        for (const [r, c] of corners) {
            if (board[r][c] == PieceType.WHITE) {
                score += 100;
            } else if (board[r][c] == PieceType.BLACK) {
                score -= 100;
            }
        }

        // 2. Disc Count — Early vs Late Game
        //    Early game (total keping < 30): sedikit keping lebih baik (-20 per selisih)
        //    Late game  (total keping >= 30): banyak keping lebih baik (+20 per selisih)
        let whiteDiscs = 0;
        let blackDiscs = 0;
        for (let r = 0; r < this.BOARD_SIZE; r++) {
            for (let c = 0; c < this.BOARD_SIZE; c++) {
                if (board[r][c] == PieceType.WHITE) whiteDiscs++;
                else if (board[r][c] == PieceType.BLACK) blackDiscs++;
            }
        }
        const totalDiscs = whiteDiscs + blackDiscs;
        const discDiff = whiteDiscs - blackDiscs;

        if (totalDiscs < 30) {
            // Early game: AI lebih baik punya sedikit keping (skor dikurangi jika unggul keping)
            score += discDiff * -20;
        } else {
            // Late game: AI lebih baik punya banyak keping (skor ditambah jika unggul keping)
            score += discDiff * 20;
        }

        // 3. Island Count via DFS
        //    Semakin sedikit island (kelompok keping terpisah), semakin bagus.
        //    Island dihitung menggunakan algoritma DFS.
        const whiteIslands = this.countIslands(board, PieceType.WHITE);
        // Penalti -10 per island
        score -= whiteIslands * 10;

        return score;
    }

    // DFS untuk Island Count
    // Menandai semua keping player yang terhubung ke (startR, startC) sebagai sudah dikunjungi
    // Konektivitas 8-arah
    dfsIsland(board: number[][], visited: boolean[][], startR: number, startC: number, player: PieceType): void {
        const stack: [number, number][] = [[startR, startC]];
        while (stack.length > 0) {
            const [r, c] = stack.pop();
            for (const [dr, dc] of DIRECTIONS) {
                const nr = r + dr;
                const nc = c + dc;
                if (
                    nr >= 0 && nr < this.BOARD_SIZE &&
                    nc >= 0 && nc < this.BOARD_SIZE &&
                    !visited[nr][nc] &&
                    board[nr][nc] === player
                ) {
                    visited[nr][nc] = true;
                    stack.push([nr, nc]);
                }
            }
        }
    }

    // Menghitung jumlah island milik player menggunakan DFS
    countIslands(board: number[][], player: PieceType): number {
        // Buat grid visited 8x8
        const visited: boolean[][] = Array.from({ length: this.BOARD_SIZE }, () =>
            Array(this.BOARD_SIZE).fill(false)
        );
        let islands = 0;
        for (let r = 0; r < this.BOARD_SIZE; r++) {
            for (let c = 0; c < this.BOARD_SIZE; c++) {
                // Jika menemukan keping player yang belum dikunjungi, itu adalah island baru
                if (board[r][c] === player && !visited[r][c]) {
                    islands++;
                    visited[r][c] = true;
                    // Tandai semua keping yang terhubung dengan DFS
                    this.dfsIsland(board, visited, r, c, player);
                }
            }
        }
        return islands;
    }

    update(deltaTime: number) {

    }

}


