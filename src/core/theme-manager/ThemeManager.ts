import type { ThemePreference } from "./theme-manager.types";
import { EventBus } from "../event-bus/EventBus";
import { Events } from "../event-bus/events";

const STORAGE_KEY = "mutka.theme";

function getSystemTheme(): "dark" | "light" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyResolved(resolved: "dark" | "light"): void {
  document.documentElement.setAttribute("data-theme", resolved);
}

class ThemeManagerClass {
  private preference: ThemePreference = "system";
  private mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    this.preference = saved ?? "system";

    // Apply immediately on construction (before first paint)
    applyResolved(this.getResolved());

    // Re-apply when OS theme changes (only relevant when preference is "system")
    this.mediaQuery.addEventListener("change", () => {
      if (this.preference === "system") {
        const resolved = this.getResolved();
        applyResolved(resolved);
        EventBus.emit(Events.Theme.changed, { preference: this.preference, resolved });
      }
    });
  }

  get(): ThemePreference {
    return this.preference;
  }

  set(pref: ThemePreference): void {
    this.preference = pref;
    localStorage.setItem(STORAGE_KEY, pref);
    const resolved = this.getResolved();
    applyResolved(resolved);
    EventBus.emit(Events.Theme.changed, { preference: pref, resolved });
  }

  /** Resolves "system" to the actual current theme. */
  getResolved(): "dark" | "light" {
    if (this.preference === "system") return getSystemTheme();
    return this.preference;
  }
}

export const ThemeManager = new ThemeManagerClass();
