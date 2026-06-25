import { useEffect, useState } from "react";
import type { ClipboardState } from "../../core/types";
import type { OwnedStatusBarItem } from "../../core/stores/StatusBarStore";
import { StatusBarStore } from "../../core/stores/StatusBarStore";
import { ModuleRegistry } from "../../core/module-registry/ModuleRegistry";
import { EventBus } from "../../core/event-bus/EventBus";
import { Events } from "../../core/event-bus/events";
import { ICON_REGISTRY } from "../ContextMenu/icon-registry";
import { DeclarativePanel } from "../Declarative/DeclarativePanel";
import "./StatusBar.css";

interface StatusBarProps {
  itemCount: number;
  selectedCount: number;
  clipboard: ClipboardState;
}

/** A surface id currently shown as a popover, scoped to its owning module. */
interface OpenPopover {
  moduleId: string;
  surfaceId: string;
}

function safeTint(tint: string | undefined): string | undefined {
  return tint && tint.startsWith("var(--") ? tint : undefined;
}

/**
 * The bottom status bar: core counts on the left, module-contributed items on
 * either end. Clicking an item runs a command or opens a declarative popover.
 * Modules drive items through the `statusbar` capability — never this component.
 */
export function StatusBar({ itemCount, selectedCount, clipboard }: StatusBarProps) {
  const [items, setItems] = useState<OwnedStatusBarItem[]>(() => StatusBarStore.list());
  const [popover, setPopover] = useState<OpenPopover | null>(null);

  useEffect(() => EventBus.on(Events.StatusBar.changed, () => setItems(StatusBarStore.list())), []);

  const handleClick = (item: OwnedStatusBarItem) => {
    if (!item.onClick) return;
    if ("command" in item.onClick) {
      ModuleRegistry.executeAction(item.onClick.command);
      return;
    }
    const surfaceId = item.onClick.popover;
    setPopover((cur) =>
      cur && cur.moduleId === item.moduleId && cur.surfaceId === surfaceId
        ? null
        : { moduleId: item.moduleId, surfaceId }
    );
  };

  const left = items.filter((i) => i.side === "left");
  const right = items.filter((i) => i.side !== "left");

  return (
    <div id="statusbar">
      <span>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
      {selectedCount > 0 && <span> · {selectedCount} selected</span>}
      {clipboard.operation && (
        <span> · {clipboard.items.length} in clipboard ({clipboard.operation})</span>
      )}
      {left.map((item) => <StatusItem key={`${item.moduleId}.${item.id}`} item={item} onClick={handleClick} />)}

      <span className="statusbar-spacer" />

      {right.map((item) => <StatusItem key={`${item.moduleId}.${item.id}`} item={item} onClick={handleClick} />)}

      {popover && (
        <>
          <div className="statusbar-popover-backdrop" onClick={() => setPopover(null)} />
          <div className="statusbar-popover">
            <DeclarativePanel moduleId={popover.moduleId} surfaceId={popover.surfaceId} />
          </div>
        </>
      )}
    </div>
  );
}

interface StatusItemProps {
  item: OwnedStatusBarItem;
  onClick: (item: OwnedStatusBarItem) => void;
}

function StatusItem({ item, onClick }: StatusItemProps) {
  const Icon = item.icon ? ICON_REGISTRY[item.icon] : undefined;
  return (
    <button
      className="statusbar-item"
      title={item.tooltip}
      disabled={!item.onClick}
      style={{ color: safeTint(item.tint) }}
      onClick={() => onClick(item)}
    >
      {Icon ? <Icon size={12} strokeWidth={1.8} /> : item.icon ? <span>{item.icon}</span> : null}
      {item.text && <span>{item.text}</span>}
      {item.badge && <span className="statusbar-badge">{item.badge}</span>}
    </button>
  );
}
