import { defineModule } from "../core/sandbox/defineModule";

// Install a Mutka module straight from a local file: right-click an `index.js` in
// the explorer → "Install as Mutka module". The action is visible ONLY on files
// named index.js (a module's entry point) via the when-clause. The handler reads
// the file (fs:read) and hands the source to the install flow (discovery), which
// opens the permission-review dialog before anything is written — same consent path
// as a GitHub install. Stage 2 adds a Browse-tab "Import local file" button + picker.

interface SelectedFile {
  path: string;
  name: string;
  isDir: boolean;
}

export default defineModule({
  id: "core.local-installer",
  name: "Local Installer",
  version: "1.0.0",
  description: "Install a module from a local index.js — right-click a file, or the Browse-tab button.",
  permissions: ["fs:read", "discovery", "dialog"],
  commands: [
    {
      id: "core.local-installer.install",
      label: "Install as Mutka module",
      icon: "download",
      contextMenu: true,
      contextMenuCategory: "Modules",
      // Only on a single file named index.js — i.e. a module entry point.
      when: { selection: "singleFile", fileNames: ["index.js"] },
    },
  ],
  // A button in the Modules overlay (Browse tab) → opens the Mutka file picker.
  moduleManagerButtons: [
    { id: "core.local-installer.import", label: "Import local file", icon: "download" },
  ],
  setup(host) {
    // Read a local index.js (fs:read) and hand it to the install flow (discovery),
    // which opens the permission-review dialog before anything is written.
    const installFromPath = async (path: string): Promise<void> => {
      const bytes = (await host.fs.readBytes(path)) as Uint8Array;
      await host.modules.install(new TextDecoder().decode(bytes));
    };

    host.onCommand("core.local-installer.install", async (snapshot) => {
      const item = (snapshot as { selectedItems: SelectedFile[] }).selectedItems[0];
      if (item && !item.isDir) await installFromPath(item.path);
    });

    host.onUIEvent("core.local-installer.import", async () => {
      const path = (await host.dialog.pickFile({
        title: "Select a module's index.js",
        fileNames: ["index.js"],
      })) as string | null;
      if (path) await installFromPath(path);
    });
  },
});
