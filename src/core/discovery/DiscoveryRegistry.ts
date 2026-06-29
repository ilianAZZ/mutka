import { probeManifest } from "../sandbox/probeManifest";
import type {
  DiscoveryQuery,
  DiscoveryResult,
  ModuleDiscoverySource,
  ModuleListing,
  ResolvedModule,
} from "./types";

// =============================================================================
// DISCOVERY REGISTRY — the seam that makes module discovery a plug-in. Discovery
// sources are CONTRIBUTED BY MODULES (a module declares `discoverySources` and
// serves them over the host RPC); the runtimes register them here on load and
// drop them on unload. GitHub is just the first such module — adding GitLab / a
// local folder / a private registry means installing a module, not editing core.
//
// The registry only FINDS + FETCHES. The core still owns load/install/unload:
// `resolve()` fetches a listing's source and validates it in a throwaway worker,
// then ModuleManager writes + activates it. A source can lie in its metadata but
// cannot bypass the probe + the permission gateway.
// =============================================================================

/** Client-side filters the registry enforces over whatever a source returns. */
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
  private listeners = new Set<() => void>();

  /** Register a source (called by a runtime when a discovery module loads). */
  register(source: ModuleDiscoverySource): void {
    if (this.sources.has(source.id)) {
      console.warn(`[DiscoveryRegistry] source "${source.id}" already registered — overriding`);
    }
    this.sources.set(source.id, source);
    this.emit();
  }

  unregister(id: string): void {
    if (this.sources.delete(id)) this.emit();
  }

  /** Every registered source, for labels and source pickers. */
  list(): ModuleDiscoverySource[] {
    return [...this.sources.values()];
  }

  /** Human label for a source id (falls back to the id). */
  labelFor(sourceId: string): string {
    return this.sources.get(sourceId)?.label ?? sourceId;
  }

  /** Subscribe to source register/unregister (so the Browse tab can re-query). */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Query one page across all sources and merge. Filters a source didn't apply
   * are enforced here. `nextPage` is set when ANY source reports more (exact with
   * one source; a heuristic with several).
   */
  async discover(query: DiscoveryQuery): Promise<DiscoveryResult> {
    const sources = this.list();
    const results = await Promise.allSettled(sources.map((s) => s.discover(query)));
    const listings: ModuleListing[] = [];
    let nextPage: number | undefined;
    results.forEach((r, i) => {
      if (r.status !== "fulfilled") {
        // Don't swallow a failing source — a broken one should be diagnosable.
        console.error(`[discovery] source "${sources[i].id}" failed:`, r.reason);
        return;
      }
      listings.push(...r.value.listings.filter((l) => matchesFilters(l, query)));
      // Keep paging while ANY source has more (max, not last-writer-wins).
      if (r.value.nextPage !== undefined) {
        nextPage = nextPage === undefined ? r.value.nextPage : Math.max(nextPage, r.value.nextPage);
      }
    });
    return { listings, nextPage };
  }

  /** Fetch + validate a listing's source so it's ready to install. */
  async resolve(listing: ModuleListing): Promise<ResolvedModule> {
    const source = this.sources.get(listing.sourceId);
    if (!source) throw new Error(`No discovery source "${listing.sourceId}" is available.`);
    const code = await source.fetchSource(listing.ref);
    const manifest = await probeManifest(code); // validate + authoritative metadata
    return { listing, source: code, manifest };
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}

export const DiscoveryRegistry = new DiscoveryRegistryClass();
