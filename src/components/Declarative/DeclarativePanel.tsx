import { useCallback } from "react";
import { ModuleRegistry } from "../../core/module-registry/ModuleRegistry";
import { useUISurface } from "../../hooks/useUISurface";
import { DeclarativeView } from "./DeclarativeView";
import "./Declarative.css";

interface DeclarativePanelProps {
  /** Module whose surface this renders (scopes UIStore + UI-event dispatch). */
  moduleId: string;
  /** Surface id the module renders into via host.ui.render(surfaceId, node). */
  surfaceId: string;
  /** Shown when the module hasn't rendered anything into the surface yet. */
  emptyHint?: string;
}

/**
 * Renders a module's declarative surface (a panel or settings section). Reads the
 * UINode the module pushed into UIStore and routes interactions back into the
 * owning module's runtime — so a sandboxed module gets real UI without ever
 * shipping a React component.
 */
export function DeclarativePanel({ moduleId, surfaceId, emptyHint }: DeclarativePanelProps) {
  const node = useUISurface(moduleId, surfaceId);

  const handleAction = useCallback(
    (handlerId: string, value: unknown) => ModuleRegistry.dispatchUIEvent(moduleId, handlerId, value),
    [moduleId]
  );

  if (!node) {
    return <div className="dv-empty">{emptyHint ?? "Nothing to show yet."}</div>;
  }
  return (
    <div className="dv-surface">
      <DeclarativeView node={node} onAction={handleAction} />
    </div>
  );
}
