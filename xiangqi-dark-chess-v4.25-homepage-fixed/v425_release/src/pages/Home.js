import { createElement as h, useCallback, useEffect, useMemo, useRef, useState } from "../react-shim.js";
import { BarChart3, CircleHelp, ChevronLeft, ChevronRight, Crown, Eye, EyeOff, Gauge, History, Lightbulb, Mic2, Play, RotateCcw, Settings2, Sparkles, Swords, Volume2, VolumeX } from "../icons.js";
import {
  chooseDarkMove,
  chooseDarkReveal,
  chooseXiangqiMove,
  describeDifficulty,
  DarkChessGame,
  estimateDarkPosition,
  estimateXiangqiPosition,
  getDarkCommentary,
  getXiangqiCommentary,
  moveText,
  describeWinrateDelta,
  PIECE_LABELS,
  PIECE_VALUES,
  XiangqiGame,
} from "../game/engine.js";

const difficultyOptions = [
  { value: "beginner", label: "入門", detail: "基本判斷 · 保留隨機性", glyph: "01" },
  { value: "casual", label: "休閒", detail: "簡單搜尋 · 基本吃子", glyph: "02" },
  { value: "club", label: "棋友", detail: "平衡搜尋 · 基本戰術", glyph: "03" },
  { value: "advanced", label: "高手", detail: "較深搜尋 · 重視反擊", glyph: "04" },
  { value: "master", label: "大師", detail: "深度搜尋 · 重視安全", glyph: "05" },
];
const thinkingSpeedOptions = [
  { value: "instant", label: "即時", detail: "幾乎不等待" },
  { value: "fast", label: "快速", detail: "推薦節奏" },
  { value: "standard", label: "標準", detail: "平衡思考" },
  { value: "deep", label: "深思", detail: "多留時間" },
];

function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function generatedText(options, signature) {
  if (!options?.length) return "";
  return options[hashText(signature) % options.length];
}
function safeTrendLoad() {
  try {
    return JSON.parse(localStorage.getItem("qi-ju-player-trend") ?? "[]");
  } catch {
    return [];
  }
}
function turnText(game, mode) {
  if (game.winner) return `${game.winner === "red" ? "紅方" : "黑方"}勝出`;
  if (mode === "xiangqi") return game.turn === "red" ? "輪到紅方" : "輪到黑方";
  if (!game.humanSide) return "先翻一枚棋子";
  return game.turn === game.humanSide ? "你的回合" : "AI 回合";
}
function PieceGlyph({ piece }) {
  if (!piece) return null;
  if (piece.hidden) {
    return h("span", { className: "piece-back" }, h("span", { className: "piece-back-mark" }, "棋"));
  }
  return h("span", { className: `piece-glyph ${piece.side}` }, h("span", { className: "piece-glyph-char" }, PIECE_LABELS[piece.side][piece.type]));
}
function MiniReplayBoard({ game, mode }) {
  if (!game) return null;
  return h(
    "div",
    { className: `replay-board ${mode === "dark" ? "replay-dark" : "replay-xiangqi"}` },
    game.board.map((row, r) => row.map((piece, c) => h(
      "div",
      { className: "replay-cell", key: `${r}-${c}` },
      piece ? h(PieceGlyph, { piece }) : h("span", { className: "replay-empty" }, "·"),
      mode === "xiangqi" && r === 4 && c === 4 ? h("span", { className: "replay-river-mark" }, "楚河") : null,
      mode === "xiangqi" && r === 5 && c === 4 ? h("span", { className: "replay-river-mark" }, "漢界") : null,
    )))
  );
}
function buildMoveAnalysis(before, after, mode, side, move, difficulty) {
  const beforeAssessment = mode === "xiangqi" ? estimateXiangqiPosition(before, side) : estimateDarkPosition(before, side);
  const afterAssessment = mode === "xiangqi" ? estimateXiangqiPosition(after, side) : estimateDarkPosition(after, side);
  const delta = describeWinrateDelta(beforeAssessment, afterAssessment, side);
  let alternative = mode === "xiangqi"
    ? chooseXiangqiMove(before, difficulty === "casual" ? "club" : "master", side, 75)
    : chooseDarkMove(before, difficulty === "casual" ? "club" : difficulty, side);
  const sameMove = alternative && move && alternative.from?.row === move.from?.row && alternative.from?.col === move.from?.col && alternative.to?.row === move.to?.row && alternative.to?.col === move.to?.col;
  if (sameMove) {
    const candidates = mode === "xiangqi" ? before.allLegalMoves(side) : before.allMoves(side);
    alternative = candidates.find((candidate) => candidate.from?.row !== move.from?.row || candidate.from?.col !== move.from?.col || candidate.to?.row !== move.to?.row || candidate.to?.col !== move.to?.col) ?? alternative;
  }
  const reason = mode === "xiangqi"
    ? (delta >= 5
      ? "這步提升了你的主動權，模型看到的攻守平衡有明顯改善。"
      : delta <= -5
        ? "這步讓對手得到較大的回應空間，王區與交換順序值得重新考慮。"
        : "這步影響有限，真正關鍵會落在下一個交換與子力協調。")
    : (delta >= 5
      ? "這步把已知資訊或機動性轉成優勢，風險正在下降。"
      : delta <= -5
        ? "這步提高了未知風險或交換壓力，對手的反擊窗口變大。"
        : "這步屬於中性調整，下一次翻棋或交換會更關鍵。");
  return {
    label: moveText(before, move),
    before: beforeAssessment[side],
    after: afterAssessment[side],
    delta,
    quality: delta >= 5 ? "優勢擴大" : delta <= -5 ? "需要修正" : "局面平衡",
    reason,
    alternative: alternative ? moveText(before, alternative) : "沒有明顯替代走法",
    confidence: afterAssessment.confidence,
  };
}
function buildFinalReview(mode, variant, winner, playerSide, moveCount, captured, visiblePieces, moveLog) {
  const won = winner === playerSide;
  const signature = `${mode}:${variant}:${winner}:${moveCount}:${captured}:${visiblePieces}:${moveLog.map((m) => m.text).join("~")}`;
  const base = won ? 82 : 48;
  const tempoBonus = Math.min(10, Math.max(0, 12 - Math.floor(moveCount / 3)));
  const captureBonus = Math.min(8, captured * 2);
  const informationBonus = mode === "dark" ? Math.min(8, Math.floor(visiblePieces / 4)) : 0;
  const score = Math.max(20, Math.min(98, base + (won ? tempoBonus + captureBonus + informationBonus : -tempoBonus)));
  const comment = mode === "dark"
    ? won
      ? generatedText([
          "這局把翻棋、資訊與交換節奏串得很順，優勢一步步變得可見。",
          "你掌握了什麼時候翻、什麼時候換，最後把未知風險壓到很低。",
          "亮點是節奏控制：先建立安全資訊區，再把已知棋力變成實際壓力。",
          "這局的關鍵不是單純多吃子，而是知道哪一個情報窗口值得投入。",
        ], `${signature}:win:${score}`)
      : generatedText([
          "這局真正拉開差距的是資訊順序；幾次交換後對手先建立了安全的可見優勢。",
          "未知區的處理讓對手先取得了主動，後段因此比較難把節奏拉回來。",
          "幾個交換點都有回頭路可選，下一局可以更早確認退路與支援關係。",
          "這局的資訊差在中盤被放大，若更早整理已知棋與未知區，防守空間會更大。",
        ], `${signature}:loss:${score}`)
    : won
      ? generatedText([
          "攻守節奏控制得不錯，關鍵交換與王區安全有同時兼顧。",
          "不是只靠搶子，而是先改善子力，再把壓力集中到真正的薄弱點。",
          "你把先手優勢轉成可持續的攻勢，最後收官沒有留下太多反擊空間。",
          "從布局到收官的轉換很順，交換前的取捨也很清楚。",
        ], `${signature}:win:${score}`)
      : generatedText([
          "局面不是一開始就失守，而是幾次交換累積後讓黑方逐漸取得主動。",
          "中盤的王區安全與子力協調出現缺口，後段壓力因此變得連續。",
          "這局最值得回看的是交換順序；幾次小決定疊起來後，對手就取得較舒服的節奏。",
          "後段的攻勢來自子力被拆開，下一局可以更早讓關鍵棋子互相支援。",
        ], `${signature}:loss:${score}`);
  const criticalMistake = mode === "dark"
    ? generatedText([
        "有一次翻棋後直接投入交換，沒有先把新情報轉成位置優勢。",
        "中盤高價值資訊交得稍快，讓對手比較容易判斷你的支援範圍。",
        "第一次大交換前沒有先留退路，後續未知風險因此被放大。",
        "有一步太重視眼前吃子，忽略下一輪翻棋可能帶來的反擊。",
      ], `${signature}:mistake`)
    : generatedText([
        "有一個交換其實可以延後一拍，先完成子力協調會更有延續性。",
        "中盤有一步沒有先處理王區安全，讓對手得到連續先手。",
        "一個被動棋子停留太久，讓對手把兩個主力串成了攻勢。",
        "交換順序稍急，沒有先比較對手最強的下一手回應。",
      ], `${signature}:mistake`);
  const alternative = mode === "dark"
    ? generatedText([
        "先翻開能增加資訊密度的位置，再把已知強子組成互相支援的網。",
        "保留一條退路，等第二個情報點出現後再決定是否換子。",
        "先整理中心已知區，再讓高價值棋進入能被保護的位置。",
        "把翻棋與走棋串在同一個計畫裡，避免單次翻棋只換來風險。",
      ], `${signature}:alternative`)
    : generatedText([
        "先改善最被動的子，再把車炮集中到同一側，通常比急著交換更有延續性。",
        "先把王區穩住，再用活動度高的棋測試對手防守配置。",
        "讓馬炮完成協調後再交換，能保留更多下一手的選擇。",
        "交換往後放一拍，先把中央壓力建立起來再決定換子。",
      ], `${signature}:alternative`);
  return { won, score, comment, criticalMistake, bestAlternative: alternative, moveCount, captured };
}

