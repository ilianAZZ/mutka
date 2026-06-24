import { useEffect, useRef } from "react";
import "./ContextMenu.css";
import type { MacowsAction } from "../core/module-registry/module-registry.types";
import type { ActionContext } from "../core/types";

interface Props {
  x: number;
  y: number;
  actions: MacowsAction[];
  context: ActionContext;
  /** Routes action execution through ModuleRegistry for async support and error isolation. */
  onAction: (actionId: string) => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, actions, context, onAction, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const menuX = Math.min(x, window.innerWidth - 200);
  const menuY = Math.min(y, window.innerHeight - actions.length * 32 - 16);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      id="context-menu"
      style={{ top: menuY, left: menuX }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {actions.map((action, i) => {
        const isEnabled = action.isEnabled ? action.isEnabled(context) : true;
        return (
        <div key={action.id}>
          {action.separator && i > 0 && <div className="context-menu-sep" />}
          <button
            className={`context-menu-item${!isEnabled ? " context-menu-item--disabled" : ""}`}
            disabled={!isEnabled}
            onClick={() => {
              if (!isEnabled) return;
              onAction(action.id);
              onClose();
            }}
          >
            <span className="context-menu-label">{action.label}</span>
            {action.shortcut && (
              <span className="context-menu-shortcut">
                {action.shortcut
                  .replace("meta", "⌘")
                  .replace("shift", "⇧")
                  .replace("alt", "⌥")
                  .replace("backspace", "⌫")
                  .replace(/\+/g, "")}
              </span>
            )}
          </button>
        </div>
      );
      })}
    </div>
  );
}
