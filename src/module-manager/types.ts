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

// ─── Discovery (pluggable module-discovery sources) ───────────────────────────

/** Author display info, resolved to concrete avatar/profile URLs. */
export interface CatalogAuthor {
  name?: string;
  /** GitHub login (user or org). */
  github?: string;
  /** Avatar image URL (derived from the login). */
  avatarUrl?: string;
  /** Profile/org page URL (derived from the login). */
  profileUrl?: string;
}

/**
 * A module surfaced by a discovery source — metadata only, no code yet. The core
 * fetches the source (via the source's `fetchSource(ref)`) and probes it only at
 * install time. `permissions` here are advisory (for filtering/preview); the
 * authoritative set comes from probing the fetched source.
 */
export interface ModuleListing {
  /** Discovery source that surfaced this (its `id`). */
  sourceId: string;
  /** Opaque, provider-encoded locator passed back to `fetchSource`. */
  ref: string;
  id: string;
  name: string;
  version: string;
  description?: string;
  /** Display image (data: URI or https URL). */
  icon?: string;
  /** Author shown on the card (login defaults to the repo owner). */
  author: CatalogAuthor | null;
  /** Advisory permission preview (authoritative set is re-derived at install). */
  permissions: ModulePermission[];
  tags?: string[];
  /** External page for the module (repo URL, etc.). */
  homepageUrl?: string;
}

/** Filters + pagination passed to a discovery source. */
export interface DiscoveryQuery {
  text?: string;
  permissions?: ModulePermission[];
  tags?: string[];
  extension?: string;
  /** 1-based page number. */
  page?: number;
  perPage?: number;
}

/** A page of discovery results. */
export interface DiscoveryResult {
  listings: ModuleListing[];
  /** Next page number, or undefined when there are no more results. */
  nextPage?: number;
}

/**
 * A pluggable module-discovery source. GitHub is the built-in one; a future
 * source (GitLab, a local folder, a private registry) implements this same shape
 * and registers with the DiscoveryRegistry — the manager + UI don't change.
 */
export interface ModuleDiscoverySource {
  readonly id: string;
  readonly label: string;
  /** Find modules matching the query (one page). */
  discover(query: DiscoveryQuery): Promise<DiscoveryResult>;
  /** Return the ESM source for a listing's `ref` (however this source fetches). */
  fetchSource(ref: string): Promise<string>;
}

/** A listing whose source has been fetched + validated, ready to install. */
export interface ResolvedModule {
  listing: ModuleListing;
  /** The downloaded ESM source. */
  source: string;
  /** The probed manifest (authoritative id + permissions). */
  manifest: SandboxManifest;
}
