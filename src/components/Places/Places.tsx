import type { SidebarItem, SidebarItemGroup } from "../../core/module-registry/module-registry.types";
import { ICON_REGISTRY } from "../ContextMenu/icon-registry";
import "./Places.css";

interface PlacesProps {
  /** Module-contributed item groups (already grouped by category). */
  groups: SidebarItemGroup[];
  homeDir: string;
  currentDir: string;
  onNavigate: (path: string) => void;
  onRunCommand: (commandId: string) => void;
  /** Clicking an item's remove (✕) affordance. */
  onRemoveItem: (id: string) => void;
}

function PlaceIcon({ name }: { name?: string }) {
  if (!name) return <span className="place-icon" />;
  const Lucide = ICON_REGISTRY[name];
  if (Lucide) return <span className="place-icon"><Lucide size={15} strokeWidth={1.8} /></span>;
  return <span className="place-icon place-icon--emoji">{name}</span>; // emoji fallback
}

/**
 * Left "Places" sidebar. Renders core favorites plus every module-contributed
 * item, grouped by category (same category → merged under one header). Items
 * flagged `removable` show a ✕ that asks the owning module to remove them.
 */
export function Places({ groups, homeDir, currentDir, onNavigate, onRunCommand, onRemoveItem }: PlacesProps) {
  const core: SidebarItem[] = [
    { id: "core.places.home", label: "Home", icon: "folder", category: "Favorites", path: homeDir },
    { id: "core.places.computer", label: "Computer", icon: "package", category: "Favorites", path: "/" },
  ];

  // Merge core favorites with module groups, combining items that share a category.
  const order: (string | undefined)[] = [];
  const byCategory = new Map<string | undefined, SidebarItem[]>();
  const add = (category: string | undefined, items: SidebarItem[]) => {
    if (!byCategory.has(category)) { order.push(category); byCategory.set(category, []); }
    byCategory.get(category)!.push(...items);
  };
  add("Favorites", core);
  for (const group of groups) add(group.label, group.items);

  const renderItem = (item: SidebarItem) => {
    const active = item.path !== undefined && item.path === currentDir;
    const handle = () => {
      if (item.path !== undefined) onNavigate(item.path);
      else if (item.command) onRunCommand(item.command);
    };
    return (
      <div key={item.id} className={`place-item${active ? " place-item--active" : ""}`}>
        <button className="place-item-main" onClick={handle} title={item.path ?? item.label}>
          <PlaceIcon name={item.icon} />
          <span className="place-label">{item.label}</span>
        </button>
        {item.removable && (
          <button
            className="place-remove"
            onClick={(e) => { e.stopPropagation(); onRemoveItem(item.id); }}
            title="Remove"
            aria-label="Remove"
          >✕</button>
        )}
      </div>
    );
  };

  return (
    <aside className="places" data-menu-zone="sidebar">
      {order.map((category) => (
        <div key={category ?? "__default__"} className="place-group">
          {category && <div className="place-group-header">{category}</div>}
          {byCategory.get(category)!.map(renderItem)}
        </div>
      ))}
    </aside>
  );
}
