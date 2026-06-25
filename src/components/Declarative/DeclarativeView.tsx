import React from "react";
import type { UINode, UIListItem } from "../../core/sandbox/protocol";
import { ICON_REGISTRY } from "../ContextMenu/icon-registry";
import { SchemaForm } from "./SchemaForm";
import "./Declarative.css";

interface DeclarativeViewProps {
  node: UINode;
  /** Fires when a button/list-item/form is used. Parent routes it to the module. */
  onAction: (handlerId: string, value: unknown) => void;
}

/** Only `var(--…)` tokens are allowed as colours; anything else is dropped. */
function safeTint(tint: string | undefined): string | undefined {
  return tint && tint.startsWith("var(--") ? tint : undefined;
}

function renderIcon(name: string | undefined): React.ReactNode {
  if (!name) return null;
  const Icon = ICON_REGISTRY[name];
  if (Icon) return <Icon size={14} strokeWidth={1.8} />;
  return <span className="dv-emoji">{name}</span>; // emoji / unknown key → raw glyph
}

/**
 * Renders a module's serializable UINode tree with native Liquid Glass widgets.
 * Pure presentation: it never imports a module or calls invoke; interactions are
 * surfaced through onAction, which the owning surface routes into the module.
 * `image`/`icon` render via <img src>/registry only — never innerHTML.
 */
export function DeclarativeView({ node, onAction }: DeclarativeViewProps) {
  switch (node.type) {
    case "vstack":
    case "hstack": {
      const style: React.CSSProperties = { gap: node.gap ?? 8 };
      if (node.type === "hstack" && node.align) style.alignItems = node.align;
      return (
        <div className={`dv-${node.type}`} style={style}>
          {node.children.map((child, i) => (
            <DeclarativeView key={i} node={child} onAction={onAction} />
          ))}
        </div>
      );
    }
    case "text":
      return (
        <span
          className={`dv-text dv-text--${node.size ?? "md"} dv-text--${node.weight ?? "normal"}${node.muted ? " dv-text--muted" : ""}`}
          style={{ color: safeTint(node.tint) }}
        >
          {node.text}
        </span>
      );
    case "row":
      return (
        <div className="dv-row">
          <span className="dv-row-label">{renderIcon(node.icon)}{node.label}</span>
          {node.value !== undefined && <span className="dv-row-value">{node.value}</span>}
        </div>
      );
    case "button":
      return (
        <button
          className={`dv-btn dv-btn--${node.variant ?? "default"}`}
          onClick={() => onAction(node.action, node.value ?? null)}
        >
          {renderIcon(node.icon)}{node.label}
        </button>
      );
    case "list":
      return (
        <div className="dv-list">
          {node.items.map((item) => (
            <ListRow key={item.id} item={item} onAction={onAction} />
          ))}
        </div>
      );
    case "badge":
      return <span className="dv-badge" style={{ color: safeTint(node.tint) }}>{node.text}</span>;
    case "icon":
      return <span className="dv-icon">{renderIcon(node.name)}</span>;
    case "divider":
      return <hr className="dv-divider" />;
    case "spacer":
      return <div className="dv-spacer" style={{ height: node.size ?? 8 }} />;
    case "image":
      return node.src.startsWith("data:image/")
        ? <img className="dv-image" src={node.src} alt={node.alt ?? ""} />
        : null;
    case "form":
      return (
        <SchemaForm
          schema={node.schema}
          submitLabel={node.submitLabel}
          onSubmit={(values) => onAction(node.action, values)}
        />
      );
    default:
      return null;
  }
}

interface ListRowProps {
  item: UIListItem;
  onAction: (handlerId: string, value: unknown) => void;
}

function ListRow({ item, onAction }: ListRowProps) {
  const clickable = Boolean(item.action);
  return (
    <div
      className={`dv-list-row${clickable ? " dv-list-row--clickable" : ""}`}
      onClick={clickable ? () => onAction(item.action!, item.value ?? item.id) : undefined}
    >
      {renderIcon(item.icon)}
      <span className="dv-list-label" style={{ color: safeTint(item.tint) }}>{item.label}</span>
      {item.detail && <span className="dv-list-detail">{item.detail}</span>}
    </div>
  );
}
