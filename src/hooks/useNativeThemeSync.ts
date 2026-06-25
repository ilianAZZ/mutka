import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ThemeManager } from "../core/theme-manager/ThemeManager";
import { EventBus } from "../core/event-bus/EventBus";
import { Events } from "../core/event-bus/events";

/**
 * Keeps the native window appearance in sync with the resolved app theme. macOS
 * NSVisualEffect vibrancy follows the WINDOW's appearance, not our data-theme —
 * without this, a dark app theme on a light-appearance system shows a light
 * blurred material through the glass. Pushing the resolved theme to the native
 * window makes the vibrancy dark in dark mode, so panes read as real glass.
 */
export function useNativeThemeSync(): void {
  useEffect(() => {
    const sync = (resolved: "dark" | "light") => {
      getCurrentWindow().setTheme(resolved).catch(() => { /* non-macOS / no window */ });
    };
    sync(ThemeManager.getResolved());
    return EventBus.on(Events.Theme.changed, ({ resolved }) => sync(resolved));
  }, []);
}
