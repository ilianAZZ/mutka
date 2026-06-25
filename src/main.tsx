import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ThemeManager } from "./core/theme-manager/ThemeManager";
import "./styles/tokens.css";
import "./styles/base.css";

// Initialize theme before first render to avoid flash of wrong theme
ThemeManager.get();

// On macOS the window has native NSVisualEffect vibrancy (see lib.rs). Flag it so the
// app shell can go transparent and let that real blurred material show through the glass
// panels. Other platforms keep an opaque fallback background.
if (navigator.userAgent.includes("Macintosh")) {
  document.documentElement.dataset.vibrancy = "on";
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
