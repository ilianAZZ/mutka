import type { MacowsModule } from "./core/types";
import { ModuleRegistry } from "./core/ModuleRegistry";

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
