import { permissionInfo } from "../../module-manager/permissionInfo";

interface PermissionBadgesProps {
  permissions: readonly string[];
  /** When true, render each permission's description (used in the install review). */
  detailed?: boolean;
}

/**
 * Renders a module's declared permissions as chips. Dangerous permissions
 * (fs:write, network, secrets, …) are tinted to warn the user. Pure presentation.
 */
export function PermissionBadges({ permissions, detailed = false }: PermissionBadgesProps) {
  if (permissions.length === 0) {
    return <span className="perm-empty">No special permissions</span>;
  }

  if (detailed) {
    return (
      <ul className="perm-detail-list">
        {permissions.map((p) => {
          const info = permissionInfo(p);
          return (
            <li key={p} className={`perm-detail${info.dangerous ? " perm-detail--danger" : ""}`}>
              <span className="perm-detail-head">
                {info.dangerous && <span className="perm-detail-warn">⚠</span>}
                {info.label}
              </span>
              <span className="perm-detail-desc">{info.description}</span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="perm-badges">
      {permissions.map((p) => {
        const info = permissionInfo(p);
        return (
          <span key={p} className={`perm-badge${info.dangerous ? " perm-badge--danger" : ""}`} title={info.description}>
            {info.label}
          </span>
        );
      })}
    </div>
  );
}
