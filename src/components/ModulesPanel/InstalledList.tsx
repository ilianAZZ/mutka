import type { ManagedModule } from "../../module-manager/types";
import { ModuleCard } from "./ModuleCard";

interface InstalledListProps {
  modules: ManagedModule[];
  /** Id of the module currently mid-operation (its controls disable). */
  busyId: string | null;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

/** The "Installed" tab: every tracked module grouped by source, with controls. */
export function InstalledList({ modules, busyId, onToggle, onDelete }: InstalledListProps) {
  if (modules.length === 0) {
    return <p className="modules-empty">No modules loaded.</p>;
  }
  return (
    <div className="module-list">
      {modules.map((m) => (
        <ModuleCard
          key={m.id}
          module={m}
          busy={busyId === m.id}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
