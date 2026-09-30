import React, { useEffect, useRef } from "../react-shim.js";

export function GameCanvas({ children }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = "#07101f";
      ctx.fillRect(0, 0, rect.width, rect.height);
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, []);

  return React.createElement("div", { className: "game-shell" },
    React.createElement("canvas", { ref: canvasRef, className: "game-canvas", "aria-hidden": "true" }),
    React.createElement("div", { className: "game-content" }, children)
  );
}
