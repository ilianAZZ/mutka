import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ThemeManager } from "./core/ThemeManager";
import "./styles/tokens.css";
import "./styles/base.css";

// Initialize theme before first render to avoid flash of wrong theme
ThemeManager.get();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
