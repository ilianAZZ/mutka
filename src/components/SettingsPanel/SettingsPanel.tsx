import { useState, useEffect, useCallback, useRef } from "react";
import type { ThemePreference } from "../../core/theme-manager/theme-manager.types";
import { ThemeManager } from "../../core/theme-manager/ThemeManager";
import { ShortcutManager, type KeyBinding } from "../../core/shortcut-manager/ShortcutManager";
import { ModuleRegistry } from "../../core/module-registry/ModuleRegistry";
import { ViewStore } from "../../core/stores/ViewStore";
import { WebDavAccounts } from "./WebDavAccounts";
import "./SettingsPanel.css";

interface SettingsPanelProps {
  onClose: () => void;
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Auto" },
  { value: "light",  label: "Light" },
  { value: "dark",   label: "Dark" },
];

const MODIFIER_KEYS = new Set(["Meta", "Shift", "Control", "Alt"]);

function formatShortcut(raw: string | undefined): string {
  if (!raw) return "—";
  return raw
    .replace("meta", "⌘")
    .replace("shift", "⇧")
    .replace("alt", "⌥")
    .replace("ctrl", "⌃")
    .replace("backspace", "⌫")
    .replace("space", "␣")
    .replace(/\+/g, "");
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [theme, setTheme] = useState<ThemePreference>(ThemeManager.get());
  const [showHidden, setShowHidden] = useState<boolean>(ViewStore.showHidden);
  const [bindings, setBindings] = useState<KeyBinding[]>(() => ShortcutManager.listBindings());
  const [capturing, setCapturing] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const labels = useRef<Map<string, string>>(
    new Map(ModuleRegistry.getActions().map((a) => [a.id, a.label]))
  );

  const refreshBindings = useCallback(() => setBindings(ShortcutManager.listBindings()), []);

  const handleTheme = useCallback((pref: ThemePreference) => {
    setTheme(pref);
    ThemeManager.set(pref);
  }, []);

  const handleShowHidden = useCallback((value: boolean) => {
    setShowHidden(value);
    ViewStore.setShowHidden(value);
  }, []);

  // Capture the next key combo while rebinding an action.
  useEffect(() => {
    if (!capturing) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") { setCapturing(null); return; }
      if (MODIFIER_KEYS.has(e.key)) return; // wait for a non-modifier key
      ShortcutManager.setOverride(capturing, ShortcutManager.eventToShortcut(e));
      setCapturing(null);
      refreshBindings();
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [capturing, refreshBindings]);

  // Escape closes the panel (unless we're capturing a key, handled above).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !capturing) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, capturing]);

  const resetOne = useCallback((actionId: string) => {
    ShortcutManager.setOverride(actionId, null);
    refreshBindings();
  }, [refreshBindings]);

  const resetAll = useCallback(() => {
    ShortcutManager.resetOverrides();
    refreshBindings();
  }, [refreshBindings]);

  const exportBindings = useCallback(() => {
    const blob = new Blob([ShortcutManager.exportOverrides()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "macows-keybinds.json";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const importBindings = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      ShortcutManager.importOverrides(await file.text());
      refreshBindings();
    } catch (err) {
      console.error("[SettingsPanel] import keybinds failed:", err);
    }
    e.target.value = "";
  }, [refreshBindings]);

  return (
    <>
      <div className="settings-backdrop" onClick={onClose} />
      <aside className="settings-panel">
        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="settings-close" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="settings-body">
          <section className="settings-section">
            <h2 className="settings-section-title">Appearance</h2>
            <div className="settings-row">
              <span className="settings-label">Theme</span>
              <div className="theme-picker" role="group" aria-label="Theme">
                {THEME_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    className={`theme-btn${theme === value ? " theme-btn--active" : ""}`}
                    onClick={() => handleTheme(value)}
                    aria-pressed={theme === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-row">
              <span className="settings-label">Hidden files</span>
              <div className="theme-picker" role="group" aria-label="Hidden files">
                <button
                  className={`theme-btn${!showHidden ? " theme-btn--active" : ""}`}
                  onClick={() => handleShowHidden(false)}
                  aria-pressed={!showHidden}
                >
                  Hide
                </button>
                <button
                  className={`theme-btn${showHidden ? " theme-btn--active" : ""}`}
                  onClick={() => handleShowHidden(true)}
                  aria-pressed={showHidden}
                >
                  Show
                </button>
              </div>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <h2 className="settings-section-title">Keyboard Shortcuts</h2>
              <div className="keybind-actions">
                <button className="keybind-btn" onClick={exportBindings} title="Export to a JSON file">Export</button>
                <button className="keybind-btn" onClick={() => fileInputRef.current?.click()} title="Import from a JSON file">Import</button>
                <button className="keybind-btn" onClick={resetAll} title="Reset all to defaults">Reset all</button>
                <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={importBindings} />
              </div>
            </div>

            <div className="keybind-list">
              {bindings.map((b) => (
                <div key={b.actionId} className="keybind-row">
                  <span className="keybind-label">{labels.current.get(b.actionId) ?? b.actionId}</span>
                  <button
                    className={`keybind-chip${capturing === b.actionId ? " keybind-chip--capturing" : ""}${b.isCustom ? " keybind-chip--custom" : ""}`}
                    onClick={() => setCapturing(b.actionId)}
                    title="Click, then press a new shortcut (Esc to cancel)"
                  >
                    {capturing === b.actionId ? "Press keys…" : formatShortcut(b.shortcut)}
                  </button>
                  {b.isCustom && (
                    <button className="keybind-reset" onClick={() => resetOne(b.actionId)} title="Reset to default">↩</button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <WebDavAccounts />
        </div>
      </aside>
    </>
  );
}
