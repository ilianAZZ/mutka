import { dangerousPermissions } from "../../module-manager/permissionInfo";
import type { CatalogEntry, ResolvedModule } from "../../module-manager/types";
import { PermissionBadges } from "./PermissionBadges";

interface InstallReviewDialogProps {
  entry: CatalogEntry;
  /** Modules resolved from the repo (downloaded + validated in a throwaway worker). */
  resolved: ResolvedModule[];
  installing: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Consent screen shown BEFORE an untrusted module is written + enabled. Lists
 * every module the repo ships and the permissions each requests, with sensitive
 * permissions called out explicitly so the user knows what they're granting.
 */
export function InstallReviewDialog({
  entry,
  resolved,
  installing,
  error,
  onConfirm,
  onCancel,
}: InstallReviewDialogProps) {
  const allDangerous = dangerousPermissions(resolved.flatMap((r) => r.manifest.permissions));

  return (
    <div className="install-review-backdrop" onClick={installing ? undefined : onCancel}>
      <div className="install-review" onClick={(e) => e.stopPropagation()}>
        <h2 className="install-review-title">Install from {entry.repo}?</h2>
        <p className="install-review-sub">
          This is community code that runs in an isolated sandbox. It can only do what you allow below.
        </p>

        {allDangerous.length > 0 && (
          <div className="install-review-warning">
            <strong>⚠ This module requests sensitive permissions.</strong> Only continue if you
            trust the author — these can modify files, reach the network, or read stored secrets.
          </div>
        )}

        <div className="install-review-modules">
          {resolved.map((r) => (
            <div key={r.id} className="install-review-module">
              <div className="install-review-module-head">
                <span className="install-review-module-name">{r.manifest.name}</span>
                <span className="install-review-module-version">v{r.manifest.version}</span>
              </div>
              {r.manifest.description && (
                <p className="install-review-module-desc">{r.manifest.description}</p>
              )}
              <div className="install-review-perms-label">Permissions requested:</div>
              <PermissionBadges permissions={r.manifest.permissions} detailed />
            </div>
          ))}
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
