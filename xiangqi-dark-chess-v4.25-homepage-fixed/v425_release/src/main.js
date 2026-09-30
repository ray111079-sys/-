import React from "./react-shim.js";
import { createRoot } from "./react-dom-shim.js";
import App from "./App.js";

const root = document.getElementById("root");
if (!root) throw new Error("找不到 root 容器");
createRoot(root).render(React.createElement(App));
