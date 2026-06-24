import { invoke } from "@tauri-apps/api/core";
import type { MacowsModule } from "../../core/module-registry/module-registry.types";

export const fileOpsModule: MacowsModule = {
  id: "core.file-ops",
  name: "File Operations",
  version: "1.0.0",
  description: "Create, rename, and delete files and folders",
  actions: [
    {
      id: "core.file-ops.new-file",
      label: "New File",
      shortcut: "meta+alt+n",
      showInContextMenu: true,
      isEnabled: () => true,
      execute: async (ctx) => {
        const name = await ctx.dialog.prompt({ message: "New file name:", placeholder: "untitled.txt" });
        if (!name) return;
        await invoke("create_file", { path: `${ctx.currentDirectory}/${name}` });
        ctx.refresh();
      },
    },
    {
      id: "core.file-ops.new-folder",
      label: "New Folder",
      shortcut: "meta+shift+n",
      showInContextMenu: true,
      execute: async (ctx) => {
        const name = await ctx.dialog.prompt({ message: "New folder name:", placeholder: "New Folder" });
        if (!name) return;
        await invoke("create_dir_cmd", { path: `${ctx.currentDirectory}/${name}` });
        ctx.refresh();
      },
    },
    {
      id: "core.file-ops.rename",
      label: "Rename",
      shortcut: "f2",
      showInContextMenu: true,
      separator: true,
      isEnabled: (ctx) => ctx.selectedItems.length === 1,
      execute: async (ctx) => {
        const item = ctx.selectedItems[0];
        const newName = await ctx.dialog.prompt({
          message: "Rename to:",
          defaultValue: item.name,
        });
        if (!newName || newName === item.name) return;
        const parent = item.path.substring(0, item.path.lastIndexOf("/"));
        await invoke("rename_item", { from: item.path, to: `${parent}/${newName}` });
        ctx.refresh();
      },
    },
    {
      id: "core.file-ops.delete",
      label: "Delete",
      shortcut: "meta+backspace",
      showInContextMenu: true,
      isEnabled: (ctx) => ctx.selectedItems.length > 0,
      execute: async (ctx) => {
        const names = ctx.selectedItems.map((i) => i.name).join(", ");
        const confirmed = await ctx.dialog.confirm({
          message: `Delete "${names}"?`,
          detail: "This cannot be undone.",
          destructive: true,
        });
        if (!confirmed) return;
        for (const item of ctx.selectedItems) {
          await invoke("delete_item", { path: item.path });
        }
        ctx.refresh();
      },
    },
  ],
};
