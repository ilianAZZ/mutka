import type {
  MutkaModule,
  MutkaAction,
  MutkaOpenHandler,
  MutkaSidebarPanel,
  DeclarativePanelContribution,
  SettingsSectionContribution,
  ModuleManagerButtonContribution,
  ContextMenuGroup,
  SidebarItem,
  SidebarItemGroup,
} from "./module-registry.types";
import type { BaseContext, FileItem } from "../types";
import { DEFAULT_MENU_ZONES, type MenuZone } from "../menu/menuZone";
import { EventBus } from "../event-bus/EventBus";
import { Events } from "../event-bus/events";
import { ShortcutManager } from "../shortcut-manager/ShortcutManager";
import { SelectionStore } from "../stores/SelectionStore";
import { ClipboardStore } from "../stores/ClipboardStore";
import { UIStore } from "../stores/UIStore";
import { StatusBarStore } from "../stores/StatusBarStore";
import { AppBridge } from "../app-bridge/AppBridge";

/** Read-only view of app state for isVisible/isEnabled predicates. */
function viewContext(): BaseContext {
  return {
    selectedItems: SelectionStore.items,
    currentDirectory: AppBridge.getDirectory(),
    clipboard: ClipboardStore.state,
    navigation: AppBridge.nav,
  };
}

class ModuleRegistryClass {
  private modules = new Map<string, MutkaModule>();
  private actions = new Map<string, MutkaAction>();
  private openHandlers: MutkaOpenHandler[] = [];
  private sidebarPanels: MutkaSidebarPanel[] = [];
  private declarativePanels: DeclarativePanelContribution[] = [];
  private settingsSections: SettingsSectionContribution[] = [];
  private moduleManagerButtons: ModuleManagerButtonContribution[] = [];
  private sidebarItems: SidebarItem[] = [];
  private dynamicSidebarItems = new Map<string, SidebarItem[]>(); // moduleId → items set at runtime
  private cleanups = new Map<string, (() => void)[]>();
  private initialized = false;

