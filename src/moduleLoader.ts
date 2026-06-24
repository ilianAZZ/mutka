import { invoke } from "@tauri-apps/api/core";
import type { MacowsModule } from "./core/module-registry/module-registry.types";
import { ModuleRegistry } from "./core/module-registry/ModuleRegistry";

interface UserModuleEntry {
  id: string;
  entryPath: string;
}

// Vite resolves this glob at build time — it includes every modules/*/index.ts file.
// When you add a new module folder, it is automatically discovered here on next restart.
const moduleFiles = import.meta.glob<Record<string, unknown>>(
  "./modules/*/index.ts",
  { eager: true }
);

// Core modules must be registered in this exact order.
// core.navigation must be first so its priority-0 open handlers are in place
// before any other module registers higher-priority overrides.
const CORE_ORDER = [
  "core.navigation",
  "core.clipboard",
  "core.file-ops",
  "core.mouse-navigation",
  "core.tabs",
];

function isMacowsModule(value: unknown): value is MacowsModule {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.version === "string" &&
    Array.isArray(v.actions)
  );
}

/**
 * Discover all modules via Vite glob, then register them with ModuleRegistry
 * in the correct order (core modules first, community modules after).
 *
 * Call this once at app startup before rendering the root component.
 */
export function loadModules(): void {
  const discovered = new Map<string, MacowsModule>();

  for (const exports of Object.values(moduleFiles)) {
    for (const value of Object.values(exports)) {
      if (isMacowsModule(value)) {
        if (discovered.has(value.id)) {
          console.warn(`[moduleLoader] Duplicate module id "${value.id}" — skipping second definition`);
        } else {
          discovered.set(value.id, value);
        }
      }
    }
  }

  // Register core modules in the required order
  for (const id of CORE_ORDER) {
    const mod = discovered.get(id);
    if (mod) {
      ModuleRegistry.register(mod);
      discovered.delete(id);
    }
  }

  // Register any remaining modules (e.g. community modules placed in src/modules/)
  for (const mod of discovered.values()) {
    ModuleRegistry.register(mod);
  }
}

/**
 * Load community modules installed in ~/.macows/modules/<id>/index.js.
 *
 * Each module is a pre-bundled ESM file. We read it via IPC, wrap it in a
 * Blob URL, and dynamic-import it — no asset protocol or CSP changes needed.
 *
 * Community modules use `window.__TAURI__.core.invoke` instead of
 * `@tauri-apps/api/core` because static imports are unavailable in a blob context.
 *
 * Call this once at app startup (after loadModules). It is async because it
 * reads files from disk; built-in modules are always registered first.
 */
export async function loadCommunityModules(): Promise<void> {
  let entries: UserModuleEntry[];
  try {
    entries = await invoke<UserModuleEntry[]>("list_user_modules");
  } catch (err) {
    console.error("[moduleLoader] list_user_modules failed:", err);
    return;
  }

  for (const entry of entries) {
    try {
      const source = await invoke<string>("read_module_file", { path: entry.entryPath });
      const blob = new Blob([source], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);

      try {
        // @vite-ignore — intentional dynamic import from a runtime blob URL
        const exports = await import(/* @vite-ignore */ url);
        for (const value of Object.values(exports)) {
          if (isMacowsModule(value)) {
            ModuleRegistry.register(value as MacowsModule);
          }
        }
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(`[moduleLoader] Failed to load community module "${entry.id}":`, err);
    }
  }
}
