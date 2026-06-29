import type { SandboxModuleDef } from "./defineModule";
import type { SandboxManifest } from "./protocol";

// =============================================================================
// MANIFEST FROM DEF — the SINGLE place that turns an author's module def into the
// wire `SandboxManifest`. Both runtimes use it: LocalHost (built-ins, in-process)
// and sandbox.worker (community modules, isolated). Keeping one builder means a
// new top-level contribution field is added in ONE place and can't silently work
// in one runtime but not the other.
// =============================================================================

/** Build the wire manifest from a module def, filling defaults for omitted lists. */
export function manifestFromDef(def: SandboxModuleDef): SandboxManifest {
  return {
    id: def.id,
    name: def.name ?? def.id,
    version: def.version ?? "0.0.0",
    description: def.description,
    icon: def.icon,
    author: def.author,
    tags: def.tags,
    permissions: def.permissions ?? [],
    commands: def.commands ?? [],
    openHandlers: def.openHandlers ?? [],
    sidebarItems: def.sidebarItems ?? [],
    fileSystemProviders: def.fileSystemProviders ?? [],
    fileIcons: def.fileIcons ?? [],
    columns: def.columns ?? [],
    panels: def.panels ?? [],
    settingsSections: def.settingsSections ?? [],
    discoverySources: def.discoverySources ?? [],
    moduleManagerButtons: def.moduleManagerButtons ?? [],
  };
}
