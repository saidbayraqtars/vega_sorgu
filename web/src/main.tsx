import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./index.css";
import { App } from "./App";

// Tema titremesini önle: yerel tercihi ilk çizimden önce uygula
try {
  const t = (JSON.parse(localStorage.getItem("vb_tercih") || "{}") as { tema?: string }).tema;
  const koyu = t === "koyu" || ((!t || t === "sistem") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", koyu);
} catch {
  /* yok say */
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
