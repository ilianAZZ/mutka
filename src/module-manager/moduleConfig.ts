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

function isInstalledMeta(x: unknown): x is InstalledMeta {
  if (typeof x !== "object" || x === null) return false;
  const m = x as Record<string, unknown>;
  return typeof m.sourceId === "string" && typeof m.ref === "string" && typeof m.installedAt === "string";
}

/** Keep only well-formed install entries, so a corrupt config.json can't inject
 *  a bogus InstalledMeta the rest of the app trusts. */
function normalizeInstalled(x: unknown): Record<string, InstalledMeta> {
  if (typeof x !== "object" || x === null) return {};
  const out: Record<string, InstalledMeta> = {};
  for (const [id, meta] of Object.entries(x as Record<string, unknown>)) {
    if (isInstalledMeta(meta)) out[id] = meta;
  }
  return out;
}

/** Coerce arbitrary parsed JSON into a valid ModuleConfig (never throws). */
function normalize(raw: unknown): ModuleConfig {
  if (typeof raw !== "object" || raw === null) return { ...EMPTY };
  const obj = raw as Record<string, unknown>;
  return {
    version: 1,
    disabled: isStringArray(obj.disabled) ? obj.disabled : [],
    installed: normalizeInstalled(obj.installed),
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
