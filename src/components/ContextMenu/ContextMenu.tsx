import React, { useEffect, useRef } from "react";
import "./ContextMenu.css";
import type { ContextMenuGroup } from "../../core/module-registry/module-registry.types";
import type { BaseContext } from "../../core/types";
import { ICON_REGISTRY } from "./icon-registry";

interface Props {
  x: number;
  y: number;
  groups: ContextMenuGroup[];
  context: BaseContext;
  /** Routes action execution through ModuleRegistry for async support and error isolation. */
  onAction: (actionId: string) => void;
  onClose: () => void;
}

function renderIcon(name: string): React.ReactNode {
  const Icon = ICON_REGISTRY[name];
  if (!Icon) return null;
  return <Icon size={13} strokeWidth={1.8} />;
}

function formatShortcut(raw: string): string {
  return raw
    .replace("meta", "⌘")
    .replace("shift", "⇧")
    .replace("alt", "⌥")
    .replace("backspace", "⌫")
    .replace(/\+/g, "");
}

export function ContextMenu({ x, y, groups, context, onAction, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const totalActions = groups.reduce((n, g) => n + g.actions.length, 0);
  const labeledGroups = groups.filter((g) => g.label).length;
  const separators = groups.length > 1 ? groups.length - 1 : 0;
  const estimatedHeight = totalActions * 32 + labeledGroups * 22 + separators * 9 + 16;

  const menuX = Math.min(x, window.innerWidth - 220);
  const menuY = Math.min(y, window.innerHeight - estimatedHeight);

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
      {groups.map((group, gi) => (
        <div key={group.label ?? "__default__"} className="context-menu-group">
          {gi > 0 && <div className="context-menu-sep" />}
          {group.actions.map((action) => {
            const isEnabled = action.isEnabled ? action.isEnabled(context) : true;
            return (
              <button
                key={action.id}
                className={`context-menu-item${!isEnabled ? " context-menu-item--disabled" : ""}`}
                disabled={!isEnabled}
                onClick={() => {
                  if (!isEnabled) return;
                  onAction(action.id);
                  onClose();
                }}
              >
                <span className="context-menu-icon" aria-hidden="true">
                  {action.icon ? renderIcon(action.icon) : null}
                </span>
                <span className="context-menu-label">{action.label}</span>
                {action.shortcut && (
                  <span className="context-menu-shortcut">
                    {formatShortcut(action.shortcut)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
