import type { CatalogEntry } from "../../module-manager/types";

interface CatalogCardProps {
  entry: CatalogEntry;
  installed: boolean;
  busy: boolean;
  onInstall: (entry: CatalogEntry) => void;
}

/** A repository card in the Browse tab: identity, stars, and an install action. */
export function CatalogCard({ entry, installed, busy, onInstall }: CatalogCardProps) {
  return (
    <div className="catalog-card">
      <div className="catalog-card-main">
        <div className="catalog-card-title-row">
          <span className="catalog-card-name">{entry.name}</span>
          <span className="catalog-card-stars" title="Stars">★ {entry.stars}</span>
        </div>
        <div className="catalog-card-owner">{entry.owner}</div>
        {entry.description && <p className="catalog-card-desc">{entry.description}</p>}
        <a className="catalog-card-link" href={entry.htmlUrl} target="_blank" rel="noreferrer">
          {entry.repo}
        </a>
      </div>

      <button
        className="catalog-install"
        disabled={busy || installed}
        onClick={() => onInstall(entry)}
      >
        {installed ? "Installed" : busy ? "Checking…" : "Install"}
      </button>
    </div>
  );
}
