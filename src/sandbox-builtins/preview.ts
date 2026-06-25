import { defineModule } from "../core/sandbox/defineModule";

// Quick Look preview: press space on a selected item to open the native macOS
// preview (same as Finder's spacebar). A tiny module over the sys.quickLook
// capability.
export default defineModule({
  id: "core.preview",
  name: "Quick Look",
  version: "1.0.0",
  description: "Preview the selected file with native Quick Look (space).",
  permissions: ["fs:read"],
  commands: [
    {
      id: "core.preview.quick-look",
      label: "Quick Look",
      icon: "new-tab",
      shortcut: "space",
      contextMenu: true,
      contextMenuCategory: "View",
      when: { selection: "single" },
    },
  ],
  setup(host) {
    host.onCommand("core.preview.quick-look", async (snap) => {
      const target = snap.selectedItems[0];
      if (target) await host.sys.quickLook(target.path);
    });
  },
});