  /** Wire the action-dispatch bus once. Called by App.tsx at startup. */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    EventBus.on(Events.Action.dispatch, ({ actionId }) => this.executeAction(actionId));
  }

  register(module: MutkaModule): void {
    if (this.modules.has(module.id)) {
      console.warn(`[ModuleRegistry] "${module.id}" already registered.`);
      return;
    }
    this.modules.set(module.id, module);

    for (const action of module.actions) {
      this.actions.set(action.id, action);
      if (action.shortcut) ShortcutManager.bind(action.id, action.shortcut);
    }

    for (const handler of module.openHandlers ?? []) {
      this.openHandlers.push(handler);
      this.openHandlers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    }

    for (const panel of module.sidebarPanels ?? []) {
      this.sidebarPanels.push(panel);
    }

    for (const panel of module.declarativePanels ?? []) {
      this.declarativePanels.push(panel);
    }

    for (const section of module.settingsSections ?? []) {
      this.settingsSections.push(section);
    }

    for (const button of module.moduleManagerButtons ?? []) {
      this.moduleManagerButtons.push(button);
    }

    for (const item of module.sidebarItems ?? []) {
      this.sidebarItems.push(item);
    }

    const result = module.onMount?.();
    if (result) {
      this.cleanups.set(module.id, Array.isArray(result) ? result : [result]);
    }
    EventBus.emit(Events.Module.registered, { moduleId: module.id });
  }

  unregister(moduleId: string): void {
    const module = this.modules.get(moduleId);
    if (!module) return;

    for (const action of module.actions) {
      this.actions.delete(action.id);
      if (action.shortcut) ShortcutManager.unbind(action.id);
    }

    this.openHandlers = this.openHandlers.filter(
      (h) => !module.openHandlers?.some((mh) => mh.id === h.id)
    );
    this.sidebarPanels = this.sidebarPanels.filter(
      (p) => !module.sidebarPanels?.some((mp) => mp.id === p.id)
    );
    this.declarativePanels = this.declarativePanels.filter((p) => p.moduleId !== moduleId);
    this.settingsSections = this.settingsSections.filter((s) => s.moduleId !== moduleId);
    this.moduleManagerButtons = this.moduleManagerButtons.filter((b) => b.moduleId !== moduleId);
    this.sidebarItems = this.sidebarItems.filter(
      (i) => !module.sidebarItems?.some((mi) => mi.id === i.id)
    );
    this.dynamicSidebarItems.delete(moduleId);
    UIStore.disposeModule(moduleId);
    StatusBarStore.disposeModule(moduleId);

    for (const unsub of this.cleanups.get(moduleId) ?? []) unsub();
    this.cleanups.delete(moduleId);
    module.onUnmount?.();
    this.modules.delete(moduleId);
    EventBus.emit(Events.Module.unregistered, { moduleId });
  }

  /** Execute a registered action. Modules act via their own host capabilities. */
  async executeAction(actionId: string): Promise<void> {
    const action = this.actions.get(actionId);
    if (!action) return;

    const ctx = viewContext();
    if (action.isVisible && !action.isVisible(ctx)) return;
    if (action.isEnabled && !action.isEnabled(ctx)) return;

    try {
      await action.execute();
    } catch (err) {
      console.error(`[ModuleRegistry] Action "${actionId}" failed:`, err);
      EventBus.emit(Events.Error.action, { actionId, error: err });
    }
  }

  /** Resolve and call the highest-priority matching open handler for an item. */
  async resolveOpen(item: FileItem): Promise<void> {
    const handler = this.openHandlers.find((h) => h.matches(item));
    if (!handler) return;
    try {
      await handler.handle(item);
    } catch (err) {
      console.error(`[ModuleRegistry] Open handler "${handler.id}" failed:`, err);
    }
  }

  /**
   * Context menu actions for the clicked zone, filtered by isVisible and grouped
   * by category. An action shows only in its declared `contextMenuZones` (default:
   * file rows + empty background). See core/menu/menuZone.ts.
   */
  getContextMenuActions(context: BaseContext, zone: MenuZone): ContextMenuGroup[] {
    const visible = Array.from(this.actions.values()).filter(
      (a) =>
        a.showInContextMenu !== false &&
        (a.contextMenuZones ?? DEFAULT_MENU_ZONES).includes(zone) &&
        (a.isVisible ? a.isVisible(context) : true)
    );

    const groupOrder: (string | undefined)[] = [];
    const grouped = new Map<string | undefined, MutkaAction[]>();

    for (const action of visible) {
      const cat = action.contextMenuCategory;
      if (!grouped.has(cat)) {
        groupOrder.push(cat);
        grouped.set(cat, []);
      }
      grouped.get(cat)!.push(action);
    }

    return groupOrder.map((label) => ({ label, actions: grouped.get(label)! }));
  }

  getSidebarPanels(): MutkaSidebarPanel[] {
    return [...this.sidebarPanels];
  }

  /** Declarative (UINode-backed) side-pane panels contributed by modules. */
  getDeclarativePanels(): DeclarativePanelContribution[] {
    return [...this.declarativePanels];
  }

  /** Declarative settings sections contributed by modules. */
  getSettingsSections(): SettingsSectionContribution[] {
    return [...this.settingsSections];
  }

  /** Buttons modules contribute to the Modules overlay (Browse tab). */
  getModuleManagerButtons(): ModuleManagerButtonContribution[] {
    return [...this.moduleManagerButtons];
  }

  /**
   * Route a UI-event (a button/list/form interaction in a module's declarative
   * UI) into that module's runtime, where its onUIEvent handler runs.
   */
  dispatchUIEvent(moduleId: string, handlerId: string, value: unknown): void {
    this.modules.get(moduleId)?.runUIEvent?.(handlerId, value);
  }

  /**
   * Replace a module's runtime (dynamic) sidebar items — e.g. a bookmarks module
   * updating its list. Merged with the module's static items in the grouping.
   */
  setDynamicSidebarItems(moduleId: string, items: SidebarItem[]): void {
    this.dynamicSidebarItems.set(moduleId, items);
    EventBus.emit(Events.Sidebar.changed);
  }

  /** Static + dynamic left-sidebar items, grouped by category (first-seen order). */
  getSidebarItemGroups(): SidebarItemGroup[] {
    const all = [...this.sidebarItems, ...Array.from(this.dynamicSidebarItems.values()).flat()];
    const order: (string | undefined)[] = [];
    const grouped = new Map<string | undefined, SidebarItem[]>();
    for (const item of all) {
      const cat = item.category;
      if (!grouped.has(cat)) {
        order.push(cat);
        grouped.set(cat, []);
      }
      grouped.get(cat)!.push(item);
    }
    return order.map((label) => ({ label, items: grouped.get(label)! }));
  }

  /** id + label of every registered action (for the keybind editor). */
  getActions(): { id: string; label: string }[] {
    return Array.from(this.actions.values()).map((a) => ({ id: a.id, label: a.label }));
  }

  /** id + display name of every registered module (for the settings nav). */
  getModuleInfo(): { id: string; name: string }[] {
    return Array.from(this.modules.values()).map((m) => ({ id: m.id, name: m.name }));
  }
}

export const ModuleRegistry = new ModuleRegistryClass();