export default function Home({ initialMode = "xiangqi", onBackToHome }) {
  const [mode, setMode] = useState(initialMode);
  const [difficulty, setDifficulty] = useState("club");
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [thinkingSpeed, setThinkingSpeed] = useState("fast");
  const [beginnerMode, setBeginnerMode] = useState(false);
  const [darkVariant, setDarkVariant] = useState("standard");
  const [showAssessment, setShowAssessment] = useState(true);
  const [showCommentary, setShowCommentary] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [selectedXiangqi, setSelectedXiangqi] = useState(null);
  const [selectedDark, setSelectedDark] = useState(null);
  const [renderTick, setRenderTick] = useState(0);
  const [winrateHistory, setWinrateHistory] = useState([50]);
  const [playerTrend, setPlayerTrend] = useState(safeTrendLoad);
  const [moveAnalysis, setMoveAnalysis] = useState(null);
  const [lastAction, setLastAction] = useState(null);
  const [replayOpen, setReplayOpen] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);

  const xiangqi = useRef(new XiangqiGame()).current;
  const darkChess = useRef(new DarkChessGame()).current;
  const dragSource = useRef(null);
  const replayTimelines = useRef({ xiangqi: [], dark: [] });
  const recordedReview = useRef(null);
  const lastSpokenCommentary = useRef("");
  const lastSpokenReview = useRef("");
  const clearAnimationTimer = useRef(null);
  const refresh = useCallback(() => setRenderTick((value) => value + 1), []);

  const recordTimeline = useCallback((timelineMode) => {
    const game = timelineMode === "xiangqi" ? xiangqi : darkChess;
    replayTimelines.current[timelineMode] = [...replayTimelines.current[timelineMode].slice(-119), game.clone()];
  }, [darkChess, xiangqi]);
  const resetTimeline = useCallback((timelineMode) => {
    const game = timelineMode === "xiangqi" ? xiangqi : darkChess;
    replayTimelines.current[timelineMode] = [game.clone()];
  }, [darkChess, xiangqi]);
  const flashAction = useCallback((payload) => {
    if (clearAnimationTimer.current) window.clearTimeout(clearAnimationTimer.current);
    setLastAction(payload);
    clearAnimationTimer.current = window.setTimeout(() => setLastAction(null), 650);
  }, []);

  useEffect(() => {
    resetTimeline("xiangqi");
    resetTimeline("dark");
    return () => {
      if (clearAnimationTimer.current) window.clearTimeout(clearAnimationTimer.current);
    };
  }, [resetTimeline]);

  const activeGame = mode === "xiangqi" ? xiangqi : darkChess;
  const restoreGameSnapshot = useCallback((gameMode, snapshot) => {
    if (!snapshot) return false;
    const game = gameMode === "xiangqi" ? xiangqi : darkChess;
    game.board = snapshot.board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
    game.turn = snapshot.turn ?? null;
    game.winner = snapshot.winner ?? null;
    game.history = [...(snapshot.history ?? [])];
    game.moveCount = Number(snapshot.moveCount ?? 0);
    game.moveLog = [...(snapshot.moveLog ?? [])];
    game.selected = snapshot.selected ? { ...snapshot.selected } : null;
    if (gameMode === "dark") {
      game.humanSide = snapshot.humanSide ?? null;
      game.variant = snapshot.variant ?? darkVariant;
    }
    return true;
  }, [darkChess, darkVariant, xiangqi]);

  const undoMove = useCallback(() => {
    const timeline = replayTimelines.current[mode] ?? [];
    if (timeline.length < 2) {
      window.alert("目前沒有可以悔棋的步驟。");
      return;
    }
    const previous = timeline[timeline.length - 2];
    restoreGameSnapshot(mode, previous);
    replayTimelines.current[mode] = timeline.slice(0, -1);
    setThinking(false);
    setSelectedXiangqi(null);
    setSelectedDark(null);
    setMoveAnalysis(null);
    setReplayOpen(false);
    setWinrateHistory([50]);
    recordedReview.current = null;
    flashAction({ mode, kind: "undo", to: previous.selected ?? null });
    refresh();
  }, [flashAction, mode, refresh, restoreGameSnapshot]);

  const showAiHint = useCallback(() => {
    if (thinking) return;
    if (mode === "xiangqi") {
      if (xiangqi.winner || xiangqi.turn !== "red") {
        window.alert("現在不是你的回合，AI 提示會在紅方回合提供。");
        return;
      }
      const budget = { beginner: 45, casual: 65, club: 90, advanced: 125, master: 170 }[difficulty] ?? 90;
      const move = chooseXiangqiMove(xiangqi, difficulty, "red", budget);
      if (!move) {
        window.alert("目前沒有可用的合法走法。");
        return;
      }
      const after = xiangqi.clone();
      after.applyMove(move);
      const beforeA = estimateXiangqiPosition(xiangqi, "red");
      const afterA = estimateXiangqiPosition(after, "red");
      setMoveAnalysis({
        label: `AI 建議：${moveText(xiangqi, move)}`,
        before: beforeA.red,
        after: afterA.red,
        delta: describeWinrateDelta(beforeA, afterA, "red"),
        quality: "AI 提示",
        reason: move.capture ? "這一步先處理可直接兌換的戰術機會，同時比較對手的反擊空間。" : "這一步優先改善子力與後續選擇，先把下一手的戰術空間留大。",
        alternative: moveText(xiangqi, move),
        confidence: afterA.confidence,
      });
      flashAction({ mode: "xiangqi", kind: "hint", from: move.from, to: move.to });
      refresh();
      return;
    }

    if (!darkChess.humanSide || darkChess.turn !== darkChess.humanSide) {
      window.alert("暗棋 AI 提示會在你的回合提供。");
      return;
    }
    const captures = darkChess.allMoves(darkChess.humanSide).filter((move) => Boolean(move.capture));
    const move = captures[0] ?? chooseDarkMove(darkChess, difficulty, darkChess.humanSide);
    if (move) {
      const after = darkChess.clone();
      after.applyMove(move);
      const side = darkChess.humanSide;
      const beforeA = estimateDarkPosition(darkChess, side);
      const afterA = estimateDarkPosition(after, side);
      setMoveAnalysis({
        label: `AI 建議：${moveText(darkChess, move)}`,
        before: beforeA[side],
        after: afterA[side],
        delta: describeWinrateDelta(beforeA, afterA, side),
        quality: move.capture ? "優先吃子" : "AI 提示",
        reason: move.capture ? "目前有已知合法吃子，這是優先應該檢查的戰術窗口。" : "目前沒有必須立即處理的吃子，先改善位置與資訊安全。",
        alternative: moveText(darkChess, move),
        confidence: afterA.confidence,
      });
      flashAction({ mode: "dark", kind: "hint", from: move.from, to: move.to });
      refresh();
      return;
    }
    const hidden = chooseDarkReveal(darkChess);
    if (hidden) {
      setMoveAnalysis({
        label: `AI 建議翻棋：第${hidden.row + 1}行第${hidden.col + 1}列`,
        before: 50,
        after: 50,
        delta: 0,
        quality: "翻棋提示",
        reason: "目前沒有可直接走的已知棋子，建議從能增加情報密度的位置開始翻牌。",
        alternative: `第${hidden.row + 1}行第${hidden.col + 1}列`,
        confidence: 45,
      });
      flashAction({ mode: "dark", kind: "hint", to: { row: hidden.row, col: hidden.col } });
      refresh();
      return;
    }
    window.alert("目前沒有可用的提示。");
  }, [darkChess, difficulty, flashAction, mode, refresh, thinking, xiangqi]);

  const saveGame = useCallback(() => {
    try {
      const game = mode === "xiangqi" ? xiangqi : darkChess;
      const data = {
        version: "4.24",
        savedAt: new Date().toISOString(),
        mode,
        settings: {
          difficulty,
          thinkingSpeed,
          beginnerMode,
          showAnalysis,
          showAssessment,
          showCommentary,
          audioEnabled,
          voiceEnabled,
          darkVariant,
        },
        game: game.clone(),
      };
      localStorage.setItem("qi-ju-save", JSON.stringify(data));
      window.alert("棋局已儲存到這台瀏覽器。");
    } catch (error) {
      console.error(error);
      window.alert("儲存失敗，可能是瀏覽器不允許本機儲存。");
    }
  }, [audioEnabled, beginnerMode, darkChess, darkVariant, difficulty, mode, showAnalysis, showAssessment, showCommentary, thinkingSpeed, voiceEnabled, xiangqi]);

  const loadGame = useCallback(() => {
    try {
      const raw = localStorage.getItem("qi-ju-save");
      if (!raw) {
        window.alert("目前沒有已儲存的棋局。");
        return;
      }
      const data = JSON.parse(raw);
      if (!data?.game || !data?.mode) throw new Error("儲存資料格式不正確");
      const loadedMode = data.mode === "dark" ? "dark" : "xiangqi";
      if (loadedMode === "dark") darkChess.variant = data.settings?.darkVariant ?? darkChess.variant;
      restoreGameSnapshot(loadedMode, data.game);
      setMode(loadedMode);
      setDifficulty(data.settings?.difficulty ?? difficulty);
      setThinkingSpeed(data.settings?.thinkingSpeed ?? thinkingSpeed);
      setBeginnerMode(Boolean(data.settings?.beginnerMode));
      setShowAnalysis(data.settings?.showAnalysis !== false);
      setShowAssessment(data.settings?.showAssessment !== false);
      setShowCommentary(data.settings?.showCommentary !== false);
      setAudioEnabled(data.settings?.audioEnabled !== false);
      setVoiceEnabled(Boolean(data.settings?.voiceEnabled));
      setDarkVariant(data.settings?.darkVariant ?? darkVariant);
      setThinking(false);
      setSelectedXiangqi(null);
      setSelectedDark(null);
      setMoveAnalysis(null);
      setReplayOpen(false);
      setWinrateHistory([50]);
      recordedReview.current = null;
      replayTimelines.current[loadedMode] = [loadedMode === "xiangqi" ? xiangqi.clone() : darkChess.clone()];
      refresh();
      window.alert("棋局已載入。");
    } catch (error) {
      console.error(error);
      window.alert("載入失敗：儲存資料可能已損壞。");
    }
  }, [darkChess, darkVariant, difficulty, refresh, restoreGameSnapshot, thinkingSpeed, xiangqi]);

  const shareGame = useCallback(async () => {
    try {
      const shareHistory = mode === "xiangqi" ? xiangqi.moveLog : darkChess.moveLog;
      const notation = (shareHistory ?? []).map((entry, index) => `${index + 1}. ${entry.text}`).join("\n") || "（尚無棋步）";
      const text = `棋局｜${mode === "xiangqi" ? "中國象棋" : `暗棋 · ${darkVariant === "slant-rush" ? "斜馬衝車" : "標準暗棋"}`}\n${notation}`;
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      flashAction({ mode, kind: "share" });
      window.alert("棋譜已複製，可以直接貼給別人。");
    } catch (error) {
      console.error(error);
      window.alert("分享棋譜失敗。");
    }
  }, [darkChess, darkVariant, flashAction, mode, xiangqi]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (error) {
      console.error(error);
      window.alert("目前瀏覽器不允許全螢幕操作。");
    }
  }, []);

  const resetGame = useCallback(() => {
    if (mode === "xiangqi") xiangqi.reset();
    else darkChess.reset();
    setThinking(false);
    setSelectedXiangqi(null);
    setSelectedDark(null);
    setMoveAnalysis(null);
    setReplayOpen(false);
    setWinrateHistory([50]);
    recordedReview.current = null;
    resetTimeline(mode);
    flashAction({ mode, kind: "reset" });
    refresh();
  }, [darkChess, flashAction, mode, refresh, resetTimeline, xiangqi]);
  const changeDarkVariant = useCallback((nextVariant) => {
    if (nextVariant === darkVariant) return;
    darkChess.setVariant(nextVariant);
    setDarkVariant(nextVariant);
    setThinking(false);
    setSelectedXiangqi(null);
    setSelectedDark(null);
    setMoveAnalysis(null);
    setReplayOpen(false);
    setWinrateHistory([50]);
    recordedReview.current = null;
    resetTimeline("dark");
    refresh();
  }, [darkChess, darkVariant, refresh, resetTimeline]);
  const switchMode = useCallback((nextMode) => {
    if (nextMode === mode) return;
    xiangqi.reset();
    darkChess.reset();
    setThinking(false);
    setMoveAnalysis(null);
    setReplayOpen(false);
    setWinrateHistory([50]);
    recordedReview.current = null;
    resetTimeline("xiangqi");
    resetTimeline("dark");
    setMode(nextMode);
    refresh();
  }, [darkChess, mode, refresh, resetTimeline, xiangqi]);

  const registerMoveResult = useCallback((gameMode, before, after, move, side) => {
    setMoveAnalysis(buildMoveAnalysis(before, after, gameMode, side, move, difficulty));
    recordTimeline(gameMode);
    flashAction({ mode: gameMode, kind: move.capture ? "capture" : "move", from: move.from, to: move.to });
    if (audioEnabled) playTone(move.capture ? "capture" : "move");
    if (after.winner && audioEnabled) window.setTimeout(() => playTone("win"), 100);
  }, [audioEnabled, difficulty, flashAction, recordTimeline]);

  const handleXiangqiCell = (row, col) => {
    if (thinking || xiangqi.winner || xiangqi.turn !== "red") return;
    const clicked = xiangqi.get(row, col);
    const selectedPiece = selectedXiangqi ? xiangqi.get(selectedXiangqi.row, selectedXiangqi.col) : null;

    if (selectedPiece) {
      const move = xiangqi.legalMovesFor(selectedPiece).find(
        (candidate) => candidate.to.row === row && candidate.to.col === col
      );
      if (move) {
        const before = xiangqi.clone();
        if (xiangqi.applyMove(move)) registerMoveResult("xiangqi", before, xiangqi.clone(), move, "red");
        xiangqi.selected = null;
        setSelectedXiangqi(null);
        refresh();
        return;
      }
      if (clicked?.side === "red") {
        const next = { row, col };
        xiangqi.selected = next;
        setSelectedXiangqi(next);
        refresh();
        return;
      }
      xiangqi.selected = null;
      setSelectedXiangqi(null);
      refresh();
      return;
    }

    const next = clicked?.side === "red" ? { row, col } : null;
    xiangqi.selected = next;
    setSelectedXiangqi(next);
    refresh();
  };
  const handleXiangqiDrop = (row, col) => {
    const source = dragSource.current;
    dragSource.current = null;
    if (!source || source.mode !== "xiangqi" || thinking || xiangqi.turn !== "red") return;
    const moving = xiangqi.get(source.row, source.col);
    const move = moving ? xiangqi.legalMovesFor(moving).find((candidate) => candidate.to.row === row && candidate.to.col === col) : null;
    if (move) {
      const before = xiangqi.clone();
      if (xiangqi.applyMove(move)) registerMoveResult("xiangqi", before, xiangqi.clone(), move, "red");
    }
    xiangqi.selected = null;
    refresh();
  };
  const handleDarkCell = (row, col) => {
    if (thinking || darkChess.winner) return;
    const clicked = darkChess.get(row, col);

    // 先處理「目前已選棋子 → 空格／敵方棋子」的走棋。
    // 舊版在這裡先 `if (!clicked) return`，導致點空格目標完全沒有反應。
    if (darkChess.humanSide && darkChess.turn === darkChess.humanSide && selectedDark) {
      const selectedPiece = darkChess.get(selectedDark.row, selectedDark.col);
      if (selectedPiece && !selectedPiece.hidden && selectedPiece.side === darkChess.humanSide) {
        const move = darkChess.legalMovesFor(selectedPiece).find(
          (candidate) => candidate.to.row === row && candidate.to.col === col
        );
        if (move) {
          const before = darkChess.clone();
          const applied = darkChess.applyMove(move);
          darkChess.selected = null;
          setSelectedDark(null);
          if (applied) {
            registerMoveResult("dark", before, darkChess.clone(), move, darkChess.humanSide);
          }
          refresh();
          return;
        }
      }
    }

    // 空格既不是翻棋目標，也不是目前選棋子的合法目標。保留選取，讓使用者可以重新選棋。
    if (!clicked) {
      refresh();
      return;
    }

    if (clicked.hidden) {
      if (!darkChess.humanSide || darkChess.turn === darkChess.humanSide) {
        const before = darkChess.clone();
        if (darkChess.reveal(row, col)) {
          const after = darkChess.clone();
          recordTimeline("dark");
          const side = after.humanSide ?? "red";
          const beforeA = estimateDarkPosition(before, side);
          const afterA = estimateDarkPosition(after, side);
          setMoveAnalysis({ label: after.history?.[0]?.text ?? "翻棋", before: beforeA[side], after: afterA[side], delta: describeWinrateDelta(beforeA, afterA, side), quality: "情報更新", reason: "翻棋的價值在於揭露資訊；下一步要把新情報轉成位置、交換或防守優勢。", alternative: "先比較周圍未知區與可吃子路線，再決定下一次翻棋。", confidence: afterA.confidence });
          setSelectedDark(null);
          darkChess.selected = null;
          flashAction({ mode: "dark", kind: "flip", to: { row, col } });
          if (audioEnabled) playTone("flip");
        }
        refresh();
      }
      return;
    }

    if (!darkChess.humanSide || darkChess.turn !== darkChess.humanSide) return;
    const next = clicked.side === darkChess.humanSide ? { row, col } : null;
    darkChess.selected = next;
    setSelectedDark(next);
    refresh();
  };
  const handleDarkDrop = (row, col) => {
    const source = dragSource.current;
    dragSource.current = null;
    if (!source || source.mode !== "dark" || thinking || !darkChess.humanSide || darkChess.turn !== darkChess.humanSide) return;
    const moving = darkChess.get(source.row, source.col);
    const move = moving ? darkChess.legalMovesFor(moving).find((candidate) => candidate.to.row === row && candidate.to.col === col) : null;
    if (move) {
      const before = darkChess.clone();
      if (darkChess.applyMove(move)) registerMoveResult("dark", before, darkChess.clone(), move, darkChess.humanSide ?? "red");
    }
    darkChess.selected = null;
    refresh();
  };
  const beginDrag = (event, dragMode, row, col) => {
    dragSource.current = { mode: dragMode, row, col };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${dragMode}:${row}:${col}`);
    if (dragMode === "xiangqi") {
      const next = { row, col };
      xiangqi.selected = next;
      setSelectedXiangqi(next);
    } else {
      const next = { row, col };
      darkChess.selected = next;
      setSelectedDark(next);
    }
    refresh();
  };

  useEffect(() => {
    if (activeGame.winner) return;
    if (mode === "xiangqi" && xiangqi.turn === "black") {
      let cancelled = false;
      const speedMultiplier = { instant: 0.04, fast: 0.18, standard: 0.7, deep: 1.2 }[thinkingSpeed];
      const searchBudget = { beginner: 40, casual: 75, club: 170, advanced: 350, master: 650 }[difficulty] ?? 170;
      setThinking(true);
      const timer = window.setTimeout(() => {
        if (cancelled) return;
        const move = chooseXiangqiMove(xiangqi, difficulty, "black", searchBudget);
        if (move && xiangqi.applyMove(move)) {
          recordTimeline("xiangqi");
          flashAction({ mode: "xiangqi", kind: move.capture ? "capture" : "move", from: move.from, to: move.to });
          if (audioEnabled) playTone(move.capture ? "capture" : "move");
          if (xiangqi.winner && audioEnabled) window.setTimeout(() => playTone("win"), 100);
        }
        xiangqi.selected = null;
        setSelectedXiangqi(null);
        setThinking(false);
        refresh();
      }, Math.max(12, Math.round((difficulty === "master" ? 145 : difficulty === "advanced" ? 105 : difficulty === "club" ? 78 : difficulty === "casual" ? 48 : 28) * speedMultiplier)));
      return () => { cancelled = true; window.clearTimeout(timer); };
    }
    if (mode === "dark" && darkChess.humanSide && darkChess.turn && darkChess.turn !== darkChess.humanSide) {
      let cancelled = false;
      const aiSide = darkChess.turn ?? "black";
      const hasHiddenPiece = darkChess.board.flat().some((piece) => piece?.hidden);
      const legal = darkChess.allMoves(aiSide);
      const captures = legal.filter((m) => Boolean(m.capture));
      const moveChance = { beginner: 0.24, casual: 0.42, club: 0.58, advanced: 0.74, master: 0.86 }[difficulty] ?? 0.58;
      const shouldMoveKnown = captures.length > 0 || (legal.length > 0 && Math.random() < moveChance) || !hasHiddenPiece;
      const speedMultiplier = { instant: 0.04, fast: 0.16, standard: 0.68, deep: 1.2 }[thinkingSpeed];
      setThinking(true);
      const timer = window.setTimeout(() => {
        if (cancelled) return;
        if (shouldMoveKnown) {
          const move = chooseDarkMove(darkChess, difficulty, aiSide);
          if (move && darkChess.applyMove(move)) {
            recordTimeline("dark");
            flashAction({ mode: "dark", kind: move.capture ? "capture" : "move", from: move.from, to: move.to });
            if (audioEnabled) playTone(move.capture ? "capture" : "move");
            if (darkChess.winner && audioEnabled) window.setTimeout(() => playTone("win"), 100);
          } else if (hasHiddenPiece) {
            const hidden = chooseDarkReveal(darkChess);
            if (hidden && darkChess.reveal(hidden.row, hidden.col)) {
              recordTimeline("dark");
              flashAction({ mode: "dark", kind: "flip", to: { row: hidden.row, col: hidden.col } });
              if (audioEnabled) playTone("flip");
            }
          }
        } else if (hasHiddenPiece) {
          const hidden = chooseDarkReveal(darkChess);
          if (hidden && darkChess.reveal(hidden.row, hidden.col)) {
            recordTimeline("dark");
            flashAction({ mode: "dark", kind: "flip", to: { row: hidden.row, col: hidden.col } });
            if (audioEnabled) playTone("flip");
          }
        }
        darkChess.selected = null;
        setSelectedDark(null);
        setThinking(false);
        refresh();
      }, Math.max(12, Math.round((hasHiddenPiece ? 32 : difficulty === "master" ? 122 : difficulty === "advanced" ? 98 : difficulty === "club" ? 72 : difficulty === "casual" ? 46 : 26) * speedMultiplier)));
      return () => { cancelled = true; window.clearTimeout(timer); };
    }
    return undefined;
  }, [activeGame.winner, audioEnabled, darkChess.board, darkChess.humanSide, darkChess.turn, difficulty, flashAction, mode, recordTimeline, refresh, thinkingSpeed, xiangqi.turn]);

  const xiangqiLegalTargets = useMemo(() => {
    if (!selectedXiangqi) return [];
    const piece = xiangqi.get(selectedXiangqi.row, selectedXiangqi.col);
    return piece ? xiangqi.legalMovesFor(piece).map((m) => `${m.to.row}-${m.to.col}`) : [];
  }, [renderTick, selectedXiangqi, xiangqi]);
  const activeHistory = activeGame.history ?? [];
  const activeAssessment = mode === "xiangqi" ? estimateXiangqiPosition(xiangqi, "red") : estimateDarkPosition(darkChess, darkChess.humanSide ?? "red");
  const activeCommentary = mode === "xiangqi" ? getXiangqiCommentary(xiangqi, "red") : getDarkCommentary(darkChess, darkChess.humanSide ?? "red");
  useEffect(() => {
    setWinrateHistory((history) => history[history.length - 1] === activeAssessment.red ? history : [...history.slice(-13), activeAssessment.red]);
  }, [activeAssessment.red, mode]);
  const capturedCount = 32 - activeGame.board.flat().filter(Boolean).length;
  const gameStats = useMemo(() => {
    if (mode === "xiangqi") {
      return {
        columns: [
          [["紅方子力", xiangqi.board.flat().filter((p) => p?.side === "red").length], ["黑方子力", xiangqi.board.flat().filter((p) => p?.side === "black").length], ["紅方可吃", xiangqi.allLegalMoves("red").filter((m) => m.capture).length], ["黑方可吃", xiangqi.allLegalMoves("black").filter((m) => m.capture).length]],
          [["回合", xiangqi.turn === "red" ? "紅" : "黑"], ["手數", xiangqi.moveCount], ["王區", xiangqi.isInCheck("red") || xiangqi.isInCheck("black") ? "有將軍" : "正常"], ["吃子", capturedCount]],
        ],
      };
    }
    return {
      columns: [
        [["紅方棋子", darkChess.board.flat().filter((p) => p?.side === "red").length], ["黑方棋子", darkChess.board.flat().filter((p) => p?.side === "black").length], ["未知棋", darkChess.board.flat().filter((p) => p?.hidden).length], ["紅方可吃", darkChess.allMoves("red").filter((m) => m.capture).length]],
        [["黑方可吃", darkChess.allMoves("black").filter((m) => m.capture).length], ["手數", darkChess.moveCount], ["玩法", darkVariant === "slant-rush" ? "斜馬衝車" : "標準"], ["吃子", capturedCount]],
      ],
    };
  }, [capturedCount, darkChess, darkVariant, mode, xiangqi, xiangqi.moveCount, xiangqi.turn]);

  const gameReview = useMemo(() => {
    if (!activeGame.winner) return null;
    const playerSide = mode === "xiangqi" ? "red" : (darkChess.humanSide ?? "red");
    const visiblePieces = mode === "dark" ? darkChess.board.flat().filter((p) => p && !p.hidden).length : 0;
    return buildFinalReview(mode, darkVariant, activeGame.winner, playerSide, activeGame.moveCount, capturedCount, visiblePieces, activeGame.moveLog ?? activeHistory);
  }, [activeGame, activeHistory, capturedCount, darkChess.humanSide, darkVariant, mode, xiangqi.winner, darkChess.winner]);
  useEffect(() => {
    if (!gameReview) return;
    const key = `${mode}:${gameReview.moveCount}:${gameReview.score}:${gameReview.won}`;
    if (recordedReview.current === key) return;
    recordedReview.current = key;
    setPlayerTrend((trend) => {
      const next = [...trend.slice(-7), gameReview.score];
      try { localStorage.setItem("qi-ju-player-trend", JSON.stringify(next)); } catch {}
      return next;
    });
  }, [gameReview, mode]);

  useEffect(() => {
    if (!voiceEnabled || !showAnalysis || !activeCommentary || activeGame.moveCount <= 0 || thinking) return;
    const key = `${mode}:${activeGame.moveCount}:${activeCommentary.headline}:${activeCommentary.detail}`;
    if (lastSpokenCommentary.current === key) return;
    lastSpokenCommentary.current = key;
    speakText(`${activeCommentary.headline}。${activeCommentary.detail}`);
  }, [activeCommentary.detail, activeCommentary.headline, activeGame.moveCount, mode, showAnalysis, thinking, voiceEnabled]);
  useEffect(() => {
    if (!voiceEnabled || !gameReview) return;
    const key = `${mode}:${gameReview.moveCount}:${gameReview.score}:${gameReview.won}`;
    if (lastSpokenReview.current === key) return;
    lastSpokenReview.current = key;
    speakText(`${gameReview.won ? "恭喜取勝" : "棋局結束"}。${gameReview.comment}`);
  }, [gameReview, mode, voiceEnabled]);

  const replayTimeline = replayTimelines.current[mode] ?? [];
  const replayGame = replayTimeline[replayIndex] ?? replayTimeline[replayTimeline.length - 1] ?? null;
  const openReplay = () => {
    if (replayTimeline.length < 2) return;
    setReplayIndex(replayTimeline.length - 1);
    setReplayOpen(true);
  };
  const beginnerHint = beginnerMode
    ? mode === "dark"
      ? (darkVariant === "slant-rush"
        ? "斜馬衝車：車可直／橫走任意格；與目標中間至少留一格空格時，可無視大小吃子。馬可斜走一格，斜吃無視大小；炮仍隔一子吃。"
        : "標準暗棋：先翻棋決定陣營。一般棋子一步一格，吃子依將＞士＞象＞車＞馬＞炮＞卒；炮必須隔一子吃，炮吃子不看大小。")
      : (selectedXiangqi
        ? ({
            king: "帥／將：九宮內上下左右走一點；兩王同一路線沒有棋子阻隔時可以飛將。",
            advisor: "仕／士：只在九宮內沿斜線走一點。",
            elephant: "相／象：走田字，不能過河；田字中央有棋子就是塞象眼。",
            horse: "馬：走日字；第一格有棋子會拐馬腳。",
            rook: "車：直線或橫線可走任意格，中間不能有棋子。",
            cannon: "炮：平時像車一樣走；吃子時中間必須隔一枚棋子。",
            pawn: "兵／卒：未過河只能向前；過河後可以向前或左右。",
          })[xiangqi.get(selectedXiangqi.row, selectedXiangqi.col)?.type ?? ""] ?? "紅先黑後，一回合只能動一枚棋子。"
        : "紅先黑後，一回合只能動一枚棋子。")
    : null;

  const renderXiangqiBoard = () => h(
    "div", { className: "board-wrap" },
    h("div", { className: "board-grid xiangqi-grid", role: "grid", "aria-label": "中國象棋棋盤" },
      xiangqi.board.map((row, r) => row.map((piece, c) => {
        const selected = selectedXiangqi?.row === r && selectedXiangqi?.col === c;
        const target = xiangqiLegalTargets.includes(`${r}-${c}`);
        const isSource = lastAction?.mode === "xiangqi" && lastAction.from?.row === r && lastAction.from?.col === c;
        const isDest = lastAction?.mode === "xiangqi" && lastAction.to?.row === r && lastAction.to?.col === c;
        return h("button", {
          className: `board-cell ${selected ? "selected" : ""} ${target ? "legal-target" : ""} ${isSource ? "last-move-source" : ""} ${isDest ? "last-move-dest" : ""}`,
          key: `${r}-${c}`, onPointerDown: (event) => { if (event.button === 0) { event.preventDefault(); handleXiangqiCell(r, c); } }, onClick: (event) => event.preventDefault(),
          "aria-label": `${r + 1} 行 ${c + 1} 列`,
          draggable: false,
        }, h("span", { className: "grid-intersection" }), piece ? h(PieceGlyph, { piece }) : null, target ? h("span", { className: "move-dot" }) : null);
      }))
    ),
    h("div", { className: "river-copy river-left" }, "楚河"),
    h("div", { className: "river-copy river-right" }, "漢界"),
    h("div", { className: "coordinate coord-left" }, ["１","２","３","４","５","６","７","８","９","10"].map((v) => h("span", { key: v }, v))),
    h("div", { className: "coordinate coord-bottom" }, ["１","２","３","４","５","６","７","８","９"].map((v) => h("span", { key: v }, v)))
  );
  const renderDarkBoard = () => h(
    "div", { className: "board-wrap dark-wrap" },
    h("div", { className: "board-grid dark-grid", role: "grid", "aria-label": "暗棋棋盤" },
      darkChess.board.map((row, r) => row.map((piece, c) => {
        const selected = selectedDark?.row === r && selectedDark?.col === c;
        const target = Boolean(selectedDark && darkChess.get(selectedDark.row, selectedDark.col)?.side === darkChess.humanSide && darkChess.legalMovesFor(darkChess.get(selectedDark.row, selectedDark.col)).some((m) => m.to.row === r && m.to.col === c));
        const isDest = lastAction?.mode === "dark" && lastAction.to?.row === r && lastAction.to?.col === c;
        return h("button", {
          className: `board-cell dark-cell ${selected ? "selected" : ""} ${target ? "legal-target" : ""} ${isDest ? `last-${lastAction.kind}` : ""}`,
          key: `${r}-${c}`, onPointerDown: (event) => { if (event.button === 0) { event.preventDefault(); handleDarkCell(r, c); } }, onClick: (event) => event.preventDefault(),
          "aria-label": `暗棋 ${r + 1} 行 ${c + 1} 列`,
          draggable: false,
        }, piece ? h(PieceGlyph, { piece }) : null, target ? h("span", { className: "move-dot" }) : null);
      }))
    ),
    h("div", { className: "dark-board-note" }, h(EyeOff, { size: 13 }), " 翻開棋子，建立你的情報網")
  );

  const chartPoints = winrateHistory.map((value, index) => `${winrateHistory.length === 1 ? 8 : (index / (winrateHistory.length - 1)) * 184 + 8},${48 - (value / 100) * 40}`).join(" ");
  const trendValues = playerTrend.length ? playerTrend : (gameReview ? [gameReview.score] : []);
  const trendPoints = trendValues.map((value, index) => `${trendValues.length === 1 ? 8 : (index / (trendValues.length - 1)) * 184 + 8},${48 - (value / 100) * 40}`).join(" ");
  const candidateMoves = (mode === "xiangqi"
    ? xiangqi.allLegalMoves("black")
    : (darkChess.board.flat().some((p) => p?.hidden) ? [] : darkChess.allMoves(darkChess.turn ?? "black")))
    .slice(0, 4);
  const candidatePanel = h(
    "div",
    { className: "candidate-card" },
    h("div", { className: "candidate-heading" }, h("span", null, "候選走法"), h("small", null, "LIVE SEARCH")),
    ...candidateMoves.map((move, index) => h(
      "div",
      { className: "candidate-line", key: `${move.from.row}-${move.from.col}-${move.to.row}-${move.to.col}` },
      h("span", { className: "candidate-rank" }, `0${index + 1}`),
      h("span", { className: "candidate-copy" },
        h("strong", null, moveText(mode === "xiangqi" ? xiangqi : darkChess, move)),
        h("small", null, move.capture ? "可先手取得子力或情報優勢" : "保留活動度與後續選擇")
      ),
      h("span", { className: "candidate-score" }, index === 0 ? "高" : "中")
    ))
  );
  const replayPanel = replayOpen && replayGame ? h(
    "div",
    { className: "replay-overlay", role: "dialog", "aria-modal": "true" },
    h(
      "div",
      { className: "replay-modal" },
      h(
        "div",
        { className: "replay-modal-head" },
        h(
          "div",
          null,
          h("span", { className: "card-kicker" }, "棋譜復盤"),
          h("h2", null, mode === "xiangqi" ? "中國象棋 · 復盤" : `暗棋 · ${darkVariant === "slant-rush" ? "斜馬衝車" : "標準暗棋"}`)
        ),
        h("button", { className: "icon-button", onClick: () => setReplayOpen(false) }, "×")
      ),
      h(
        "div",
        { className: "replay-progress" },
        h("span", null, `第 ${replayIndex + 1} / ${replayTimeline.length} 個局面`),
        h("input", {
          type: "range",
          min: 0,
          max: Math.max(0, replayTimeline.length - 1),
          value: replayIndex,
          onChange: (e) => setReplayIndex(Number(e.target.value)),
        })
      ),
      h(MiniReplayBoard, { game: replayGame, mode }),
      h(
        "div",
        { className: "replay-controls" },
        h("button", { className: "text-button", onClick: () => setReplayIndex(0), disabled: replayIndex <= 0 }, h(ChevronLeft, { size: 15 }), "首局面"),
        h("button", { className: "text-button", onClick: () => setReplayIndex((v) => Math.max(0, v - 1)), disabled: replayIndex <= 0 }, h(ChevronLeft, { size: 15 }), "上一步"),
        h("button", { className: "text-button", onClick: () => setReplayIndex((v) => Math.min(replayTimeline.length - 1, v + 1)), disabled: replayIndex >= replayTimeline.length - 1 }, "下一步", h(ChevronRight, { size: 15 })),
        h("button", { className: "text-button", onClick: () => setReplayIndex(replayTimeline.length - 1), disabled: replayIndex >= replayTimeline.length - 1 }, "最新", h(ChevronRight, { size: 15 }))
      ),
      h(
        "div",
        { className: "replay-log" },
        ...(replayGame.moveLog ?? replayGame.history ?? []).map((entry, index) => h(
          "div",
          { className: "replay-log-entry", key: `${index}-${entry.text}` },
          h("span", null, index + 1),
          h("span", null, entry.text)
        ))
      )
    )
  ) : null;

  return h("main", { className: "app-frame" },
    h("header", { className: "topbar" },
      h("div", { className: "brand-left-wrap" }, onBackToHome ? h("button", { className: "home-back-button", onClick: onBackToHome, title: "返回首頁" }, "⌂ 首頁") : null, h("div", { className: "brand-lockup" }, h("div", { className: "brand-seal" }, h(Swords, { size: 17, strokeWidth: 1.5 })), h("div", null, h("div", { className: "brand-name" }, "棋局 ", h("span", null, "/"), " QI JU"), h("div", { className: "brand-subtitle" }, "東方棋院 · 沉浸式棋局")))),
      h("div", { className: "topbar-status" }, h("span", { className: "status-dot" }), " 本地對弈 · 難度可調 ", h("span", { className: "status-divider" }), mode === "dark" ? (darkVariant === "slant-rush" ? "斜馬衝車" : "標準暗棋") : "中國象棋"),
      h("button", { className: "icon-button top-help", title: "遊戲說明", onClick: () => window.alert(mode === "xiangqi" ? "紅先黑後；帥、仕、相、馬、車、炮、兵依中國象棋基本走法。" : "暗棋：先翻棋決定陣營；炮隔一子吃。斜馬衝車模式另有強化車馬規則。") }, h(CircleHelp, { size: 17 }))
    ),
    h("div", { className: "game-layout" },
      h("section", { className: "board-column" },
        h("div", { className: "eyebrow" }, h("span", null, "EST. 2026"), h("span", { className: "eyebrow-line" }), h("span", null, "沉浸式棋局模擬")),
        h("div", { className: "title-row" }, h("div", null, h("h1", null, mode === "xiangqi" ? "中國象棋" : "暗棋", h("span", { className: "title-ornament" }, "·")), h("p", null, mode === "xiangqi" ? "楚河漢界，步步為營" : "未知之中，聽見落子的聲音")), h("div", { className: "turn-chip" }, h("span", { className: `turn-dot ${mode === "dark" && darkChess.turn === "black" ? "black" : "red"}` }), thinking ? "AI 分析中" : turnText(activeGame, mode))),
        h("div", { className: "feature-overview" },
          h("div", { className: "feature-overview-heading" }, h("span", null, "功能總覽"), h("small", null, "可直接調整")),
          h("div", { className: "feature-strip" },
            h("button", { className: `feature-pill ${beginnerMode ? "on" : ""}`, onClick: () => setBeginnerMode((v) => !v), "aria-pressed": beginnerMode }, h("span", { className: "feature-icon" }, "新"), h("span", null, h("strong", null, "新手模式"), h("small", null, beginnerMode ? "已開啟 · 點擊關閉" : "點擊開啟教學"))),
            mode === "dark" ? h("div", { className: "feature-pill feature-control" }, h("span", { className: "feature-icon" }, "規"), h("span", null, h("strong", null, "暗棋玩法"), h("small", null, darkVariant === "slant-rush" ? "斜馬衝車" : "標準暗棋"), h("span", { className: "mini-choice-row" }, h("button", { type: "button", className: darkVariant === "standard" ? "mini-choice selected" : "mini-choice", onClick: () => changeDarkVariant("standard") }, "標準"), h("button", { type: "button", className: darkVariant === "slant-rush" ? "mini-choice selected" : "mini-choice", onClick: () => changeDarkVariant("slant-rush") }, "斜馬衝車")))) : h("button", { className: `feature-pill ${showAnalysis ? "on" : ""}`, onClick: () => setShowAnalysis((v) => !v), "aria-pressed": showAnalysis }, h("span", { className: "feature-icon" }, "析"), h("span", null, h("strong", null, "局勢分析＋講評"), h("small", null, showAnalysis ? `紅 ${activeAssessment.red}% · ${activeCommentary.headline}` : "已關閉 · 點擊開啟"))),
            h("div", { className: "feature-pill feature-control ai-feature-control" }, h("span", { className: "feature-icon" }, "AI"), h("span", null, h("strong", null, "AI 設定"), h("div", { className: "feature-select-row" }, h("label", null, h("span", null, "難度"), h("select", { value: difficulty, onChange: (e) => setDifficulty(e.target.value) }, difficultyOptions.map((o) => h("option", { key: o.value, value: o.value }, o.label)))), h("label", null, h("span", null, "速度"), h("select", { value: thinkingSpeed, onChange: (e) => setThinkingSpeed(e.target.value) }, thinkingSpeedOptions.map((o) => h("option", { key: o.value, value: o.value }, o.label))))))),
            h("button", { className: `feature-pill toggle-pill ${audioEnabled ? "on" : ""}`, onClick: () => setAudioEnabled((v) => !v) }, audioEnabled ? h(Volume2, { size: 14 }) : h(VolumeX, { size: 14 }), h("span", null, h("strong", null, "音效"), h("small", null, audioEnabled ? "開啟" : "關閉"))),
            h("button", { className: `feature-pill toggle-pill ${voiceEnabled ? "on" : ""}`, onClick: () => setVoiceEnabled((v) => !v) }, h(Mic2, { size: 14 }), h("span", null, h("strong", null, "語音講評"), h("small", null, voiceEnabled ? "開啟" : "關閉")),
          )
        ),
        h("div", { className: `board-shell ${mode === "dark" ? "dark-board-shell" : ""}` },
          h("div", { className: "board-meta board-meta-top" }, h("span", null, mode === "xiangqi" ? "九宮 · 10 × 9" : `${darkVariant === "slant-rush" ? "斜馬衝車" : "標準暗棋"} · 4 × 8`), h("span", null, `第 ${activeGame.moveCount + 1} 手`)),
          mode === "xiangqi" ? renderXiangqiBoard() : renderDarkBoard(),
          h("div", { className: "board-meta board-meta-bottom" }, h("span", null, h("span", { className: "legend-dot red-dot" }), "紅方"), h("span", null, h("span", { className: "legend-dot black-dot" }), "黑方"), h("span", { className: "board-hint" }, "點一下棋子，再點目標格走棋")),
        ),
        beginnerHint ? h("div", { className: "beginner-guide board-guide" }, h("div", { className: "beginner-guide-title" }, h("span", null, "新手提示"), h("small", null, mode === "dark" ? darkVariant.toUpperCase() : "XIANGQI")), h("p", null, beginnerHint)) : null,
        h("div", { className: "board-actions" },
          h("div", { className: "tool-group" },
            h("span", { className: "tool-group-title" }, "棋局"),
            h("button", { className: "text-button", onClick: resetGame }, h(RotateCcw, { size: 15 }), "重新開局"),
            h("button", { className: "text-button", onClick: undoMove }, h(ChevronLeft, { size: 15 }), "悔棋"),
            h("button", { className: "text-button", onClick: showAiHint }, h(Lightbulb, { size: 15 }), "AI提示"),
            h("button", { className: "text-button", onClick: openReplay, disabled: replayTimeline.length < 2 }, h(Play, { size: 15 }), "棋譜復盤")
          ),
          h("div", { className: "tool-group" },
            h("span", { className: "tool-group-title" }, "資料"),
            h("button", { className: "text-button", onClick: saveGame }, "儲存"),
            h("button", { className: "text-button", onClick: loadGame }, "載入"),
            h("button", { className: "text-button", onClick: shareGame }, "分享棋譜"),
            h("button", { className: "text-button", onClick: toggleFullscreen }, "全螢幕"),
            h("button", { className: "text-button", onClick: () => window.alert(mode === "xiangqi" ? "象棋：帥九宮、仕斜走、相走田、馬走日、車走直線、炮隔子吃、兵過河可左右。" : darkVariant === "slant-rush" ? "斜馬衝車：車可遠衝；馬可斜走；炮仍隔一子吃。" : "標準暗棋：依將＞士＞象＞車＞馬＞炮＞卒；炮隔一子吃，炮不看大小。") }, h(CircleHelp, { size: 15 }), "如何遊玩")
          ),
          h("div", { className: "board-action-spacer" }),
          h("span", { className: "board-action-metric" }, `吃子 ${String(capturedCount).padStart(2, "0")}`),
          h("span", { className: "board-action-metric" }, `AI ${thinking ? "THINKING" : "READY"}`),
        )
      ),
      h("aside", { className: "control-rail" },
        h("div", { className: "rail-card mode-card" },
          h("div", { className: "card-kicker" }, h(Sparkles, { size: 13 }), "選擇棋局"),
          h("div", { className: "mode-toggle", role: "tablist" },
            h("button", { className: mode === "xiangqi" ? "active" : "", onClick: () => switchMode("xiangqi") }, h("span", { className: "mode-icon" }, "象"), h("span", null, h("strong", null, "中國象棋"), h("small", null, "完整規則"))),
            h("button", { className: mode === "dark" ? "active" : "", onClick: () => switchMode("dark") }, h("span", { className: "mode-icon dark-mode-icon" }, "暗"), h("span", null, h("strong", null, "暗棋"), h("small", null, "翻棋對弈")))
          ),
          h("div", { className: "card-divider" }),
          h("div", { className: "opponent-row" }, h("span", { className: `opponent-avatar ${thinking ? "thinking-avatar" : ""}` }, h(Crown, { size: 15 })), h("span", null, h("strong", null, "對手 · 棋院 AI"), h("small", null, thinking ? "分析中 · 正在評估局勢…" : `難度：${describeDifficulty(difficulty)}`)), h("span", { className: "online-pill" }, "LIVE")),
          thinking ? h("div", { className: "analysis-status", role: "status" }, h("span", { className: "analysis-spinner" }), h("span", null, "AI 分析中"), h("div", { className: "analysis-progress" }, h("i")), h("small", null, "搜尋合法走法、局面與戰術候選")) : null,
          candidatePanel,
        ),
        mode === "dark" ? h("div", { className: "rail-card variant-card" }, h("div", { className: "card-heading" }, h("div", null, h("div", { className: "card-kicker" }, h(Swords, { size: 13 }), "暗棋玩法變體"), h("h2", null, darkVariant === "slant-rush" ? "斜馬衝車" : "標準暗棋")), h("span", { className: "difficulty-current" }, "獨立規則")), h("div", { className: "variant-toggle" }, h("button", { className: darkVariant === "standard" ? "selected" : "", onClick: () => changeDarkVariant("standard") }, h("strong", null, "標準暗棋"), h("small", null, "一步一格 · 炮隔一子吃")), h("button", { className: darkVariant === "slant-rush" ? "selected" : "", onClick: () => changeDarkVariant("slant-rush") }, h("strong", null, "斜馬衝車"), h("small", null, "車衝任意格 · 馬可斜走"))) ) : null,
        h("div", { className: "rail-card difficulty-card" }, h("div", { className: "card-heading" }, h("div", null, h("div", { className: "card-kicker" }, h(Settings2, { size: 13 }), "棋力設定"), h("h2", null, "AI 難度")), h("span", { className: "difficulty-current" }, describeDifficulty(difficulty))), h("div", { className: "difficulty-list" }, difficultyOptions.map((o) => h("button", { key: o.value, className: `difficulty-option ${difficulty === o.value ? "selected" : ""}`, onClick: () => setDifficulty(o.value) }, h("span", { className: "difficulty-number" }, o.glyph), h("span", { className: "difficulty-copy" }, h("strong", null, o.label), h("small", null, o.detail)), h("span", { className: "difficulty-radio" })))), h("div", { className: "difficulty-tip" }, h(Lightbulb, { size: 14 }), h("span", null, "休閒保留隨機性，棋友開始搜尋，大師使用更深一層 minimax。"))),
        h("div", { className: "rail-card speed-card" }, h("div", { className: "card-heading" }, h("div", null, h("div", { className: "card-kicker" }, h(Gauge, { size: 13 }), "AI 回應節奏"), h("h2", null, "思考速度")), h("span", { className: "difficulty-current" }, thinkingSpeedOptions.find((o) => o.value === thinkingSpeed)?.label)), h("div", { className: "speed-list" }, thinkingSpeedOptions.map((o) => h("button", { key: o.value, className: `speed-option ${thinkingSpeed === o.value ? "selected" : ""}`, onClick: () => setThinkingSpeed(o.value) }, h("span", { className: "speed-dot" }), h("span", null, h("strong", null, o.label), h("small", null, o.detail))))), h("div", { className: "difficulty-tip" }, "速度只影響等待時間；難度則會改變 AI 的決策方式。")),
        showAnalysis ? h("div", { className: "rail-card analysis-hub-card" },
          h("div", { className: "assessment-heading" }, h("div", null, h("div", { className: "card-kicker" }, h(Sparkles, { size: 13 }), "局勢分析＋講評"), h("h2", null, "當前局勢")), h("span", { className: "confidence-tag" }, `信心 ${activeAssessment.confidence}%`)),
          h("div", { className: "winrate-row" }, h("span", null, "紅方"), h("div", { className: "winrate-track" }, h("span", { className: "winrate-red", style: { width: `${activeAssessment.red}%` } })), h("strong", null, `${activeAssessment.red}%`)),
          h("div", { className: "winrate-row" }, h("span", null, "黑方"), h("div", { className: "winrate-track" }, h("span", { className: "winrate-black", style: { width: `${activeAssessment.black}%` } })), h("strong", null, `${activeAssessment.black}%`)),
          h("div", { className: "commentary-box" }, h("div", { className: "commentary-kicker" }, h(Lightbulb, { size: 12 }), "即時講評"), h("strong", null, activeCommentary.headline), h("p", null, activeCommentary.detail), h("small", null, activeCommentary.advice)),
          h("div", { className: "assessment-summary" }, h("span", { className: "assessment-pulse" }), h("strong", null, activeAssessment.summary), h("small", null, activeAssessment.threat)),
          h("div", { className: "stats-grid analysis-hub-stats" }, ...gameStats.columns.map((column, i) => h("div", { key: i }, ...column.map(([label, value]) => h("div", { className: "stat-row", key: label }, h("span", null, label), h("strong", null, value))))))
        ) : null,
        moveAnalysis ? h("div", { className: "rail-card move-analysis-card" }, h("div", { className: "card-heading" }, h("div", null, h("div", { className: "card-kicker" }, h(Lightbulb, { size: 13 }), "本手分析"), h("h2", null, moveAnalysis.quality)), h("span", { className: `delta-tag ${moveAnalysis.delta >= 0 ? "positive" : "negative"}` }, `${moveAnalysis.delta > 0 ? "+" : ""}${moveAnalysis.delta}%`)), h("div", { className: "analysis-move-label" }, moveAnalysis.label), h("div", { className: "analysis-range" }, h("span", null, `勝率 ${moveAnalysis.before}%`), h("span", null, "→"), h("span", null, `${moveAnalysis.after}%`)), h("p", { className: "analysis-reason" }, moveAnalysis.reason), h("div", { className: "alternative-line" }, h("span", null, "建議替代"), h("strong", null, moveAnalysis.alternative)), h("div", { className: "analysis-confidence" }, `分析信心 ${moveAnalysis.confidence}%`)) : null,
        h("div", { className: "rail-card history-card" }, h("div", { className: "history-heading" }, h("div", { className: "card-kicker" }, h(History, { size: 13 }), "對局記錄"), h("span", null, "LIVE LOG")), h("div", { className: "history-list" }, activeHistory.length ? activeHistory.map((entry, index) => h("div", { className: "history-entry", key: `${entry.text}-${index}` }, h("span", { className: `history-side ${entry.side === "red" ? "red" : entry.side === "black" ? "black" : "neutral"}` }), h("span", null, entry.text), h("small", null, index === 0 ? "剛剛" : `${index} 手前`))) : h("div", { className: "history-empty" }, h("span", { className: "empty-stamp" }, "棋"), h("p", null, "等待第一手落子", h("br"), h("small", null, "每一步都將留在這裡"))))),
        gameReview ? h("div", { className: "rail-card review-card" }, h("div", { className: "review-heading" }, h("div", null, h("div", { className: "card-kicker" }, h(Sparkles, { size: 13 }), "對局後評估"), h("h2", null, gameReview.won ? "漂亮取勝" : "棋局覆盤")), h("span", { className: `review-result ${gameReview.won ? "win" : "loss"}` }, gameReview.won ? "勝利" : "敗北")), h("div", { className: "review-score-row" }, h("strong", null, gameReview.score), h("span", null, "/ 100"), h("div", { className: "review-score-track" }, h("i", { style: { width: `${gameReview.score}%` } }))), h("p", { className: "review-comment" }, `「${gameReview.comment}」`), h("div", { className: "review-stats" }, h("span", null, `完成 ${gameReview.moveCount} 手`), h("span", null, `吃子 ${String(gameReview.captured).padStart(2, "0")}`), h("span", null, mode === "dark" ? "暗棋情報戰" : "象棋攻防戰")), h("div", { className: "mistake-box" }, h("div", { className: "mistake-label" }, "關鍵失誤"), h("strong", null, gameReview.criticalMistake), h("div", { className: "alternative-label" }, "最佳替代走法"), h("strong", { className: "alternative-copy" }, gameReview.bestAlternative)), h("div", { className: "trend-heading" }, h("span", null, "玩家棋力趨勢"), h("small", null, `最近 ${trendValues.length} 局`)), h("div", { className: "player-trend-chart" }, h("svg", { viewBox: "0 0 200 56" }, h("polyline", { points: trendPoints })))) : null,
        h("div", { className: "rail-footer" }, h("div", null, h("span", { className: "footer-stat-label" }, "已吃棋子"), h("strong", null, String(capturedCount).padStart(2, "0"))), h("div", null, h("span", { className: "footer-stat-label" }, "遊戲狀態"), h("strong", { className: "footer-live" }, h("span", { className: "status-dot" }), thinking ? " THINKING" : " READY"))),
        h("div", { className: "privacy-note" }, h(Eye, { size: 12 }), " 本機對弈 · 對局資料留在瀏覽器")
      )
      ),
    ),
    replayPanel,
    h("footer", { className: "app-footer" }, h("span", null, "棋局 / QI JU"), h("span", null, "以一局棋，靜一會心。"), h("span", { className: "footer-version" }, "v4.25 · CHINESE CHESS LAB"))
  );
}

// Web Audio and voice helpers are deliberately dependency-free.
let audioContext = null;
function playTone(kind = "move") {
  try {
    if (typeof window === "undefined") return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    audioContext ??= new AudioCtor();
    if (audioContext.state === "suspended") audioContext.resume();
    const spec = { move: [330, 0.05], capture: [180, 0.1], flip: [520, 0.07], win: [660, 0.15] }[kind] ?? [330, 0.05];
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = kind === "capture" ? "square" : "sine";
    osc.frequency.value = spec[0];
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + spec[1]);
    osc.connect(gain).connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + spec[1] + 0.02);
  } catch {}
}
function speakText(text) {
  try {
    if (typeof window === "undefined" || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-TW";
    utterance.rate = 1.02;
    window.speechSynthesis.speak(utterance);
  } catch {}
}
