import { invoke } from "@tauri-apps/api/core";
import { LocalHost } from "../core/sandbox/LocalHost";
import { SandboxHost } from "../core/sandbox/SandboxHost";
import type { SandboxModuleDef } from "../core/sandbox/defineModule";
import { probeManifest } from "./probeManifest";
import type { ModuleDescriptor } from "./types";

// =============================================================================
// DESCRIPTORS — the three module sources, each yielding ModuleDescriptors the
// ModuleManager can probe (read manifest) or activate (create + register a live
// host). This replaces the old moduleLoader's three loader functions: it owns
// the import.meta.glob declarations and the community invoke() calls, but does
// NOT register anything itself — the manager decides what to activate.
// =============================================================================

interface UserModuleEntry {
  id: string;
  entryPath: string;
}

// Built-in sandbox modules: trusted, in-process via LocalHost. The manifest is
// derived from the def in LocalHost's constructor (no setup), so probing is free.
const builtinFiles = import.meta.glob<{ default: SandboxModuleDef }>(
  "../sandbox-builtins/*.ts",
  { eager: true }
);

/** Descriptors for every built-in module. */
function builtinDescriptors(): ModuleDescriptor[] {
  const out: ModuleDescriptor[] = [];
  for (const mod of Object.values(builtinFiles)) {
    const def = mod.default;
    if (!def || typeof def.id !== "string") continue;
    out.push({
      id: def.id,
      source: "builtin",
      probe: async () => new LocalHost(def).manifest,
      activate: async () => {
        const host = new LocalHost(def);
        await host.register();
        return host;
      },
    });
  }
  return out;
}

// Dev-only community modules from the repo's ./dev-modules folder, exercised
// through the isolated worker runtime. The folder name is the module id.
const devSources = import.meta.glob<string>("../../dev-modules/*/index.js", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** Descriptors for repo-local dev modules (DEV builds only). */
function devDescriptors(): ModuleDescriptor[] {
  if (!import.meta.env.DEV) return [];
  const out: ModuleDescriptor[] = [];
  for (const [path, source] of Object.entries(devSources)) {
    const id = path.split("/").slice(-2)[0] ?? path;
    out.push(makeWorkerDescriptor(id, "dev", async () => source));
  }
  return out;
}

/** Descriptors for installed community modules (~/.mutka/modules/<id>/index.js). */
async function communityDescriptors(): Promise<ModuleDescriptor[]> {
  let entries: UserModuleEntry[];
  try {
    entries = await invoke<UserModuleEntry[]>("list_user_modules");
  } catch (err) {
    console.error("[descriptors] list_user_modules failed:", err);
    return [];
  }
  return entries.map((entry) =>
    makeWorkerDescriptor(entry.id, "community", () =>
      invoke<string>("read_module_file", { path: entry.entryPath })
    )
  );
}

/**
 * A descriptor backed by an isolated worker (dev + community). `readSource`
 * fetches the ESM once and caches it, so probe-then-activate reads disk once.
 */
export function makeWorkerDescriptor(
  id: string,
  source: "dev" | "community",
  readSource: () => Promise<string>
): ModuleDescriptor {
  let cached: Promise<string> | null = null;
  const load = (): Promise<string> => (cached ??= readSource());
  return {
    id,
    source,
    probe: async () => probeManifest(await load()),
    activate: async () => {
      const host = new SandboxHost(await load());
      await host.register();
      return host;
    },
  };
}

/** Gather descriptors from all sources (built-in first, so they register at base priority). */
export async function collectDescriptors(): Promise<ModuleDescriptor[]> {
  return [...builtinDescriptors(), ...devDescriptors(), ...(await communityDescriptors())];
}
