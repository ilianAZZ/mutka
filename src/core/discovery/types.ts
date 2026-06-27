import type { ModulePermission } from "../module-registry/module-registry.types";
import type { SandboxManifest } from "../sandbox/protocol";

// =============================================================================
// DISCOVERY TYPES — the contract between module-contributed discovery sources,
// the registry, and the UI. These live in core because the module runtimes
// (LocalHost/SandboxHost) type their discovery handlers against them.
// =============================================================================

/** Author display info, resolved to concrete avatar/profile URLs by a source. */
export interface CatalogAuthor {
  name?: string;
  /** GitHub login (user or org). */
  github?: string;
  avatarUrl?: string;
  profileUrl?: string;
}

/**
 * A module surfaced by a discovery source — metadata only, no code yet. The core
 * fetches the source (via the source's `fetchSource(ref)`) and probes it at
 * install. `permissions` are advisory (filtering/preview); the authoritative set
 * comes from probing the fetched source.
 */
export interface ModuleListing {
  /** Discovery source that surfaced this (its declared `id`). */
  sourceId: string;
  /** Opaque, source-encoded locator passed back to `fetchSource`. */
  ref: string;
  id: string;
  name: string;
  version: string;
  description?: string;
  /** Display image (data: URI or https URL). */
  icon?: string;
  author?: CatalogAuthor | null;
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
 * A discovery source as the registry holds it — backed by a contributing
 * module's runtime (in-process for built-ins, worker RPC for community). A module
 * declares `discoverySources: [{ id, label }]` and serves `discover`/`fetchSource`
 * via `host.onDiscover` / `host.onFetchSource`.
 */
export interface ModuleDiscoverySource {
  readonly id: string;
  readonly label: string;
  discover(query: DiscoveryQuery): Promise<DiscoveryResult>;
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
