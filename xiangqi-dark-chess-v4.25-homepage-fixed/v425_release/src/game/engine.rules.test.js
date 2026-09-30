import { describe, expect, it } from "vitest";
import { DarkChessGame, XiangqiGame } from "./engine.js";
const types = ["king", "advisor", "elephant", "rook", "horse", "cannon", "pawn"];
const rank = {
    king: 7, advisor: 6, elephant: 5, rook: 4, horse: 3, cannon: 2, pawn: 1,
};
function makePiece(type, side, row, col) {
    return { id: `${side}-${type}-${row}-${col}`, side, type, row, col, hidden: false };
}
function blankGame(variant = "standard") {
    const game = new DarkChessGame(variant);
    game.board = Array.from({ length: 4 }, () => Array(8).fill(null));
    game.turn = "red";
    game.humanSide = "red";
    game.winner = null;
    game.history = [];
    game.selected = null;
    return game;
}
function hasCapture(game, from, to) {
    const piece = game.get(from.row, from.col);
    return game.legalMovesFor(piece).some((move) => move.to.row === to.row && move.to.col === to.col && Boolean(move.capture));
}
function expectedRankCapture(attacker, defender) {
    if (attacker === "cannon")
        return null;
    if (attacker === "pawn" && defender === "king")
        return true;
    if (attacker === "king" && defender === "pawn")
        return false;
    return rank[attacker] >= rank[defender];
}
describe("暗棋基本吃子規則", () => {
    it("遵循將＞士＞象＞車＞馬＞炮＞卒，並保留兵吃將特例", () => {
        for (const attacker of types) {
            for (const defender of types) {
                const game = blankGame();
                game.board[1][1] = makePiece(attacker, "red", 1, 1);
                game.board[1][2] = makePiece(defender, "black", 1, 2);
                expect(hasCapture(game, { row: 1, col: 1 }, { row: 1, col: 2 })).toBe(expectedRankCapture(attacker, defender));
            }
        }
    });
    it("炮不能直接吃相鄰棋，但可隔一子吃任意已翻開敵子", () => {
        const adjacent = blankGame();
        adjacent.board[1][1] = makePiece("cannon", "red", 1, 1);
        adjacent.board[1][2] = makePiece("king", "black", 1, 2);
        expect(hasCapture(adjacent, { row: 1, col: 1 }, { row: 1, col: 2 })).toBe(false);
        const jump = blankGame();
        jump.board[1][1] = makePiece("cannon", "red", 1, 1);
        jump.board[1][2] = makePiece("rook", "black", 1, 2);
        jump.board[1][3] = makePiece("king", "black", 1, 3);
        expect(hasCapture(jump, { row: 1, col: 1 }, { row: 1, col: 3 })).toBe(true);
        const blocked = blankGame();
        blocked.board[1][1] = makePiece("cannon", "red", 1, 1);
        blocked.board[1][2] = makePiece("rook", "black", 1, 2);
        blocked.board[1][3] = makePiece("advisor", "black", 1, 3);
        blocked.board[1][4] = makePiece("king", "black", 1, 4);
        expect(hasCapture(blocked, { row: 1, col: 1 }, { row: 1, col: 4 })).toBe(false);
    });
});
describe("斜馬衝車模式", () => {
    it("車可走任意空格，遠距離隔空吃子不看大小，貼身仍看大小", () => {
        const game = blankGame("slant-rush");
        game.board[1][1] = makePiece("rook", "red", 1, 1);
        game.board[1][4] = makePiece("king", "black", 1, 4);
        expect(game.legalMovesFor(game.get(1, 1)).some((move) => move.to.row === 1 && move.to.col === 2)).toBe(true);
        expect(game.legalMovesFor(game.get(1, 1)).some((move) => move.to.row === 1 && move.to.col === 3)).toBe(true);
        expect(hasCapture(game, { row: 1, col: 1 }, { row: 1, col: 4 })).toBe(true);
        const adjacent = blankGame("slant-rush");
        adjacent.board[1][1] = makePiece("rook", "red", 1, 1);
        adjacent.board[1][2] = makePiece("king", "black", 1, 2);
        expect(hasCapture(adjacent, { row: 1, col: 1 }, { row: 1, col: 2 })).toBe(false);
    });
    it("馬可斜走一格，斜吃時無視大小", () => {
        const empty = blankGame("slant-rush");
        empty.board[1][1] = makePiece("horse", "red", 1, 1);
        expect(empty.legalMovesFor(empty.get(1, 1)).some((move) => move.to.row === 2 && move.to.col === 2)).toBe(true);
        const capture = blankGame("slant-rush");
        capture.board[1][1] = makePiece("horse", "red", 1, 1);
        capture.board[2][2] = makePiece("king", "black", 2, 2);
        expect(hasCapture(capture, { row: 1, col: 1 }, { row: 2, col: 2 })).toBe(true);
    });
});
describe("手數統計", () => {
    it("象棋每次合法落子會累計 moveCount，非法落子不累計，重開局會歸零，clone 會保留", () => {
        const game = new XiangqiGame();
        const pawn = game.get(6, 0);
        const invalidMove = { from: { row: 6, col: 0 }, to: { row: 4, col: 0 } };
        expect(game.applyMove(invalidMove)).toBe(false);
        expect(game.moveCount).toBe(0);
        const move = game.legalMovesFor(pawn).find((candidate) => candidate.to.row === 5 && candidate.to.col === 0);
        expect(game.applyMove(move)).toBe(true);
        expect(game.moveCount).toBe(1);
        expect(game.clone().moveCount).toBe(1);
        game.reset();
        expect(game.moveCount).toBe(0);
    });
    it("暗棋翻棋與移動都算一手，clone 會保留且重開局歸零", () => {
        const game = blankGame();
        game.board = Array.from({ length: 4 }, () => Array(8).fill(null));
        game.board[0][0] = makePiece("pawn", "red", 0, 0);
        game.board[0][1] = makePiece("pawn", "black", 0, 1);
        game.board[0][0].hidden = true;
        game.board[0][1].hidden = true;
        game.turn = null;
        game.humanSide = null;
        expect(game.reveal(0, 0)).toBe(true);
        expect(game.moveCount).toBe(1);
        expect(game.clone().moveCount).toBe(1);
        expect(game.reveal(0, 1)).toBe(true);
        expect(game.moveCount).toBe(2);
        game.reset();
        expect(game.moveCount).toBe(0);
    });
});
