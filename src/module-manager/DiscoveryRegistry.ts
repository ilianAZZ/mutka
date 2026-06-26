import { probeManifest } from "./probeManifest";
import { githubSource } from "./githubSource";
import type {
  DiscoveryQuery,
  DiscoveryResult,
  ModuleDiscoverySource,
  ModuleListing,
  ResolvedModule,
} from "./types";

// =============================================================================
// DISCOVERY REGISTRY — the seam that makes module discovery pluggable. Sources
// (GitHub today; GitLab / local folder / a private registry tomorrow) register
// here; the manager + UI talk only to the registry, never to a specific source.
//
// The registry only FINDS and FETCHES modules. The core still owns load /
// install / unload: `resolve()` fetches a listing's source and validates it in a
// throwaway worker, and ModuleManager writes + activates it. A source can lie in
// its metadata but cannot bypass the probe + the permission gateway.
// =============================================================================

/** Apply the client-side filters a source may not have applied itself. */
function matchesFilters(listing: ModuleListing, query: DiscoveryQuery): boolean {
  if (query.permissions?.length) {
    const has = new Set(listing.permissions);
    if (!query.permissions.every((p) => has.has(p))) return false;
  }
  if (query.tags?.length) {
    const tags = new Set(listing.tags ?? []);
    if (!query.tags.every((t) => tags.has(t))) return false;
  }
  return true;
}

class DiscoveryRegistryClass {
  private sources = new Map<string, ModuleDiscoverySource>();

  constructor() {
    this.register(githubSource); // the built-in source
  }

  register(source: ModuleDiscoverySource): void {
    this.sources.set(source.id, source);
  }

  unregister(id: string): void {
    this.sources.delete(id);
  }

  /** Every registered source, for labels and source pickers. */
  list(): ModuleDiscoverySource[] {
    return [...this.sources.values()];
  }

  /** Human label for a source id (falls back to the id). */
  labelFor(sourceId: string): string {
    return this.sources.get(sourceId)?.label ?? sourceId;
  }

  /**
   * Query one page across all sources and merge. Filters not applied by a source
   * are enforced here. `nextPage` is set when ANY source reports more results
   * (exact with a single source; a heuristic with several).
   */
  async discover(query: DiscoveryQuery): Promise<DiscoveryResult> {
    const results = await Promise.allSettled(this.list().map((s) => s.discover(query)));
    const listings: ModuleListing[] = [];
    let nextPage: number | undefined;
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      listings.push(...r.value.listings.filter((l) => matchesFilters(l, query)));
      if (r.value.nextPage !== undefined) nextPage = r.value.nextPage;
    }
    return { listings, nextPage };
  }

  /** Fetch + validate a listing's source so it's ready to install. */
  async resolve(listing: ModuleListing): Promise<ResolvedModule> {
    const source = this.sources.get(listing.sourceId);
    if (!source) throw new Error(`Unknown discovery source "${listing.sourceId}".`);
    const code = await source.fetchSource(listing.ref);
    const manifest = await probeManifest(code); // validate + authoritative metadata
    return { listing, source: code, manifest };
  }
}

export const DiscoveryRegistry = new DiscoveryRegistryClass();
