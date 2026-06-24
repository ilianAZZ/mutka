import { useState, useEffect, useCallback } from "react";
import type { ThemePreference } from "../../core/theme-manager/theme-manager.types";
import { ThemeManager } from "../../core/theme-manager/ThemeManager";
import "./SettingsPanel.css";

interface SettingsPanelProps {
  onClose: () => void;
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Auto" },
  { value: "light",  label: "Light" },
  { value: "dark",   label: "Dark" },
];

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [theme, setTheme] = useState<ThemePreference>(ThemeManager.get());

  const handleTheme = useCallback((pref: ThemePreference) => {
    setTheme(pref);
    ThemeManager.set(pref);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

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
          </section>
        </div>
      </aside>
    </>
  );
}
