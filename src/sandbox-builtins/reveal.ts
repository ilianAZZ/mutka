import { defineModule } from "../core/sandbox/defineModule";

// EXAMPLE BUILT-IN MODULE — trusted, runs in-process via LocalHost.
// Note it is written in the EXACT same format as a community module and goes
// through the EXACT same permission gateway. The only difference from a
// community module is the runtime that loads it (LocalHost, not SandboxHost).
export default defineModule({
  id: "core.reveal",
  name: "Reveal",
  version: "1.0.0",
  description: "Open the selected item with the system default app.",
  permissions: [
    // "fs:read"
  ], // openItem requires fs:read — remove this and the call is denied
  commands: [
    {
      id: "core.reveal.open-with-system",
      label: "Open with System",
      icon: "new-tab",
      contextMenu: true,
      contextMenuCategory: "View",
      when: { selection: "single" },
    },
  ],
  setup(host) {
    host.onCommand("core.reveal.open-with-system", async (snap) => {
      const target = snap.selectedItems[0];
      if (target) await host.fs.openItem(target.path);
    });
  },
});
