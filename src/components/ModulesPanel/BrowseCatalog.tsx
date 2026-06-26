import { useState, useEffect, useCallback, useRef } from "react";
import { githubCatalog } from "../../module-manager/githubCatalog";
import type { CatalogEntry } from "../../module-manager/types";
import { CatalogCard } from "./CatalogCard";

interface BrowseCatalogProps {
  /** "owner/repo" strings already installed, so their cards show "Installed". */
  installedRepos: Set<string>;
  /** Repo currently being resolved/installed (its card shows "Checking…"). */
  busyRepo: string | null;
  onInstall: (entry: CatalogEntry) => void;
}

/** The "Browse" tab: searches GitHub for mutka-* repos and lists installable cards. */
export function BrowseCatalog({ installedRepos, busyRepo, onInstall }: BrowseCatalogProps) {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const runSearch = useCallback(async (q: string) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const results = await githubCatalog.search(q);
      if (id === reqId.current) setEntries(results);
    } catch (err) {
      if (id === reqId.current) setError(String(err instanceof Error ? err.message : err));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  // Initial listing + debounced search as the user types.
  useEffect(() => {
    const t = setTimeout(() => runSearch(query), query ? 350 : 0);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  return (
    <div className="browse">
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

      <p className="browse-source-note">
        Source: GitHub repositories named <code>mutka-module-*</code>. Anonymous search is limited to ~60/hour.
      </p>

      {error && <p className="browse-error">{error}</p>}
      {loading && <p className="browse-status">Searching…</p>}
      {!loading && !error && entries.length === 0 && (
        <p className="browse-status">No matching modules found.</p>
      )}

      <div className="catalog-list">
        {entries.map((entry) => (
          <CatalogCard
            key={entry.repo}
            entry={entry}
            installed={installedRepos.has(entry.repo)}
            busy={busyRepo === entry.repo}
            onInstall={onInstall}
          />
        ))}
      </div>
    </div>
  );
}
