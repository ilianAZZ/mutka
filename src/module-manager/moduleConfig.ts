import { invoke } from "@tauri-apps/api/core";
import type { ModuleConfig, InstalledMeta } from "./types";

// =============================================================================
// MODULE CONFIG — load/save ~/.mutka/config.json (the disabled-set + install
// metadata). Reaches the Rust read_module_config / write_module_config commands.
// This file is the ONLY one in module-manager that owns the persisted schema.
// =============================================================================

const EMPTY: ModuleConfig = { version: 1, disabled: [], installed: {} };

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === "string");
}

/** Coerce arbitrary parsed JSON into a valid ModuleConfig (never throws). */
function normalize(raw: unknown): ModuleConfig {
  if (typeof raw !== "object" || raw === null) return { ...EMPTY };
  const obj = raw as Record<string, unknown>;
  return {
    version: 1,
    disabled: isStringArray(obj.disabled) ? obj.disabled : [],
    installed:
      typeof obj.installed === "object" && obj.installed !== null
        ? (obj.installed as Record<string, InstalledMeta>)
        : {},
  };
}

/** Read the config, returning defaults if missing or malformed. */
export async function loadConfig(): Promise<ModuleConfig> {
  let text: string;
  try {
    text = await invoke<string>("read_module_config");
  } catch (err) {
    console.error("[moduleConfig] read failed:", err);
    return { ...EMPTY };
  }
  if (!text.trim()) return { ...EMPTY };
  try {
    return normalize(JSON.parse(text));
  } catch (err) {
    console.error("[moduleConfig] parse failed, using defaults:", err);
    return { ...EMPTY };
  }
}

/** Persist the config as pretty JSON. */
export async function saveConfig(config: ModuleConfig): Promise<void> {
  await invoke("write_module_config", { content: JSON.stringify(config, null, 2) });
}
