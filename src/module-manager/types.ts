import type { ModulePermission } from "../core/module-registry/module-registry.types";
import type { SandboxManifest } from "../core/sandbox/protocol";
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
  /** "owner/repo" on GitHub. */
  repo: string;
  /** Branch or tag the source was fetched from. */
  ref: string;
  /** Path of the entry file within the repo (index.js, or from mutka.config.json). */
  entry: string;
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

// ─── Catalog (the installable-module source, GitHub today) ────────────────────

/** One installable repository surfaced by a CatalogSource. */
export interface CatalogEntry {
  /** "owner/repo". */
  repo: string;
  name: string;
  description?: string;
  owner: string;
  stars: number;
  defaultBranch: string;
  htmlUrl: string;
}

/** One module resolved from a catalog entry, downloaded + validated, ready to install. */
export interface ResolvedModule {
  /** Authoritative id from the probed manifest. */
  id: string;
  manifest: SandboxManifest;
  /** The downloaded ESM source. */
  source: string;
  /** Path within the repo this came from. */
  entry: string;
}

/**
 * The installable-module source. GitHub is the source of truth today; a future
 * source (a DB of GitHub links, a private registry) implements this same shape.
 */
export interface CatalogSource {
  /** Human label, e.g. "GitHub". */
  readonly label: string;
  /** Search the catalog. An empty query returns the default listing. */
  search(query: string): Promise<CatalogEntry[]>;
  /**
   * Download + validate every module a catalog entry ships (one repo may carry
   * several via mutka.config.json). Each is loaded in a throwaway worker; a
   * module that fails to load is rejected, not returned.
   */
  resolve(entry: CatalogEntry): Promise<ResolvedModule[]>;
}
