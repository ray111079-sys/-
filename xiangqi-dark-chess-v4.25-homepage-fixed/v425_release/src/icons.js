import { createElement as h } from "./react-shim.js";

function Icon({ name, size = 24, strokeWidth = 2, className = "", ...rest }) {
  const glyphs = {
    BarChart3: ["M4 19V5", "M4 12h4", "M8 19V9", "M12 19V3", "M16 19V7", "M20 19V11"],
    CircleHelp: ["M12 17h.01", "M9.5 9a2.5 2.5 0 1 1 4 2c-.9.65-1.5 1.05-1.5 2"],
    ChevronLeft: ["M15 18l-6-6 6-6"],
    ChevronRight: ["M9 18l6-6-6-6"],
    Crown: ["M3 7l4 4 5-7 5 7 4-4-2 10H5L3 7z"],
    Eye: ["M2 12s3.5-5 10-5 10 5 10 5-3.5 5-10 5S2 12 2 12z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
    EyeOff: ["M3 3l18 18", "M10.6 10.6a2 2 0 0 0 2.8 2.8", "M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18.2 18.2 0 0 1-3 3.5", "M6.6 6.6C3.8 8.1 2 12 2 12s3.5 7 10 7a11 11 0 0 0 3.1-.4"],
    Gauge: ["M5 20a9 9 0 1 1 14 0", "M12 13l4-4"],
    History: ["M3 12a9 9 0 1 0 3-6.7", "M3 4v5h5", "M12 7v5l3 2"],
    Lightbulb: ["M9 18h6", "M10 22h4", "M8 14a6 6 0 1 1 8 0c-1.2 1-2 2.1-2 4h-4c0-1.9-.8-3-2-4z"],
    Mic2: ["M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z", "M19 10v2a7 7 0 0 1-14 0v-2", "M12 19v3", "M8 22h8"],
    Play: ["M8 5v14l11-7z"],
    RotateCcw: ["M3 12a9 9 0 1 0 3-6.7", "M3 4v5h5"],
    Settings2: ["M3 6h18", "M3 12h18", "M3 18h18", "M8 4v4", "M16 10v4", "M11 16v4"],
    Sparkles: ["M12 3l1.3 4.7L18 9l-4.7 1.3L12 15l-1.3-4.7L6 9l4.7-1.3L12 3z", "M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15z"],
    Swords: ["M14.5 6.5l3-3 3 3-3 3", "M3.5 20.5l7.8-7.8", "M9.5 10.5l4-4", "M18 14l3.5 3.5-3 3-3.5-3.5", "M4 4l6.5 6.5"],
    Volume2: ["M4 10v4h4l5 4V6L8 10H4z", "M17 9a4 4 0 0 1 0 6", "M19 7a7 7 0 0 1 0 10"],
    VolumeX: ["M4 10v4h4l5 4V6L8 10H4z", "M18 9l4 6", "M22 9l-4 6"],
  };
  const paths = glyphs[name] || ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"];
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", className, "aria-hidden": true, ...rest }, ...paths.map((d, i) => h("path", { d, key: i })));
}

export const BarChart3 = (p) => h(Icon, { ...p, name: "BarChart3" });
export const CircleHelp = (p) => h(Icon, { ...p, name: "CircleHelp" });
export const ChevronLeft = (p) => h(Icon, { ...p, name: "ChevronLeft" });
export const ChevronRight = (p) => h(Icon, { ...p, name: "ChevronRight" });
export const Crown = (p) => h(Icon, { ...p, name: "Crown" });
export const Eye = (p) => h(Icon, { ...p, name: "Eye" });
export const EyeOff = (p) => h(Icon, { ...p, name: "EyeOff" });
export const Gauge = (p) => h(Icon, { ...p, name: "Gauge" });
export const History = (p) => h(Icon, { ...p, name: "History" });
export const Lightbulb = (p) => h(Icon, { ...p, name: "Lightbulb" });
export const Mic2 = (p) => h(Icon, { ...p, name: "Mic2" });
export const Play = (p) => h(Icon, { ...p, name: "Play" });
export const RotateCcw = (p) => h(Icon, { ...p, name: "RotateCcw" });
export const Settings2 = (p) => h(Icon, { ...p, name: "Settings2" });
export const Sparkles = (p) => h(Icon, { ...p, name: "Sparkles" });
export const Swords = (p) => h(Icon, { ...p, name: "Swords" });
export const Volume2 = (p) => h(Icon, { ...p, name: "Volume2" });
export const VolumeX = (p) => h(Icon, { ...p, name: "VolumeX" });
