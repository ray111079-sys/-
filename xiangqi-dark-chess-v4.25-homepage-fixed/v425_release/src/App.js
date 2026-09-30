import React from "./react-shim.js";
import { GameCanvas } from "./components/GameCanvas.js";
import Home from "./pages/Home.js";

function StartPage({ onStart }) {
  return React.createElement("main", { className: "start-page" },
    React.createElement("div", { className: "start-topline" },
      React.createElement("span", { className: "start-mark" }, "棋"),
      React.createElement("span", null, "東方棋院 · 棋局實驗室")
    ),
    React.createElement("section", { className: "start-hero" },
      React.createElement("div", { className: "start-eyebrow" }, "QI JU · CHINESE CHESS LAB"),
      React.createElement("h1", null, "棋局", React.createElement("span", null, "·"), " 象棋／暗棋"),
      React.createElement("p", null, "選擇遊戲開始。中國象棋與暗棋集中在同一個棋局實驗室。"),
      React.createElement("div", { className: "game-choice-grid" },
        React.createElement("button", { className: "game-choice-card xiangqi-choice", onClick: () => onStart("xiangqi") },
          React.createElement("span", { className: "choice-symbol" }, "象"),
          React.createElement("span", { className: "choice-copy" },
            React.createElement("strong", null, "中國象棋"),
            React.createElement("small", null, "完整象棋規則 · 紅先黑後"),
            React.createElement("em", null, "開始對弈 →")
          )
        ),
        React.createElement("button", { className: "game-choice-card dark-choice", onClick: () => onStart("dark") },
          React.createElement("span", { className: "choice-symbol dark" }, "暗"),
          React.createElement("span", { className: "choice-copy" },
            React.createElement("strong", null, "暗棋"),
            React.createElement("small", null, "標準暗棋 · 可選斜馬衝車"),
            React.createElement("em", null, "開始對弈 →")
          )
        )
      )
    ),
    React.createElement("section", { className: "start-features" },
      React.createElement("div", null, React.createElement("b", null, "AI"), React.createElement("span", null, "五級難度與可調速度")),
      React.createElement("div", null, React.createElement("b", null, "分析"), React.createElement("span", null, "勝率 · 局勢講評 · AI 候選")),
      React.createElement("div", null, React.createElement("b", null, "工具"), React.createElement("span", null, "復盤 · 悔棋 · 儲存／載入"))
    ),
    React.createElement("footer", { className: "start-footer" },
      React.createElement("span", null, "v4.25 · 基於 v4.11 架構"),
      React.createElement("span", null, "選擇遊戲後即可進入棋盤")
    )
  );
}

export default function App() {
  const [screen, setScreen] = React.useState("home");
  const [initialMode, setInitialMode] = React.useState("xiangqi");
  if (screen === "game") {
    return React.createElement(GameCanvas, null,
      React.createElement(Home, { initialMode, onBackToHome: () => setScreen("home") })
    );
  }
  return React.createElement(GameCanvas, null,
    React.createElement(StartPage, {
      onStart: (nextMode) => { setInitialMode(nextMode); setScreen("game"); }
    })
  );
}
