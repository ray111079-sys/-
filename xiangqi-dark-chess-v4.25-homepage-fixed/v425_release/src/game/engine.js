export const PIECE_NAMES = {
    king: "將帥",
    advisor: "士",
    elephant: "象",
    horse: "馬",
    rook: "車",
    cannon: "炮",
    pawn: "卒兵",
};
export const PIECE_LABELS = {
    red: { king: "帥", advisor: "仕", elephant: "相", horse: "馬", rook: "車", cannon: "炮", pawn: "兵" },
    black: { king: "將", advisor: "士", elephant: "象", horse: "馬", rook: "車", cannon: "砲", pawn: "卒" },
};
export const PIECE_VALUES = {
    king: 10000,
    rook: 900,
    cannon: 450,
    horse: 400,
    elephant: 200,
    advisor: 200,
    pawn: 100,
};
// 暗棋專用的吃子大小順序；不要與一般象棋的估值分數混用。
const DARK_CAPTURE_RANK = {
    king: 7,
    advisor: 6,
    elephant: 5,
    rook: 4,
    horse: 3,
    cannon: 2,
    pawn: 1,
};
export const otherSide = (side) => (side === "red" ? "black" : "red");
export function inside(row, col, rows = 10, cols = 9) {
    return row >= 0 && row < rows && col >= 0 && col < cols;
}
export function clonePiece(piece) {
    return { ...piece, hidden: piece.hidden };
}
function piece(id, side, type, row, col) {
    return { id, side, type, row, col };
}
export function createXiangqiBoard() {
    const board = Array.from({ length: 10 }, () => Array(9).fill(null));
    const add = (p) => (board[p.row][p.col] = p);
    const back = ["rook", "horse", "elephant", "advisor", "king", "advisor", "elephant", "horse", "rook"];
    back.forEach((type, col) => add(piece(`b-${type}-${col}`, "black", type, 0, col)));
    [1, 7].forEach((col, i) => add(piece(`b-cannon-${i}`, "black", "cannon", 2, col)));
    [0, 2, 4, 6, 8].forEach((col, i) => add(piece(`b-pawn-${i}`, "black", "pawn", 3, col)));
    back.forEach((type, col) => add(piece(`r-${type}-${col}`, "red", type, 9, col)));
    [1, 7].forEach((col, i) => add(piece(`r-cannon-${i}`, "red", "cannon", 7, col)));
    [0, 2, 4, 6, 8].forEach((col, i) => add(piece(`r-pawn-${i}`, "red", "pawn", 6, col)));
    return board;
}
export class XiangqiGame {
    board = createXiangqiBoard();
    turn = "red";
    winner = null;
    history = [];
    moveCount = 0;
    moveLog = [];
    selected = null;
    reset() {
        this.board = createXiangqiBoard();
        this.turn = "red";
        this.winner = null;
        this.history = [];
        this.moveCount = 0;
        this.moveLog = [];
        this.selected = null;
    }
    get(row, col) {
        return this.board[row]?.[col] ?? null;
    }
    pathClear(from, to) {
        const dr = Math.sign(to.row - from.row);
        const dc = Math.sign(to.col - from.col);
        let row = from.row + dr;
        let col = from.col + dc;
        let count = 0;
        while (row !== to.row || col !== to.col) {
            if (this.get(row, col))
                count += 1;
            row += dr;
            col += dc;
        }
        return count;
    }
    inPalace(side, row, col) {
        const rowOk = side === "black" ? row >= 0 && row <= 2 : row >= 7 && row <= 9;
        return rowOk && col >= 3 && col <= 5;
    }
    pseudoMoves(piece) {
        const moves = [];
        const add = (row, col) => {
            if (!inside(row, col))
                return;
            const target = this.get(row, col);
            if (!target || target.side !== piece.side)
                moves.push({ from: { row: piece.row, col: piece.col }, to: { row, col }, capture: target ?? undefined });
        };
        const { row, col } = piece;
        if (piece.type === "king") {
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
                const nr = row + dr;
                const nc = col + dc;
                if (this.inPalace(piece.side, nr, nc))
                    add(nr, nc);
            });
            const step = piece.side === "red" ? -1 : 1;
            let r = row + step;
            while (inside(r, col)) {
                const target = this.get(r, col);
                if (target) {
                    if (target.type === "king" && target.side !== piece.side)
                        moves.push({ from: { row, col }, to: { row: r, col }, capture: target });
                    break;
                }
                r += step;
            }
        }
        else if (piece.type === "advisor") {
            [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dr, dc]) => {
                const nr = row + dr;
                const nc = col + dc;
                if (this.inPalace(piece.side, nr, nc))
                    add(nr, nc);
            });
        }
        else if (piece.type === "elephant") {
            [[2, 2], [2, -2], [-2, 2], [-2, -2]].forEach(([dr, dc]) => {
                const nr = row + dr;
                const nc = col + dc;
                const staysHome = piece.side === "red" ? nr >= 5 : nr <= 4;
                const eye = { row: row + dr / 2, col: col + dc / 2 };
                if (inside(nr, nc) && staysHome && !this.get(eye.row, eye.col))
                    add(nr, nc);
            });
        }
        else if (piece.type === "horse") {
            const horseMoves = [
                { dr: -2, dc: -1, br: -1, bc: 0 }, { dr: -2, dc: 1, br: -1, bc: 0 },
                { dr: 2, dc: -1, br: 1, bc: 0 }, { dr: 2, dc: 1, br: 1, bc: 0 },
                { dr: -1, dc: -2, br: 0, bc: -1 }, { dr: 1, dc: -2, br: 0, bc: -1 },
                { dr: -1, dc: 2, br: 0, bc: 1 }, { dr: 1, dc: 2, br: 0, bc: 1 },
            ];
            horseMoves.forEach(({ dr, dc, br, bc }) => {
                if (!this.get(row + br, col + bc))
                    add(row + dr, col + dc);
            });
        }
        else if (piece.type === "rook" || piece.type === "cannon") {
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
                let r = row + dr;
                let c = col + dc;
                let jumped = false;
                while (inside(r, c)) {
                    const target = this.get(r, c);
                    if (!target) {
                        if (piece.type === "rook" || !jumped)
                            moves.push({ from: { row, col }, to: { row: r, col: c } });
                    }
                    else if (!jumped) {
                        if (piece.type === "rook") {
                            if (target.side !== piece.side)
                                moves.push({ from: { row, col }, to: { row: r, col: c }, capture: target });
                            break;
                        }
                        jumped = true;
                    }
                    else {
                        if (piece.type === "cannon" && target.side !== piece.side)
                            moves.push({ from: { row, col }, to: { row: r, col: c }, capture: target });
                        break;
                    }
                    r += dr;
                    c += dc;
                }
            });
        }
        else if (piece.type === "pawn") {
            const forward = piece.side === "red" ? -1 : 1;
            add(row + forward, col);
            const crossed = piece.side === "red" ? row <= 4 : row >= 5;
            if (crossed) {
                add(row, col - 1);
                add(row, col + 1);
            }
        }
        return moves;
    }
    isInCheck(side) {
        const king = this.board.flat().find((p) => p?.side === side && p.type === "king");
        if (!king)
            return true;
        const opponent = otherSide(side);
        return this.board.flat().some((p) => p?.side === opponent && this.pseudoMoves(p).some((m) => m.to.row === king.row && m.to.col === king.col));
    }
    moveLeavesKingInCheck(move) {
        const captured = this.get(move.to.row, move.to.col);
        const moving = this.get(move.from.row, move.from.col);
        if (!moving)
            return true;
        this.board[move.from.row][move.from.col] = null;
        this.board[move.to.row][move.to.col] = { ...moving, row: move.to.row, col: move.to.col };
        const bad = this.isInCheck(moving.side);
        this.board[move.from.row][move.from.col] = moving;
        this.board[move.to.row][move.to.col] = captured;
        return bad;
    }
    legalMovesFor(piece) {
        if (piece.side !== this.turn || this.winner)
            return [];
        return this.pseudoMoves(piece).filter((move) => !this.moveLeavesKingInCheck(move));
    }
    allLegalMoves(side = this.turn) {
        const originalTurn = this.turn;
        this.turn = side;
        const result = this.board.flat().filter((p) => Boolean(p && p.side === side)).flatMap((p) => this.legalMovesFor(p));
        this.turn = originalTurn;
        return result;
    }
    applyMove(move) {
        if (this.winner)
            return false;
        const moving = this.get(move.from.row, move.from.col);
        if (!moving || moving.side !== this.turn || !this.legalMovesFor(moving).some((m) => m.to.row === move.to.row && m.to.col === move.to.col))
            return false;
        const captured = this.get(move.to.row, move.to.col);
        this.board[move.from.row][move.from.col] = null;
        this.board[move.to.row][move.to.col] = { ...moving, row: move.to.row, col: move.to.col };
        if (captured?.type === "king")
            this.winner = moving.side;
        const captureText = captured ? `吃${PIECE_LABELS[captured.side][captured.type]}` : "移動";
        const text = `${PIECE_LABELS[moving.side][moving.type]} ${String.fromCharCode(19968 + move.from.col)}${10 - move.from.row} → ${String.fromCharCode(19968 + move.to.col)}${10 - move.to.row}`;
        const entry = { text: `${text} · ${captureText}`, side: moving.side, kind: captured ? "capture" : "move" };
        this.history = [entry, ...this.history].slice(0, 8);
        this.moveLog = [...this.moveLog, entry];
        this.moveCount += 1;
        this.turn = otherSide(this.turn);
        if (!this.winner && this.allLegalMoves(this.turn).length === 0)
            this.winner = moving.side;
        return true;
    }
    clone() {
        const next = new XiangqiGame();
        next.board = this.board.map((row) => row.map((p) => (p ? clonePiece(p) : null)));
        next.turn = this.turn;
        next.winner = this.winner;
        next.history = [...this.history];
        next.moveCount = this.moveCount;
        next.moveLog = [...this.moveLog];
        next.selected = this.selected ? { ...this.selected } : null;
        return next;
    }
}
function createDarkPieces() {
    const set = [];
    const addMany = (side, type, count) => {
        for (let i = 0; i < count; i++)
            set.push({ id: `${side}-${type}-${i}`, side, type, row: 0, col: 0, hidden: true });
    };
    addMany("red", "king", 1);
    addMany("red", "advisor", 2);
    addMany("red", "elephant", 2);
    addMany("red", "horse", 2);
    addMany("red", "rook", 2);
    addMany("red", "cannon", 2);
    addMany("red", "pawn", 5);
    addMany("black", "king", 1);
    addMany("black", "advisor", 2);
    addMany("black", "elephant", 2);
    addMany("black", "horse", 2);
    addMany("black", "rook", 2);
    addMany("black", "cannon", 2);
    addMany("black", "pawn", 5);
    return set;
}
export class DarkChessGame {
    board = Array.from({ length: 4 }, () => Array(8).fill(null));
    turn = null;
    humanSide = null;
    winner = null;
    history = [];
    moveCount = 0;
    moveLog = [];
    selected = null;
    variant = "standard";
    constructor(variant = "standard") {
        this.variant = variant;
        this.reset();
    }
    setVariant(variant) {
        this.variant = variant;
        this.reset();
    }
    reset() {
        const pieces = createDarkPieces();
        for (let i = pieces.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
        }
        this.board = Array.from({ length: 4 }, (_, row) => Array.from({ length: 8 }, (_, col) => ({ ...pieces[row * 8 + col], row, col })));
        this.turn = null;
        this.humanSide = null;
        this.winner = null;
        this.history = [];
        this.moveCount = 0;
        this.moveLog = [];
        this.selected = null;
    }
    get(row, col) { return this.board[row]?.[col] ?? null; }
    // 暗棋吃子大小順序：帥/將 > 仕/士 > 相/象 > 車 > 馬 > 炮 > 兵/卒。
    // 兵可以吃將帥是唯一的逆向特例；炮則完全不看大小，只需隔一子吃。
    darkCanCapture(attacker, defender) {
        if (attacker.type === "cannon")
            return true;
        if (attacker.type === "pawn" && defender.type === "king")
            return true;
        if (attacker.type === "king" && defender.type === "pawn")
            return false;
        return DARK_CAPTURE_RANK[attacker.type] >= DARK_CAPTURE_RANK[defender.type];
    }
    legalMovesFor(piece) {
        if (piece.hidden || piece.side !== this.turn || this.winner)
            return [];
        const moves = [];
        const from = { row: piece.row, col: piece.col };
        // 暗棋炮：走棋仍為相鄰一格；吃子時必須沿直線恰好隔一子，
        // 被吃的目標必須是已翻開的敵方棋子。炮吃子完全無視大小階級。
        if (piece.type === "cannon") {
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
                let row = piece.row + dr;
                let col = piece.col + dc;
                if (!inside(row, col, 4, 8))
                    return;
                if (!this.get(row, col)) {
                    moves.push({ from, to: { row, col } });
                    return;
                }
                // 第一個棋子是炮架；再往前找第一個目標棋子。
                row += dr;
                col += dc;
                while (inside(row, col, 4, 8)) {
                    const target = this.get(row, col);
                    if (target) {
                        if (!target.hidden && target.side !== piece.side) {
                            moves.push({ from, to: { row, col }, capture: target });
                        }
                        break;
                    }
                    row += dr;
                    col += dc;
                }
            });
            return moves;
        }
        // 「斜馬衝車」模式：
        // 1) 車可沿直/橫線走任意格；空格可任意距離移動。
        // 2) 車若要吃遠處目標（中間至少一格空格），可無視大小；貼身吃子仍受大小限制。
        if (this.variant === "slant-rush" && piece.type === "rook") {
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
                let row = piece.row + dr;
                let col = piece.col + dc;
                let distance = 1;
                while (inside(row, col, 4, 8)) {
                    const target = this.get(row, col);
                    if (!target) {
                        moves.push({ from, to: { row, col } });
                        row += dr;
                        col += dc;
                        distance += 1;
                        continue;
                    }
                    if (!target.hidden && target.side !== piece.side) {
                        const canCapture = distance >= 2 || this.darkCanCapture(piece, target);
                        if (canCapture)
                            moves.push({ from, to: { row, col }, capture: target });
                    }
                    break;
                }
            });
            return moves;
        }
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
            const row = piece.row + dr;
            const col = piece.col + dc;
            if (!inside(row, col, 4, 8))
                return;
            const target = this.get(row, col);
            if (!target) {
                moves.push({ from, to: { row, col } });
            }
            else if (!target.hidden && target.side !== piece.side && this.darkCanCapture(piece, target)) {
                moves.push({ from, to: { row, col }, capture: target });
            }
        });
        // 斜馬：四個斜方向各一格。斜走可移動到空格，也可無視階級直接吃任何已翻開的敵子。
        if (this.variant === "slant-rush" && piece.type === "horse") {
            [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dr, dc]) => {
                const row = piece.row + dr;
                const col = piece.col + dc;
                if (!inside(row, col, 4, 8))
                    return;
                const target = this.get(row, col);
                if (!target)
                    moves.push({ from, to: { row, col } });
                else if (!target.hidden && target.side !== piece.side)
                    moves.push({ from, to: { row, col }, capture: target });
            });
        }
        return moves;
    }
    allMoves(side) {
        const originalTurn = this.turn;
        this.turn = side;
        const moves = this.board.flat().filter((p) => Boolean(p && !p.hidden && p.side === side)).flatMap((p) => this.legalMovesFor(p));
        this.turn = originalTurn;
        return moves;
    }
    reveal(row, col) {
        const target = this.get(row, col);
        if (!target || !target.hidden || this.winner)
            return false;
        target.hidden = false;
        if (!this.humanSide) {
            this.humanSide = target.side;
            this.turn = target.side;
        }
        else {
            this.turn = otherSide(this.turn ?? this.humanSide);
        }
        const entry = { text: `翻開 · ${PIECE_LABELS[target.side][target.type]}`, side: target.side, kind: "flip" };
        this.history = [entry, ...this.history].slice(0, 8);
        this.moveLog = [...this.moveLog, entry];
        this.moveCount += 1;
        return true;
    }
    applyMove(move) {
        const moving = this.get(move.from.row, move.from.col);
        if (!moving || moving.hidden || moving.side !== this.turn || !this.legalMovesFor(moving).some((m) => m.to.row === move.to.row && m.to.col === move.to.col))
            return false;
        const captured = this.get(move.to.row, move.to.col);
        this.board[move.from.row][move.from.col] = null;
        this.board[move.to.row][move.to.col] = { ...moving, row: move.to.row, col: move.to.col };
        const entry = { text: `${PIECE_LABELS[moving.side][moving.type]} ${captured ? `吃${PIECE_LABELS[captured.side][captured.type]}` : "移動"}`, side: moving.side, kind: captured ? "capture" : "move" };
        this.history = [entry, ...this.history].slice(0, 8);
        this.moveLog = [...this.moveLog, entry];
        this.moveCount += 1;
        this.turn = otherSide(moving.side);
        const remaining = this.board.flat().filter(Boolean);
        if (!remaining.some((p) => p.side !== moving.side) || this.allMoves(this.turn).length === 0 && !remaining.some((p) => p.hidden))
            this.winner = moving.side;
        return true;
    }
    clone() {
        const next = Object.create(DarkChessGame.prototype);
        next.board = this.board.map((row) => row.map((p) => (p ? clonePiece(p) : null)));
        next.turn = this.turn;
        next.humanSide = this.humanSide;
        next.winner = this.winner;
        next.history = [...this.history];
        next.moveCount = this.moveCount;
        next.moveLog = [...this.moveLog];
        next.selected = this.selected ? { ...this.selected } : null;
        next.variant = this.variant;
        return next;
    }
}
function positionalBonus(piece) {
    const center = 4 - Math.abs(4 - piece.col);
    const forward = piece.side === "red" ? 9 - piece.row : piece.row;
    return center * 3 + forward * 1.5;
}
export function evaluateXiangqi(game, perspective) {
    if (game.winner === perspective)
        return 999999;
    if (game.winner === otherSide(perspective))
        return -999999;
    return game.board.flat().reduce((score, p) => {
        if (!p)
            return score;
        const value = PIECE_VALUES[p.type] + positionalBonus(p);
        return score + (p.side === perspective ? value : -value);
    }, 0);
}
export function chooseXiangqiMove(game, difficulty, side, budgetMs = 350) {
    const deadline = Date.now() + Math.max(35, budgetMs);
    const depth = ({ beginner: 1, casual: 1, club: 2, advanced: 3, master: 4 })[difficulty] ?? 2;
    const ordered = game.allLegalMoves(side).sort((a, b) => {
        const captureDelta = (b.capture ? PIECE_VALUES[b.capture.type] : 0) - (a.capture ? PIECE_VALUES[a.capture.type] : 0);
        return captureDelta;
    });
    if (!ordered.length)
        return null;
    if (difficulty === "beginner") {
        const pool = ordered.slice(0, Math.min(12, ordered.length));
        if (Math.random() < 0.48) return ordered[Math.floor(Math.random() * ordered.length)];
        return pool[Math.floor(Math.random() * pool.length)];
    }
    if (difficulty === "casual") {
        const pool = ordered.slice(0, Math.min(10, ordered.length));
        if (Math.random() < 0.24) return ordered[Math.floor(Math.random() * ordered.length)];
        return pool[Math.floor(Math.random() * pool.length)];
    }
    const candidateLimit = ({ club: 22, advanced: 28, master: 34 })[difficulty] ?? 18;
    let best = ordered[0];
    let bestScore = -Infinity;
    for (const move of ordered.slice(0, candidateLimit)) {
        if (Date.now() >= deadline)
            break;
        const next = game.clone();
        next.applyMove(move);
        const score = minimax(next, depth - 1, -Infinity, Infinity, side, deadline);
        if (score > bestScore) {
            bestScore = score;
            best = move;
        }
    }
    return best;
}
function minimax(game, depth, alpha, beta, perspective, deadline) {
    if (Date.now() >= deadline)
        return evaluateXiangqi(game, perspective);
    if (depth <= 0 || game.winner)
        return evaluateXiangqi(game, perspective);
    const maximizing = game.turn === perspective;
    const moves = game.allLegalMoves(game.turn).sort((a, b) => (b.capture ? PIECE_VALUES[b.capture.type] : 0) - (a.capture ? PIECE_VALUES[a.capture.type] : 0)).slice(0, 40);
    if (!moves.length)
        return evaluateXiangqi(game, perspective);
    let value = maximizing ? -Infinity : Infinity;
    for (const move of moves) {
        if (Date.now() >= deadline)
            break;
        const next = game.clone();
        next.applyMove(move);
        const score = minimax(next, depth - 1, alpha, beta, perspective, deadline);
        if (maximizing) {
            value = Math.max(value, score);
            alpha = Math.max(alpha, value);
        }
        else {
            value = Math.min(value, score);
            beta = Math.min(beta, value);
        }
        if (beta <= alpha)
            break;
    }
    return value;
}
function darkMoveScore(game, move, side, difficulty) {
    const next = game.clone();
    if (!next.applyMove(move)) return -Infinity;
    if (next.winner === side) return 1000000;
    if (next.winner === otherSide(side)) return -1000000;
    const captureValue = move.capture ? PIECE_VALUES[move.capture.type] : 0;
    const opponent = otherSide(side);
    const opponentMoves = next.allMoves(opponent);
    const opponentCaptures = opponentMoves.filter((m) => m.capture);
    const attacksOntoMovedPiece = opponentCaptures.filter((m) => m.to.row === move.to.row && m.to.col === move.to.col).length;
    const myCaptures = next.allMoves(side).filter((m) => m.capture).length;
    const mobility = opponentMoves.length;
    const escapeSquares = next.allMoves(side).length;
    const centrality = 3 - Math.abs(3.5 - move.to.col) / 2;
    const hiddenRisk = next.board.flat().filter((p) => p?.hidden).length;
    const captureWeight = ({ beginner: 4.2, casual: 4.8, club: 5.6, advanced: 6.8, master: 8.2 })[difficulty] ?? 5.6;
    const safetyWeight = ({ beginner: 4.0, casual: 5.0, club: 6.2, advanced: 8.0, master: 10.0 })[difficulty] ?? 6.2;
    const slantBonus = game.variant === "slant-rush" && (move.capture || Math.abs(move.to.col - move.from.col) + Math.abs(move.to.row - move.from.row) > 1) ? 22 : 0;
    const immediateDanger = attacksOntoMovedPiece * 110;
    return captureValue * captureWeight + myCaptures * 6 + escapeSquares * 2.6 + centrality * 8 + slantBonus - mobility * 2.1 - opponentCaptures.length * safetyWeight - immediateDanger - hiddenRisk * 0.28;
}

