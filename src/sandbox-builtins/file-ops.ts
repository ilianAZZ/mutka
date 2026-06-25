import { defineModule } from "../core/sandbox/defineModule";

export default defineModule({
  id: "core.file-ops",
  name: "File Operations",
  version: "1.0.0",
  description: "Create, rename, and delete files and folders.",
  permissions: ["fs:write", "fs:read", "dialog"],
  commands: [
    { id: "core.file-ops.new-file", label: "New File", icon: "new-file", shortcut: "meta+alt+n", contextMenu: true, contextMenuCategory: "File" },
    { id: "core.file-ops.new-folder", label: "New Folder", icon: "new-folder", shortcut: "meta+shift+n", contextMenu: true, contextMenuCategory: "File" },
    { id: "core.file-ops.rename", label: "Rename", icon: "rename", shortcut: "f2", contextMenu: true, contextMenuCategory: "Selection", when: { selection: "single" } },
    { id: "core.file-ops.delete", label: "Delete", icon: "delete", shortcut: "meta+backspace", contextMenu: true, contextMenuCategory: "Selection", when: { selection: "some" } },
  ],
  setup(host) {
    host.onCommand("core.file-ops.new-file", async (snap) => {
      const name = (await host.dialog.prompt({ message: "New file name:", placeholder: "untitled.txt" })) as string | null;
      if (!name) return;
      await host.fs.createFile(`${snap.currentDirectory}/${name}`);
      await host.refresh();
    });

    host.onCommand("core.file-ops.new-folder", async (snap) => {
      const name = (await host.dialog.prompt({ message: "New folder name:", placeholder: "New Folder" })) as string | null;
      if (!name) return;
      await host.fs.createFolder(`${snap.currentDirectory}/${name}`);
      await host.refresh();
    });

    host.onCommand("core.file-ops.rename", async (snap) => {
      const item = snap.selectedItems[0];
      if (!item) return;
      const newName = (await host.dialog.prompt({ message: "Rename to:", defaultValue: item.name })) as string | null;
      if (!newName || newName === item.name) return;
      const parent = item.path.substring(0, item.path.lastIndexOf("/"));
      await host.fs.renameItem(item.path, `${parent}/${newName}`);
      await host.refresh();
    });

    host.onCommand("core.file-ops.delete", async (snap) => {
      const names = snap.selectedItems.map((i) => i.name).join(", ");
      const confirmed = (await host.dialog.confirm({
        message: `Delete "${names}"?`,
        detail: "This cannot be undone.",
        destructive: true,
      })) as boolean;
      if (!confirmed) return;
      for (const item of snap.selectedItems) {
        await host.fs.deleteItem(item.path);
      }
      await host.refresh();
    });
  },
});
