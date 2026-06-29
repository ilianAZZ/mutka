import { canUninstall, type ManagedModule, type ModuleSource } from "../../module-manager/types";
import { resolveAuthor } from "../../module-manager/authorInfo";
import { PermissionBadges } from "./PermissionBadges";
import { ModuleIcon } from "./ModuleIcon";
import { AuthorBadge } from "./AuthorBadge";

interface ModuleCardProps {
  module: ManagedModule;
  busy: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

// Built-in and dev modules both ship with the app — surfaced together as "Bundled".
const SOURCE_LABEL: Record<ModuleSource, string> = {
  builtin: "Bundled",
  dev: "Bundled",
  community: "Installed",
};

/** One row in the installed list: icon, identity, author, permissions, enable/delete. */
export function ModuleCard({ module, busy, onToggle, onDelete }: ModuleCardProps) {
  const author = resolveAuthor(module.author);

  return (
    <div className={`module-card${module.status === "error" ? " module-card--error" : ""}`}>
      <ModuleIcon icon={module.icon} name={module.name} />

      <div className="module-card-main">
        <div className="module-card-title-row">
          <span className="module-card-name">{module.name}</span>
          <span className="module-card-version">v{module.version}</span>
          <span className={`module-card-source module-card-source--${module.source}`}>
            {SOURCE_LABEL[module.source]}
          </span>
        </div>

        {author && <AuthorBadge author={author} />}

        {module.description && <p className="module-card-desc">{module.description}</p>}
        {module.status === "error" && module.error && (
          <p className="module-card-error" title={module.error}>Failed to load: {module.error}</p>
        )}

        <PermissionBadges permissions={module.permissions} />
        <div className="module-card-id">{module.id}</div>
      </div>

      <div className="module-card-actions">
        <button
          className={`module-toggle${module.enabled ? " module-toggle--on" : ""}`}
          role="switch"
          aria-checked={module.enabled}
          disabled={busy}
          onClick={() => onToggle(module.id)}
          title={module.enabled ? "Disable" : "Enable"}
        >
          <span className="module-toggle-knob" />
        </button>

        {canUninstall(module.source) && (
          <button
            className="module-delete"
            disabled={busy}
            onClick={() => onDelete(module.id)}
            title="Delete from disk"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
