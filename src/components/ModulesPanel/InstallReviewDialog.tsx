import { useState } from "react";
import { dangerousPermissions } from "../../module-manager/permissionInfo";
import type { ResolvedModule } from "../../module-manager/types";
import { ModuleIcon } from "./ModuleIcon";
import { AuthorBadge } from "./AuthorBadge";
import { PermissionBadges } from "./PermissionBadges";

interface InstallReviewDialogProps {
  /** The module being installed — source fetched + validated in a throwaway worker. */
  resolved: ResolvedModule;
  installing: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Consent screen shown BEFORE an untrusted module is written + enabled. Shows the
 * module's identity, author, and the permissions it requests — read from the
 * PROBED manifest (authoritative), not the discovery listing — with sensitive
 * permissions flagged. The full source can be inspected inline before granting.
 */
export function InstallReviewDialog({
  resolved,
  installing,
  error,
  onConfirm,
  onCancel,
}: InstallReviewDialogProps) {
  const { listing, manifest, source } = resolved;
  const permissions = manifest.permissions; // authoritative, from the probe
  const allDangerous = dangerousPermissions(permissions);
  const [showSource, setShowSource] = useState(false);

  return (
    <div className="install-review-backdrop" onClick={installing ? undefined : onCancel}>
      <div className="install-review" onClick={(e) => e.stopPropagation()}>
        <h2 className="install-review-title">Install {manifest.name}?</h2>
        <p className="install-review-sub">
          This is community code that runs in an isolated sandbox. It can only do what you allow below.
        </p>

        {allDangerous.length > 0 && (
          <div className="install-review-warning">
            <strong>⚠ This module requests sensitive permissions.</strong> Only continue if you
            trust the author — these can modify files, reach the network, or read stored secrets.
          </div>
        )}

        <div className="install-review-module">
          <div className="install-review-module-head">
            <ModuleIcon icon={listing.icon ?? manifest.icon} name={manifest.name} />
            <div className="install-review-module-ident">
              <div className="install-review-module-title">
                <span className="install-review-module-name">{manifest.name}</span>
                <span className="install-review-module-version">v{manifest.version}</span>
              </div>
              <AuthorBadge author={listing.author ?? null} />
            </div>
          </div>
          {manifest.description && (
            <p className="install-review-module-desc">{manifest.description}</p>
          )}
          <div className="install-review-perms-label">Permissions requested:</div>
          <PermissionBadges permissions={permissions} detailed />

          <button
            type="button"
            className="install-review-source-toggle"
            onClick={() => setShowSource((s) => !s)}
          >
            {showSource ? "▾ Hide source" : "▸ View source"} ({source.length.toLocaleString()} bytes)
          </button>
          {showSource && (
            <pre className="install-review-source">
              <code>{source}</code>
            </pre>
          )}

          {listing.homepageUrl && (
            <a className="catalog-card-link" href={listing.homepageUrl} target="_blank" rel="noreferrer">
              {listing.homepageUrl}
            </a>
          )}
        </div>

        {error && <p className="install-review-error">{error}</p>}

        <div className="install-review-actions">
          <button className="install-review-cancel" onClick={onCancel} disabled={installing}>
            Cancel
          </button>
          <button
            className={`install-review-confirm${allDangerous.length ? " install-review-confirm--danger" : ""}`}
            onClick={onConfirm}
            disabled={installing}
          >
            {installing ? "Installing…" : allDangerous.length ? "Install anyway" : "Install"}
          </button>
        </div>
      </div>
    </div>
  );
}
