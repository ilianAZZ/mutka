import type { MacowsModule, MacowsAction } from "../../core/module-registry/module-registry.types";
import { EventBus } from "../../core/event-bus/EventBus";
import { Events } from "../../core/event-bus/events";
import { TabManager } from "../../core/tab-manager/TabManager";
import { TabBar } from "./TabBar";

type Unsub = () => void;
let unsubModifierOpen: Unsub | null = null;

const newTabAction: MacowsAction = {
  id: "core.tabs.new-tab",
  label: "New Tab",
  shortcut: "meta+t",
  showInContextMenu: false,
  showInToolbar: false,
  execute(ctx) {
    TabManager.openTab(ctx.currentDirectory);
  },
};

const openInNewTabAction: MacowsAction = {
  id: "core.tabs.open-in-new-tab",
  label: "Open in New Tab",
  showInContextMenu: true,
  showInToolbar: false,
  separator: true,
  isVisible: (ctx) => ctx.selectedItems.length === 1 && ctx.selectedItems[0].isDir,
  execute(ctx) {
    TabManager.openTab(ctx.selectedItems[0].path);
  },
};

export const tabsModule: MacowsModule = {
  id: "core.tabs",
  name: "Tabs",
  version: "1.0.0",
  description: "Open directories in tabs (⌘T or ctrl+double-click a folder)",
  actions: [newTabAction, openInNewTabAction],
  topBarPanels: [{ id: "core.tabs.bar", order: 0, component: TabBar }],
  onMount(): void {
    unsubModifierOpen = EventBus.on(Events.File.modifierOpen, ({ item, modifiers }) => {
      if (!item.isDir || (!modifiers.ctrl && !modifiers.meta)) return;
      TabManager.openTab(item.path);
    });
  },
  onUnmount(): void {
    unsubModifierOpen?.();
    unsubModifierOpen = null;
  },
};
