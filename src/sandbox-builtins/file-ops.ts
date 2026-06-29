import { defineModule } from "../core/sandbox/defineModule";

/** Join a directory and a child name — safe at the root "/" (no "//name") and for
 *  scheme paths (webdav:acc/sub). */
function joinPath(dir: string, name: string): string {
  return `${dir.replace(/\/+$/, "")}/${name}`;
}

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
      await host.fs.createFile(joinPath(snap.currentDirectory, name));
      await host.refresh();
    });

    host.onCommand("core.file-ops.new-folder", async (snap) => {
      const name = (await host.dialog.prompt({ message: "New folder name:", placeholder: "New Folder" })) as string | null;
      if (!name) return;
      await host.fs.createFolder(joinPath(snap.currentDirectory, name));
      await host.refresh();
    });

    host.onCommand("core.file-ops.rename", async (snap) => {
      const item = snap.selectedItems[0];
      if (!item) return;
      const newName = (await host.dialog.prompt({ message: "Rename to:", defaultValue: item.name })) as string | null;
      if (!newName || newName === item.name) return;
      // The item lives in the current directory, so derive the target from it
      // (root- and scheme-safe) rather than re-splitting item.path.
      await host.fs.renameItem(item.path, joinPath(snap.currentDirectory, newName));
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
      // Delete each independently so one failure doesn't abort the rest, then
      // surface what couldn't be deleted (the throw → error toast).
      const failed: string[] = [];
      for (const item of snap.selectedItems) {
        try {
          await host.fs.deleteItem(item.path);
        } catch (err) {
          failed.push(item.name);
          host.log(`delete failed for ${item.name}:`, err);
        }
      }
      await host.refresh();
      if (failed.length) throw new Error(`Couldn't delete: ${failed.join(", ")}`);
    });
  },
});
