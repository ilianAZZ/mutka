import type { ModuleListing } from "../../module-manager/types";
import { openExternal } from "../../module-manager/openExternal";
import { ModuleIcon } from "./ModuleIcon";
import { AuthorBadge } from "./AuthorBadge";
import { PermissionBadges } from "./PermissionBadges";

interface CatalogModuleCardProps {
  listing: ModuleListing;
  sourceLabel: string;
  installed: boolean;
  busy: boolean;
  onInstall: (listing: ModuleListing) => void;
}

/** One discoverable module in the Browse tab: icon, identity, source, author, permissions. */
export function CatalogModuleCard({ listing, sourceLabel, installed, busy, onInstall }: CatalogModuleCardProps) {
  return (
    <div className="catalog-card">
      <ModuleIcon icon={listing.icon} name={listing.name} />

      <div className="catalog-card-main">
        <div className="catalog-card-title-row">
          {listing.homepageUrl ? (
            <button
              type="button"
              className="catalog-card-name catalog-card-name--link"
              onClick={() => void openExternal(listing.homepageUrl)}
              title={`Open ${listing.name} source`}
            >
              {listing.name}
            </button>
          ) : (
            <span className="catalog-card-name">{listing.name}</span>
          )}
          <span className="catalog-card-version">v{listing.version}</span>
          <span className="source-pill" title={`Discovered via ${sourceLabel}`}>{sourceLabel}</span>
        </div>

        <AuthorBadge author={listing.author ?? null} />

        {listing.description && <p className="catalog-card-desc">{listing.description}</p>}

        <PermissionBadges permissions={listing.permissions} />

        {listing.tags && listing.tags.length > 0 && (
          <div className="catalog-card-tags">
            {listing.tags.map((t) => (
              <span key={t} className="catalog-card-tag">#{t}</span>
            ))}
          </div>
        )}
      </div>

      <button
        className="catalog-install"
        disabled={busy || installed}
        onClick={() => onInstall(listing)}
      >
        {installed ? "Installed" : busy ? "…" : "Install"}
      </button>
    </div>
  );
}
