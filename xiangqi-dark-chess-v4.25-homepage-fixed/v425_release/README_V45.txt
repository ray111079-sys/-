棋局 AI 棋局實驗室 v4.6

使用：雙擊 START_WEB.cmd 或 啟動網頁版.bat。
不要直接雙擊 index.html。

v4.6 修正：
- React / ReactDOM 改用 UMD 全域版本 + 本地 shim，避免重複 React instance。
- 移除 importmap 對 esm.sh 的 React module 依賴。
- 保留遊戲功能與既有啟動器。
