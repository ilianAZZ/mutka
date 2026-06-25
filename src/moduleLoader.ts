import { invoke } from "@tauri-apps/api/core";
import { SandboxHost } from "./core/sandbox/SandboxHost";
import { LocalHost } from "./core/sandbox/LocalHost";
import type { SandboxModuleDef } from "./core/sandbox/defineModule";

interface UserModuleEntry {
  id: string;
  entryPath: string;
}

/**
 * Load community modules installed in ~/.macows/modules/<id>/index.js.
 *
 * SECURITY MODEL: community code is UNTRUSTED. Unlike built-in modules (which
 * run in-process), each community module is loaded into an isolated Web Worker
 * via SandboxHost — no DOM, no `invoke`, no reference to the core. It reaches
 * the system only through permission-checked capability calls. A module that
 * did not declare a permission physically cannot use it.
 *
 * Community modules are plain ESM files that `export default defineModule({...})`.
 * Call once at startup after loadBuiltinSandboxModules so built-in open handlers
 * (priority 0) are registered before community overrides.
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
      const host = new SandboxHost(source);
      await host.register();
    } catch (err) {
      console.error(`[moduleLoader] Failed to load sandboxed module "${entry.id}":`, err);
    }
  }
}

// Built-in sandbox modules: trusted, written in the new defineModule format, run
// in-process via LocalHost through the SAME permission gateway as community ones.
const builtinSandboxFiles = import.meta.glob<{ default: SandboxModuleDef }>(
  "./sandbox-builtins/*.ts",
  { eager: true }
);

/** Register every built-in sandbox module. Call once at startup. */
export async function loadBuiltinSandboxModules(): Promise<void> {
  for (const mod of Object.values(builtinSandboxFiles)) {
    const def = mod.default;
    if (!def || typeof def.id !== "string") continue;
    try {
      await new LocalHost(def).register();
    } catch (err) {
      console.error(`[moduleLoader] Failed to load built-in sandbox module "${def.id}":`, err);
    }
  }
}

// Dev-only: load community modules from the repo's ./dev-modules folder instead
// of ~/.macows/modules, so the isolated worker path is testable in `tauri dev`
// without installing anything. `?raw` gives the file source as a string.
const devModuleSources = import.meta.glob<string>(
  "../dev-modules/*/index.js",
  { query: "?raw", import: "default", eager: true }
);

/** Load repo-local dev community modules through the isolated worker runtime. */
export async function loadDevModules(): Promise<void> {
  if (!import.meta.env.DEV) return;
  for (const [path, source] of Object.entries(devModuleSources)) {
    try {
      await new SandboxHost(source).register();
    } catch (err) {
      console.error(`[moduleLoader] Failed to load dev module "${path}":`, err);
    }
  }
}
