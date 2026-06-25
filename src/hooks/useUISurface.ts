import { useEffect, useState } from "react";
import { EventBus } from "../core/event-bus/EventBus";
import { Events } from "../core/event-bus/events";
import { UIStore } from "../core/stores/UIStore";
import type { UINode } from "../core/sandbox/protocol";

/**
 * Subscribe to one module's declarative UI surface. Returns the UINode the
 * module last rendered into `surfaceId` (or null), re-rendering when the module
 * pushes a new tree. A "*" surfaceId in the event means the module was disposed.
 */
export function useUISurface(moduleId: string, surfaceId: string): UINode | null {
  const [node, setNode] = useState<UINode | null>(() => UIStore.get(moduleId, surfaceId));

  useEffect(() => {
    setNode(UIStore.get(moduleId, surfaceId));
    return EventBus.on(Events.Ui.changed, (payload) => {
      if (payload.moduleId !== moduleId) return;
      if (payload.surfaceId === surfaceId || payload.surfaceId === "*") {
        setNode(UIStore.get(moduleId, surfaceId));
      }
    });
  }, [moduleId, surfaceId]);

  return node;
}
