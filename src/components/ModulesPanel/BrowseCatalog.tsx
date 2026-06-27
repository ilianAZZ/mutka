import { useState, useEffect, useCallback, useRef } from "react";
import { DiscoveryRegistry } from "../../module-manager/DiscoveryRegistry";
import type { ModuleListing } from "../../module-manager/types";
import type { ModulePermission } from "../../core/module-registry/module-registry.types";
import { CatalogModuleCard } from "./CatalogModuleCard";

interface BrowseCatalogProps {
  /** Module ids already installed, so their cards show "Installed". */
  installedIds: Set<string>;
  /** Listing ref currently being installed (its card shows a spinner). */
  busyRef: string | null;
  onInstall: (listing: ModuleListing) => void;
}

// Permission chips offered as discovery filters (the most meaningful ones).
const FILTER_PERMISSIONS: ModulePermission[] = [
  "fs:read",
  "fs:write",
  "network",
  "clipboard:read",
  "navigation",
  "ui",
];

/**
 * The "Browse" tab: queries the DiscoveryRegistry (GitHub today, more sources
 * later) for modules, with permission filters and pagination. Each result is one
 * module — a multi-module repo yields several cards, labelled by their source.
 */
export function BrowseCatalog({ installedIds, busyRef, onInstall }: BrowseCatalogProps) {
  const [query, setQuery] = useState("");
  const [perms, setPerms] = useState<Set<ModulePermission>>(new Set());
  const [listings, setListings] = useState<ModuleListing[]>([]);
  const [nextPage, setNextPage] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The live list of discovery sources (each contributed by a module).
  const [sources, setSources] = useState(() => DiscoveryRegistry.list().map((s) => ({ id: s.id, label: s.label })));
  const reqId = useRef(0);

  // Keep the source list in sync as discovery modules are enabled/disabled.
  useEffect(() => DiscoveryRegistry.subscribe(() => {
    setSources(DiscoveryRegistry.list().map((s) => ({ id: s.id, label: s.label })));
  }), []);

  const search = useCallback(async (text: string, permissions: ModulePermission[], page: number) => {
    const id = ++reqId.current;
    if (page === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const result = await DiscoveryRegistry.discover({ text, permissions, page });
      if (id !== reqId.current) return;
      setListings((prev) => (page === 1 ? result.listings : [...prev, ...result.listings]));
      setNextPage(result.nextPage);
    } catch (err) {
      if (id === reqId.current) setError(String(err instanceof Error ? err.message : err));
    } finally {
      if (id === reqId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  // Initial listing + debounced re-search when the text, filters, or the set of
  // available sources change (enabling a discovery module re-queries).
  const sourcesKey = sources.map((s) => s.id).join(",");
  useEffect(() => {
    const t = setTimeout(() => search(query, [...perms], 1), query ? 350 : 0);
    return () => clearTimeout(t);
  }, [query, perms, search, sourcesKey]);

  const togglePerm = useCallback((p: ModulePermission) => {
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }, []);

  const loadMore = useCallback(() => {
    if (nextPage !== undefined) search(query, [...perms], nextPage);
  }, [nextPage, query, perms, search]);

  return (
    <div className="browse">
      <div className="browse-sources">
        <span className="browse-sources-label">Sources</span>
        {sources.length === 0 ? (
          <span className="browse-sources-empty">No discovery sources — enable a discovery module</span>
        ) : (
          sources.map((s) => (
            <span key={s.id} className="browse-source" title={`Discovery source: ${s.id}`}>
              {s.label}
            </span>
          ))
        )}
      </div>

      <div className="browse-searchbar">
        <span className="browse-search-icon">🔍</span>
        <input
          className="browse-search-input"
          type="text"
          placeholder="Search modules… (try org:my-org)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      <div className="browse-filters">
        {FILTER_PERMISSIONS.map((p) => (
          <button
            key={p}
            className={`browse-filter${perms.has(p) ? " browse-filter--on" : ""}`}
            onClick={() => togglePerm(p)}
          >
            {p}
          </button>
        ))}
      </div>

      {error && <p className="browse-error">{error}</p>}
      {loading && <p className="browse-status">Searching…</p>}
      {!loading && !error && listings.length === 0 && (
        <p className="browse-status">No matching modules found.</p>
      )}

      <div className="catalog-list">
        {listings.map((listing) => (
          <CatalogModuleCard
            key={`${listing.sourceId}:${listing.ref}`}
            listing={listing}
            sourceLabel={DiscoveryRegistry.labelFor(listing.sourceId)}
            installed={installedIds.has(listing.id)}
            busy={busyRef === listing.ref}
            onInstall={onInstall}
          />
        ))}
      </div>

      {nextPage !== undefined && !loading && (
        <button className="browse-more" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
