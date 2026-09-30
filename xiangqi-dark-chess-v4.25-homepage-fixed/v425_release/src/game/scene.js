export async function createGameScene(engine, canvas) {
  const ctx = canvas?.getContext?.("2d");
  if (!ctx) return { scene: null, dispose() {} };
  const resize = () => {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#07101f";
    ctx.fillRect(0, 0, rect.width, rect.height);
  };
  resize();
  window.addEventListener("resize", resize);
  return { scene: null, dispose() { window.removeEventListener("resize", resize); } };
}