export function chooseDarkMove(game, difficulty, side) {
    const moves = game.allMoves(side);
    if (!moves.length) return null;
    const ordered = moves.map((move) => ({ move, score: darkMoveScore(game, move, side, difficulty) })).sort((a, b) => b.score - a.score);
    const captures = ordered.filter((entry) => entry.move.capture);
    // 所有等級只要有合法吃子，就先處理吃子；避免「只翻不吃」。
    if (captures.length) {
        if (difficulty === "beginner") return captures[Math.floor(Math.random() * Math.min(3, captures.length))].move;
        if (difficulty === "casual") return captures[Math.floor(Math.random() * Math.min(2, captures.length))].move;
        return captures[0].move;
    }
    if (difficulty === "beginner") return ordered[Math.floor(Math.random() * Math.min(8, ordered.length))].move;
    if (difficulty === "casual") return ordered[Math.floor(Math.random() * Math.min(4, ordered.length))].move;
    if (difficulty === "club") return ordered[Math.floor(Math.random() * Math.min(2, ordered.length))].move;
    const lookahead = difficulty === "master" ? 18 : 12;
    let best = ordered[0];
    let bestScore = -Infinity;
    for (const candidate of ordered.slice(0, lookahead)) {
        const next = game.clone();
        if (!next.applyMove(candidate.move)) continue;
        const replies = next.allMoves(otherSide(side));
        let worst = Infinity;
        for (const reply of replies.slice(0, difficulty === "master" ? 22 : 14)) {
            const replyScore = darkMoveScore(next, reply, otherSide(side), difficulty);
            worst = Math.min(worst, -replyScore);
        }
        const total = candidate.score + (Number.isFinite(worst) ? worst * (difficulty === "master" ? 0.5 : 0.34) : 0);
        if (total > bestScore) { bestScore = total; best = candidate; }
    }
    return best.move;
}
export function chooseDarkReveal(game) {
    const hidden = game.board.flat().filter((p) => Boolean(p?.hidden));
    if (!hidden.length)
        return null;
    const scored = hidden.map((piece) => {
        const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dr, dc]) => inside(piece.row + dr, piece.col + dc, 4, 8));
        const knownNeighbours = neighbours.filter(([dr, dc]) => Boolean(game.get(piece.row + dr, piece.col + dc) && !game.get(piece.row + dr, piece.col + dc)?.hidden)).length;
        const centerBonus = 3 - Math.abs(3.5 - piece.col) / 2;
        return { piece, score: centerBonus * 3 + knownNeighbours * 4 + (piece.row === 0 || piece.row === 3 ? 1 : 0) };
    }).sort((a, b) => b.score - a.score);
    return scored[Math.floor(Math.random() * Math.min(4, scored.length))].piece;
}
function positionWinrate(raw) {
    return clamp(Math.round(50 + 45 / (1 + Math.exp(-raw / 180)) - 22.5), 5, 95);
}
function xiangqiMaterial(game, side) {
    return game.board.flat().reduce((total, piece) => {
        if (!piece || piece.side !== side)
            return total;
        return total + PIECE_VALUES[piece.type];
    }, 0);
}
export function estimateXiangqiPosition(game, perspective = "red") {
    if (game.winner) {
        const red = game.winner === "red" ? 99 : 1;
        return {
            red,
            black: 100 - red,
            confidence: 99,
            summary: game.winner === perspective ? "已鎖定勝局" : "局面已經失守",
            threat: `${game.winner === "red" ? "紅方" : "黑方"}已經取得勝利。`,
            commentary: game.winner === perspective ? "關鍵交換完成，勝勢已經轉化為實際戰果。" : "王區安全與子力差距已無法挽回，棋局進入收官。",
        };
    }
    const redMoves = game.allLegalMoves("red").length;
    const blackMoves = game.allLegalMoves("black").length;
    const redMaterial = xiangqiMaterial(game, "red");
    const blackMaterial = xiangqiMaterial(game, "black");
    const materialDelta = redMaterial - blackMaterial;
    const activityDelta = (redMoves - blackMoves) * 9;
    const redChecked = game.isInCheck("red") ? -55 : 0;
    const blackChecked = game.isInCheck("black") ? 55 : 0;
    const raw = materialDelta / 12 + activityDelta + redChecked + blackChecked;
    const red = positionWinrate(raw);
    const confidence = clamp(Math.round(56 + Math.min(30, game.moveCount * 0.75)), 56, 86);
    const perspectiveProbability = perspective === "red" ? red : 100 - red;
    const summary = perspectiveProbability >= 65 ? "你方握有明顯優勢" : perspectiveProbability <= 35 ? "需要積極找出反擊" : "雙方仍在均勢拉鋸";
    const side = game.turn;
    const checkingThreat = game.isInCheck(side);
    const opponent = otherSide(side);
    const captures = game.allLegalMoves(side).filter((move) => Boolean(move.capture)).length;
    const threat = checkingThreat
        ? `${side === "red" ? "紅方" : "黑方"}正在被將軍，必須先處理王區安全。`
        : captures > 0
            ? `${side === "red" ? "紅方" : "黑方"}目前有 ${captures} 個直接吃子機會。`
            : `${opponent === "red" ? "紅方" : "黑方"}尚未形成立即的攻殺威脅。`;
    const commentary = checkingThreat
        ? "先解將再談進攻；王區安全優先於搶吃一子。"
        : red > 65
            ? "紅方子力與活動度都較好，現在適合把優勢轉成中央或九宮的壓力。"
            : red < 35
                ? "黑方掌握較多主動權，紅方應避免無謂交換，先改善最被動的棋子。"
                : "局面尚未拉開，先提升子力協調，再等待對手暴露弱點。";
    return { red, black: 100 - red, confidence, summary, threat, commentary };
}
function variationHash(parts) {
    const text = parts.filter((part) => part !== undefined && part !== null).join("|");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
function pickVariation(options, signature) {
    if (!options.length)
        return "";
    return options[variationHash([signature]) % options.length];
}
function recentHistorySignature(game) {
    return game.history?.slice(-6).map((entry) => entry.text).join("~") ?? "";
}
export function getXiangqiCommentary(game, perspective = "red") {
    const signature = `xiangqi:${game.moveCount}:${game.turn}:${game.winner}:${recentHistorySignature(game)}`;
    if (game.winner) {
        const won = game.winner === perspective;
        return {
            headline: pickVariation(won ? ["漂亮收官", "完成收官", "攻防落幕", "關鍵一勝"] : ["棋局結束", "最後一擊", "局勢已定", "攻防落幕"], signature),
            detail: pickVariation(won
                ? ["把前面的優勢順利轉成勝局。", "關鍵交換處理得很乾淨，最後沒有給對手留下翻盤空間。", "從中盤累積的壓力一路延續到收官，節奏控制得很完整。", "重要區域守住後再轉入攻擊，最後一段收得很俐落。"]
                : ["對手完成最後的攻殺，棋局就此結束。", "最後階段的王區壓力已經形成，局面沒有再留下有效回應。", "攻防進入收尾，對手把最後的機會轉成了結果。", "最後的防線被突破後，棋局很快進入收官。"], signature + ":detail"),
            advice: pickVariation(won
                ? ["下一局可以回看中盤的關鍵交換，找出最早建立優勢的那一手。", "把最後三到五手倒帶一次，看看哪些決定讓勝勢真正固定下來。", "下一局試著更早辨認強制手，讓優勢不要拖到最後才兌現。"]
                : ["下一局可以先回看中盤轉折，找出對手第一次取得主動權的位置。", "把最後幾手倒帶一次，通常能找到王區安全或交換順序的問題。", "下一局先把防守優先級排好，再決定什麼時候進入交換。"], signature + ":advice")
        };
    }
    const side = game.turn;
    const legal = game.allLegalMoves(side);
    const captures = legal.filter((move) => Boolean(move.capture)).length;
    if (game.isInCheck(side)) {
        return {
            headline: pickVariation(["先解將", "王區警報", "先守再攻", "將軍優先"], signature),
            detail: pickVariation([
                `${side === "red" ? "紅方" : "黑方"}王區正在受威脅，現在的第一順位是解除將軍。`,
                `${side === "red" ? "紅方" : "黑方"}必須先處理王區，其他漂亮手段都得往後排。`,
                `目前最直接的問題不是搶子，而是${side === "red" ? "紅方" : "黑方"}的王安全。`,
                `將軍把局面變成了強制題，先找到合法的解將手再談反擊。`
            ], signature + ":detail"),
            advice: pickVariation(["先找所有解將手，再比較哪一個能保留反擊。", "不要被眼前吃子吸引；先把王區脫離強制線。", "若有多個解將手，優先選能同時改善子力位置的那一步。"], signature + ":advice")
        };
    }
    if (captures >= 3) {
        return {
            headline: pickVariation(["戰術窗口", "吃子分岔", "交換時刻", "先算再吃"], signature),
            detail: pickVariation([
                `現在有 ${captures} 個吃子機會，真正的重點是順序，不是數量。`,
                `棋盤上的吃子選項突然增加，至少有兩種交換方向值得比較。`,
                `目前戰術密度偏高，先算清楚吃完之後誰掌握下一手。`,
                `多個吃子同時出現，這通常是決定局面走向的時刻。`
            ], signature + ":detail"),
            advice: pickVariation(["比較吃子後的王安全、子力活動和下一手反擊。", "先看最強制的吃法，再檢查是否會讓自己的要子被反吃。", "不要只看眼前價值，至少往後想一個完整回合。"], signature + ":advice")
        };
    }
    if (legal.length <= 8) {
        return {
            headline: pickVariation(["局面收緊", "選擇變少", "窄路找手", "先找活路"], signature),
            detail: pickVariation([
                "可行步數不多，現在每一步都比平常更有重量。",
                "盤面開始收緊，單純搶一子未必是最重要的事。",
                "選擇空間變小了，最好先找能改善兩個棋子協調的位置。",
                "這是比較典型的窄路局面，先處理最被動的棋子會比較安全。"
            ], signature + ":detail"),
            advice: pickVariation(["找能同時改善兩個棋子的步法。", "優先增加下一手選擇，不要把自己逼進單一路線。", "如果沒有強制手，先把最差的棋子改善掉。"], signature + ":advice")
        };
    }
    return {
        headline: pickVariation(["穩住陣形", "慢慢加壓", "布局累積", "等對手露口"], signature),
        detail: pickVariation([
            "目前沒有立即的強制手，適合先改善子力位置。",
            "局面還沒真正拉開，現在的細節會決定之後的攻勢方向。",
            "攻防仍有彈性，先把活動度與協調性做起來會比較自然。",
            "暫時沒有需要立刻處理的危機，可以把注意力放在下一個戰術窗口。"
        ], signature + ":detail"),
        advice: pickVariation(["發展馬炮、控制中央，再準備下一輪攻勢。", "把最沒效率的子往更活躍的位置調整。", "先改善協調，再等待對手留下可利用的弱點。"], signature + ":advice")
    };
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function darkMaterial(game, side) {
    return game.board.flat().reduce((total, piece) => {
        if (!piece || piece.side !== side)
            return total;
        return total + (piece.hidden ? 320 : PIECE_VALUES[piece.type]);
    }, 0);
}
export function estimateDarkPosition(game, perspective = "red") {
    const redMoves = game.allMoves("red").length;
    const blackMoves = game.allMoves("black").length;
    const visiblePieces = game.board.flat().filter((piece) => piece && !piece.hidden).length;
    const captured = 32 - game.board.flat().filter(Boolean).length;
    const redMaterial = darkMaterial(game, "red");
    const blackMaterial = darkMaterial(game, "black");
    const materialDelta = redMaterial - blackMaterial;
    const activityDelta = (redMoves - blackMoves) * 16;
    const tempo = game.turn === "red" ? 24 : game.turn === "black" ? -24 : 0;
    const raw = materialDelta / 14 + activityDelta + tempo;
    const red = clamp(Math.round(50 + 42 / (1 + Math.exp(-raw / 180)) - 21), 5, 95);
    const confidence = clamp(Math.round(28 + visiblePieces * 2.6 + captured * 4), 28, 88);
    const perspectiveProbability = perspective === "red" ? red : 100 - red;
    const summary = perspectiveProbability >= 60 ? "局面偏向你" : perspectiveProbability <= 40 ? "需要尋找突破" : "雙方仍在拉鋸";
    const side = game.turn ?? perspective;
    const captures = game.allMoves(side).filter((move) => Boolean(move.capture)).length;
    const threat = captures > 0 ? `${side === "red" ? "紅方" : "黑方"}有 ${captures} 個吃子機會` : game.board.flat().some((piece) => piece?.hidden) ? "未知棋子仍可能改變局勢" : "目前沒有立即吃子威脅";
    return { red, black: 100 - red, confidence, summary, threat };
}
export function getDarkCommentary(game, perspective = "red") {
    const signature = `dark:${game.variant}:${game.moveCount}:${game.turn}:${game.humanSide}:${game.winner}:${recentHistorySignature(game)}`;
    if (game.winner) {
        const won = game.winner === perspective;
        return {
            headline: pickVariation(won ? ["情報戰收官", "翻棋收尾", "讀局成功", "暗棋定局"] : ["局勢逆轉", "情報失守", "最後翻盤", "暗棋落幕"], signature),
            detail: pickVariation(won
                ? ["已知棋力、翻棋情報與取捨判斷成功串成一條勝勢。", "關鍵情報出現後沒有急著亂換，最後把優勢完整兌現。", "你掌握了盤面資訊的節奏，讓對手的未知風險越來越難發揮。", "從翻棋到交換都處理得有條理，最後把可見優勢轉成勝局。"]
                : ["對手抓住了最後的情報窗口，把局勢快速轉成結果。", "未知資訊在最後階段形成了連鎖反應，對手先一步完成關鍵交換。", "最後一段交換沒有守住資訊優勢，對手因此取得決定性的主動權。", "局面進入關鍵區後，對手的情報判讀比你早半拍。"], signature + ":detail"),
            advice: pickVariation(won
                ? ["下一局回看第一次翻棋與第一次交換，通常最能看出優勢從哪裡開始。", "下一局可以比較『先翻情報』和『先搶位置』兩種節奏。", "試著記錄對手第一批已知棋，會更容易找出後續交換。"]
                : ["下一局先回看第一次翻棋與第一個高價值交換，找出資訊差最大的時刻。", "面對未知區域時先保留退路，再決定是否投入高價值棋。", "把最後的交換順序倒帶一次，通常能找到真正的翻盤點。"], signature + ":advice")
        };
    }
    if (!game.humanSide) {
        return {
            headline: pickVariation(["先建立情報", "第一張情報牌", "先看局勢", "開局先觀察"], signature),
            detail: pickVariation([
                "第一枚翻棋會決定你的陣營，也會改變接下來的判斷方向。",
                "現在資訊最少，第一枚翻棋的價值不只在棋力，也在於它揭露了什麼。",
                "還沒確定陣營前，先把第一張資訊看清楚比預測結果更重要。"
            ], signature + ":detail"),
            advice: pickVariation(["先看周圍已知棋，不急著追求一次翻出高價值棋。", "記住第一枚翻出的棋與位置，之後判斷會更有依據。", "先建立安全資訊區，再決定下一步要不要冒險。"], signature + ":advice")
        };
    }
    const side = game.turn ?? perspective;
    const moves = game.allMoves(side);
    const captures = moves.filter((move) => Boolean(move.capture)).length;
    const hiddenCount = game.board.flat().filter((piece) => piece?.hidden).length;
    if (captures >= 2) {
        const slant = game.variant === "slant-rush";
        return {
            headline: pickVariation(["吃子窗口出現", "交換分岔", "這手有得算", slant ? "車馬開火" : "先比交換"], signature),
            detail: pickVariation([
                `${side === "red" ? "紅方" : "黑方"}現在有 ${captures} 個可吃子機會，重點是比較交換後的局面。`,
                `吃子選項變多了，先確認哪一個交換最不容易留下反擊。`,
                `現在的棋力差距未必決定一切，資訊順序與下一手回應更值得注意。`,
            ], signature + ":detail"),
            advice: pickVariation(slant
                ? ["比較一般吃子與車衝／斜馬的後續，不要只看眼前多一子。", "車衝要先算阻擋與回頭路；斜馬則要留意斜線反擊。", "強化規則讓交換更快，先算下一輪再下手。"]
                : ["先確認大小關係與炮架，再決定是否交換。", "不要只看吃到誰，還要看對手下一手能不能反吃。", "高價值已知棋先保護好，再選擇能改善位置的交換。"], signature + ":advice")
        };
    }
    if (hiddenCount >= 8) {
        return {
            headline: pickVariation(["情報仍是關鍵", "未知區很多", "先補情報", "霧區太厚"], signature),
            detail: pickVariation([
                `棋盤還有 ${hiddenCount} 枚未知棋，現在的風險主要來自資訊不足。`,
                `未知棋仍占很大比例，單看已知棋力容易高估自己的優勢。`,
                `盤面情報還不完整，安全的翻棋順序比單純追求高價值更重要。`
            ], signature + ":detail"),
            advice: pickVariation(["優先建立安全的已知區，避免把高價值棋送進未知火力。", "翻棋前先看鄰近位置能不能提供更多情報。", "盡量讓每次翻棋都同時帶來位置或交換上的資訊。"], signature + ":advice")
        };
    }
    if (moves.length <= 3) {
        return {
            headline: pickVariation(["活動空間偏少", "可走步數告急", "先找活路", "位置比吃子重要"], signature),
            detail: pickVariation([
                "當前可行步數有限，位置本身比單一吃子更重要。",
                "活動空間開始縮小，下一步最好想辦法打開新的路線。",
                "能走的方向不多，先提升機動性會比硬碰硬更穩。"
            ], signature + ":detail"),
            advice: pickVariation(["先尋找能增加下一手選擇的走法。", "不要急著換子，先確認自己的出口。", "把最受限制的棋移到更有彈性的格子。"], signature + ":advice")
        };
    }
    const slant = game.variant === "slant-rush";
    return {
        headline: pickVariation(slant ? ["車馬正在拉扯", "衝鋒前的空檔", "車馬找線", "斜馬伺機"] : ["穩住已知優勢", "資訊換空間", "慢慢擴大已知", "先守後攻"], signature),
        detail: pickVariation(slant
            ? ["強化車馬讓局面節奏更快，交換前要先看下一輪衝刺。", "直線與斜線都變得更有威脅，現在適合先找突破路徑。", "車馬的機動性正在放大局面變化，空一拍就可能換邊。"]
            : ["已知棋力與未知資訊仍在互相影響，現在適合先整理自己的資訊區。", "局面還有很多彈性，保護已知高價值棋比追一個小吃子更穩。", "資訊逐漸增加，現在可以開始把已知優勢轉成位置優勢。"], signature + ":detail"),
        advice: pickVariation(slant
            ? ["車留意遠距離衝子，馬斜吃則注意反擊空間。", "先找車能穿透的線，再判斷斜馬是否有同步戰術。", "不要只算第一段衝刺，至少先看對手的回擊位置。"]
            : ["保護高價值已知棋，炮則留意炮架位置。", "把已知棋組成互相支援的區域，再找交換點。", "先讓資訊變成控制力，再考慮冒險交換。"], signature + ":advice")
    };
}
export function describeDifficulty(difficulty) {
    return ({ beginner: "入門", casual: "休閒", club: "棋友", advanced: "高手", master: "大師" })[difficulty] ?? "棋友";
}
export function formatPieceName(piece) {
    return piece ? `${piece.side === "red" ? "紅" : "黑"}${PIECE_NAMES[piece.type]}` : "空位";
}

export function moveText(game, move) {
    const moving = game.get(move.from.row, move.from.col);
    if (!moving) return "未知走法";
    const target = move.capture ? `吃${PIECE_LABELS[move.capture.side][move.capture.type]}` : "";
    return `${PIECE_LABELS[moving.side][moving.type]} ${String.fromCharCode(19968 + move.from.col)}${10 - move.from.row} → ${String.fromCharCode(19968 + move.to.col)}${10 - move.to.row}${target ? ` · ${target}` : ""}`;
}

export function describeWinrateDelta(before, after, perspective = "red") {
    const b = perspective === "red" ? before.red : before.black;
    const a = perspective === "red" ? after.red : after.black;
    return Math.round(a - b);
}
