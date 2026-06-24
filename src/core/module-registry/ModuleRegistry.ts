import type {
  MacowsModule,
  MacowsAction,
  MacowsOpenHandler,
  MacowsSidebarPanel,
  MacowsTopBarPanel,
} from "./module-registry.types";
import type { ActionContext, FileItem } from "../types";
import { EventBus } from "../event-bus/EventBus";
import { ShortcutManager } from "../shortcut-manager/ShortcutManager";

class ModuleRegistryClass {
  private modules = new Map<string, MacowsModule>();
  private actions = new Map<string, MacowsAction>();
  private openHandlers: MacowsOpenHandler[] = [];
  private sidebarPanels: MacowsSidebarPanel[] = [];
  private topBarPanels: MacowsTopBarPanel[] = [];

  register(module: MacowsModule): void {
    if (this.modules.has(module.id)) {
      console.warn(`[ModuleRegistry] "${module.id}" already registered.`);
      return;
    }
    this.modules.set(module.id, module);

    for (const action of module.actions) {
      this.actions.set(action.id, action);
      if (action.shortcut) ShortcutManager.bind(action.shortcut, action.id);
    }

    for (const handler of module.openHandlers ?? []) {
      this.openHandlers.push(handler);
      this.openHandlers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    }

    for (const panel of module.sidebarPanels ?? []) {
      this.sidebarPanels.push(panel);
    }

    for (const panel of module.topBarPanels ?? []) {
      this.topBarPanels.push(panel);
      this.topBarPanels.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    module.onMount?.();
    EventBus.emit("module:registered", { moduleId: module.id });
  }

  unregister(moduleId: string): void {
    const module = this.modules.get(moduleId);
    if (!module) return;

    for (const action of module.actions) {
      this.actions.delete(action.id);
      if (action.shortcut) ShortcutManager.unbind(action.shortcut);
    }

    this.openHandlers = this.openHandlers.filter(
      (h) => !module.openHandlers?.some((mh) => mh.id === h.id)
    );

    this.sidebarPanels = this.sidebarPanels.filter(
      (p) => !module.sidebarPanels?.some((mp) => mp.id === p.id)
    );

    this.topBarPanels = this.topBarPanels.filter(
      (p) => !module.topBarPanels?.some((mp) => mp.id === p.id)
    );

    module.onUnmount?.();
    this.modules.delete(moduleId);
    EventBus.emit("module:unregistered", { moduleId });
  }

  /** Execute a registered action. Errors are caught and logged per-module. */
  async executeAction(actionId: string, context: ActionContext): Promise<void> {
    const action = this.actions.get(actionId);
    if (!action) return;
    if (action.isEnabled && !action.isEnabled(context)) return;
    try {
      await action.execute(context);
    } catch (err) {
      console.error(`[ModuleRegistry] Action "${actionId}" failed:`, err);
      EventBus.emit("error:action", { actionId, error: err });
    }
  }

  /** Resolve and call the highest-priority matching open handler for an item. */
  async resolveOpen(item: FileItem, context: ActionContext): Promise<void> {
    const handler = this.openHandlers.find((h) => h.matches(item));
    if (!handler) return;
    try {
      await handler.handle(item, context);
    } catch (err) {
      console.error(`[ModuleRegistry] Open handler "${handler.id}" failed:`, err);
    }
  }

  getContextMenuActions(context: ActionContext): MacowsAction[] {
    return Array.from(this.actions.values()).filter(
      (a) =>
        a.showInContextMenu !== false &&
        (a.isVisible ? a.isVisible(context) : true)
    );
  }

  getToolbarActions(): MacowsAction[] {
    return Array.from(this.actions.values()).filter((a) => a.showInToolbar);
  }

  getSidebarPanels(): MacowsSidebarPanel[] {
    return [...this.sidebarPanels];
  }

  getTopBarPanels(): MacowsTopBarPanel[] {
    return [...this.topBarPanels];
  }

  getModules(): MacowsModule[] {
    return Array.from(this.modules.values());
  }
}

export const ModuleRegistry = new ModuleRegistryClass();
