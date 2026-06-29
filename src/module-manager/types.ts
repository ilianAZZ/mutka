import type { ModulePermission } from "../core/module-registry/module-registry.types";
import type { SandboxManifest, ModuleAuthor } from "../core/sandbox/protocol";
import type { LocalHost } from "../core/sandbox/LocalHost";
import type { SandboxHost } from "../core/sandbox/SandboxHost";

// =============================================================================
// MODULE MANAGER — shared types for the install / enable / disable lifecycle.
//
// The manager lives at the app layer (NOT core) because it calls `invoke` to
// reach the new Rust commands, exactly like moduleLoader did. It tracks every
// module's live state so the UI can toggle/install/delete WHILE the app runs.
// =============================================================================

/** Where a module came from. Built-in/dev ship in the bundle; community is on disk. */
export type ModuleSource = "builtin" | "dev" | "community";

/** Only on-disk (community) modules can be removed — bundled ones ship in the app. */
export function canUninstall(source: ModuleSource): boolean {
  return source === "community";
}

/**
 * Synthetic discovery-source id for a listing that has no real remote source —
 * a local file or a module-proposed install. It is never registered with the
 * DiscoveryRegistry; the source is already in hand, so nothing resolves it.
 */
export const LOCAL_SOURCE_ID = "local";

/** Runtime state of a tracked module. */
export type ModuleStatus = "active" | "disabled" | "error";

/** A live host instance — both runtimes expose `.manifest` after register(). */
export type ModuleHost = LocalHost | SandboxHost;

/**
 * A module the manager knows how to (re)create. Built once per source at startup;
 * `probe` reads its manifest without activating, `activate` creates + registers
 * the live host. Community descriptors are also synthesized after an install.
 */
export interface ModuleDescriptor {
  id: string;
  source: ModuleSource;
  /** Read the manifest without registering (builtin: from def; worker: throwaway probe). */
  probe: () => Promise<SandboxManifest>;
  /** Create + register the live host, returning it (host.manifest is then set). */
  activate: () => Promise<ModuleHost>;
}

/** A module as the manager + UI see it. `host` is present only when active. */
export interface ManagedModule {
  id: string;
  name: string;
  version: string;
  description?: string;
  /** Display image (data: URI or https URL) from the manifest, if any. */
  icon?: string;
  /** Author from the manifest, if any (avatar/profile derived in the UI). */
  author?: ModuleAuthor;
  permissions: ModulePermission[];
  source: ModuleSource;
  status: ModuleStatus;
  /** Whether the user has it enabled (independent of load success). */
  enabled: boolean;
  /** Populated when status is "error" (failed to load/activate). */
  error?: string;
  /** Install provenance (community modules installed from a catalog). */
  installed?: InstalledMeta;
  /** The live runtime — internal; not for rendering. */
  host?: ModuleHost;
  /** The descriptor used to (re)activate it. Internal. */
  descriptor: ModuleDescriptor;
}

/** Where an installed community module came from. Extensible for future sources. */
export interface InstalledMeta {
  /** Discovery source id it was installed from ("github", …). */
  sourceId: string;
  /** Opaque, provider-encoded locator used to re-fetch the source. */
  ref: string;
  /** Human-readable origin for display (e.g. "owner/repo"). */
  origin?: string;
  /** ISO timestamp recorded at install time (stamped by the caller). */
  installedAt: string;
}

/** Persisted config (~/.mutka/config.json). The frontend owns this schema. */
export interface ModuleConfig {
  version: 1;
  /** Module ids the user has disabled. */
  disabled: string[];
  /** Install metadata, keyed by module id. */
  installed: Record<string, InstalledMeta>;
}

// ─── Discovery ────────────────────────────────────────────────────────────────
// The discovery types + registry now live in core (the module runtimes type their
// handlers against them). Re-exported here so existing importers keep working.
export type {
  CatalogAuthor,
  ModuleListing,
  DiscoveryQuery,
  DiscoveryResult,
  ModuleDiscoverySource,
  ResolvedModule,
} from "../core/discovery/types";
