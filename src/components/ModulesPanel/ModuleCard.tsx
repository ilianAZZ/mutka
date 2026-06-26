import type { ManagedModule, ModuleSource } from "../../module-manager/types";
import { PermissionBadges } from "./PermissionBadges";

interface ModuleCardProps {
  module: ManagedModule;
  busy: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

const SOURCE_LABEL: Record<ModuleSource, string> = {
  builtin: "Built-in",
  dev: "Dev module",
  community: "Installed",
};

/** One row in the installed list: identity, source, permissions, enable/delete. */
export function ModuleCard({ module, busy, onToggle, onDelete }: ModuleCardProps) {
  return (
    <div className={`module-card${module.status === "error" ? " module-card--error" : ""}`}>
      <div className="module-card-main">
        <div className="module-card-title-row">
          <span className="module-card-name">{module.name}</span>
          <span className="module-card-version">v{module.version}</span>
          <span className={`module-card-source module-card-source--${module.source}`}>
            {SOURCE_LABEL[module.source]}
          </span>
        </div>

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

        {module.source === "community" && (
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
