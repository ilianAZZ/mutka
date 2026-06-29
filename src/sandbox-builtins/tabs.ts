import { defineModule } from "../core/sandbox/defineModule";

interface ModifierOpen {
  item: { path: string; isDir: boolean };
  modifiers: { ctrl: boolean; meta: boolean };
}

export default defineModule({
  id: "core.tabs",
  name: "Tabs",
  version: "1.0.0",
  description: "Open directories in tabs (⌘T or ctrl/⌘-double-click a folder).",
  permissions: ["navigation"],
  commands: [
    { id: "core.tabs.new-tab", label: "New Tab", shortcut: "meta+t" },
    {
      id: "core.tabs.open-in-new-tab",
      label: "Open in New Tab",
      icon: "new-tab",
      contextMenu: true,
      contextMenuCategory: "View",
      when: { selection: "singleDir" },
    },
  ],
  setup(host) {
    host.onCommand("core.tabs.new-tab", async (snap) => {
      await host.tabs.openTab(snap.currentDirectory);
    });

    host.onCommand("core.tabs.open-in-new-tab", async (snap) => {
      const target = snap.selectedItems[0];
      if (!target) return;
      // Anchor the current location as tab 1 first so it isn't lost.
      if (!(await host.tabs.isActive())) await host.tabs.openTab(snap.currentDirectory);
      await host.tabs.openTabInBackground(target.path);
    });

    host.events.on("file:modifier-open", (payload) => {
      const { item, modifiers } = payload as ModifierOpen;
      if (item.isDir && (modifiers.ctrl || modifiers.meta)) {
        void host.tabs.openTab(item.path).catch((e) => host.log("[tabs] openTab failed:", e));
      }
    });

    // Middle-click a folder → open it in a background tab (browser-style).
    host.events.on("file:middle-open", async (payload) => {
      try {
        const { item } = payload as { item: { path: string; isDir: boolean } };
        if (!item.isDir) return;
        if (!(await host.tabs.isActive())) await host.tabs.openTab(item.path);
        else await host.tabs.openTabInBackground(item.path);
      } catch (e) {
        host.log("[tabs] middle-open failed:", e);
      }
    });
  },
});
