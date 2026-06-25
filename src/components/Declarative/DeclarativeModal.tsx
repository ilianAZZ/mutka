import { useCallback } from "react";
import type { UINode } from "../../core/sandbox/protocol";
import { ModuleRegistry } from "../../core/module-registry/ModuleRegistry";
import { UIStore } from "../../core/stores/UIStore";
import { DeclarativeView } from "./DeclarativeView";
import "./Declarative.css";

interface DeclarativeModalProps {
  /** Module that owns the modal's UI events. */
  moduleId: string;
  /** The UINode tree the module asked to show. */
  node: UINode;
}

/**
 * A centered modal rendered from a module's declarative UINode tree. Clicking the
 * backdrop closes it (clears the modal slot); interactions route into the module.
 */
export function DeclarativeModal({ moduleId, node }: DeclarativeModalProps) {
  const close = useCallback(() => UIStore.setModal(moduleId, null), [moduleId]);
  const handleAction = useCallback(
    (handlerId: string, value: unknown) => ModuleRegistry.dispatchUIEvent(moduleId, handlerId, value),
    [moduleId]
  );

  return (
    <div className="dv-modal-backdrop" onClick={close}>
      <div className="dv-modal" onClick={(e) => e.stopPropagation()}>
        <DeclarativeView node={node} onAction={handleAction} />
      </div>
    </div>
  );
}
