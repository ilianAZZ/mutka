import { defineModule } from "../core/sandbox/defineModule";

// Preview: press space on a selected item to open it in the native macOS
// Preview app (Aperçu). A tiny module over the sys.quickLook capability.
export default defineModule({
  id: "core.preview",
  name: "Preview",
  version: "1.0.0",
  description: "Open the selected file in the native Preview app (space).",
  permissions: ["fs:read"],
  commands: [
    {
      id: "core.preview.quick-look",
      label: "Open in Preview",
      icon: "new-tab",
      shortcut: "space",
      contextMenu: true,
      contextMenuCategory: "View",
      when: { selection: "single" },
    },
  ],
  setup(host) {
    // Space toggles the native Quick Look panel for the selected file.
    host.onCommand("core.preview.quick-look", async (snap) => {
      const target = snap.selectedItems[0];
      if (target) await host.sys.quickLook(target.path);
    });
    // While the panel is open, follow the selection — clicking another file
    // refreshes the preview in place (no-op when the panel is closed).
    host.events.on("selection:changed", (payload) => {
      const items = (payload as { items?: { path: string }[] }).items ?? [];
      const target = items[0];
      if (target) void host.sys.previewUpdate(target.path).catch(() => {}); // no-op when panel closed
    });
  },
});
