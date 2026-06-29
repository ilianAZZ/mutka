import { defineModule } from "../core/sandbox/defineModule";

export default defineModule({
  id: "core.clipboard",
  name: "Clipboard",
  version: "1.0.0",
  description: "Copy, cut, and paste files via the native macOS pasteboard.",
  permissions: ["clipboard:read", "clipboard:write", "fs:write", "fs:read"],
  commands: [
    { id: "core.clipboard.copy", label: "Copy", icon: "copy", shortcut: "meta+c", contextMenu: true, contextMenuCategory: "Edit", when: { selection: "some" } },
    { id: "core.clipboard.cut", label: "Cut", icon: "cut", shortcut: "meta+x", contextMenu: true, contextMenuCategory: "Edit", when: { selection: "some" } },
    { id: "core.clipboard.paste", label: "Paste", icon: "paste", shortcut: "meta+v", contextMenu: true, contextMenuCategory: "Edit", when: { clipboard: "hasItems" } },
  ],
  setup(host) {
    host.onCommand("core.clipboard.copy", async (snap) => {
      await host.board.writeFiles(snap.selectedItems.map((i) => i.path), "copy");
    });
    host.onCommand("core.clipboard.cut", async (snap) => {
      await host.board.writeFiles(snap.selectedItems.map((i) => i.path), "cut");
    });
    host.onCommand("core.clipboard.paste", async (snap) => {
      const result = await host.board.readFiles();
      if (!result || result.paths.length === 0) return;
      try {
        // Only an explicit "cut" moves; anything else copies (the non-destructive
        // default), so a bad/unknown operation can never delete the source.
        if (result.operation === "cut") {
          await host.fs.moveFiles(result.paths, snap.currentDirectory);
          await host.board.writeFiles([], "copy"); // clear the pasteboard after a move
        } else {
          await host.fs.copyFiles(result.paths, snap.currentDirectory);
        }
      } finally {
        await host.refresh(); // reflect whatever landed, even on a partial failure
      }
    });
  },
});
