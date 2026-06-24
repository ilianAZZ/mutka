import { invoke } from "@tauri-apps/api/core";
import type { MacowsModule } from "../../core/module-registry/module-registry.types";
import type { ClipboardState } from "../../core/types";
import { EventBus } from "../../core/event-bus/EventBus";
import { Events } from "../../core/event-bus/events";

interface ClipboardReadResult {
  paths: string[];
  operation: "copy" | "cut";
}

function emitClipboard(state: ClipboardState): void {
  EventBus.emit(Events.Clipboard.changed, state);
}

export const clipboardModule: MacowsModule = {
  id: "core.clipboard",
  name: "Clipboard",
  version: "1.0.0",
  description: "Copy, cut, and paste files via the native macOS pasteboard",
  actions: [
    {
      id: "core.clipboard.copy",
      label: "Copy",
      shortcut: "meta+c",
      showInContextMenu: true,
      showInToolbar: false,
      isEnabled: (ctx) => ctx.selectedItems.length > 0,
      execute: async (ctx) => {
        const paths = ctx.selectedItems.map((i) => i.path);
        await invoke("clipboard_write_files", { paths, operation: "copy" });
        emitClipboard({ items: [...ctx.selectedItems], operation: "copy" });
      },
    },
    {
      id: "core.clipboard.cut",
      label: "Cut",
      shortcut: "meta+x",
      showInContextMenu: true,
      separator: true,
      isEnabled: (ctx) => ctx.selectedItems.length > 0,
      execute: async (ctx) => {
        const paths = ctx.selectedItems.map((i) => i.path);
        await invoke("clipboard_write_files", { paths, operation: "cut" });
        emitClipboard({ items: [...ctx.selectedItems], operation: "cut" });
      },
    },
    {
      id: "core.clipboard.paste",
      label: "Paste",
      shortcut: "meta+v",
      showInContextMenu: true,
      // isEnabled reads from ctx.clipboard which is kept in sync by the EventBus listener
      isEnabled: (ctx) => ctx.clipboard.operation !== null && ctx.clipboard.items.length > 0,
      execute: async (ctx) => {
        const result = await invoke<ClipboardReadResult | null>("clipboard_read_files");
        if (!result || result.paths.length === 0) return;

        const command = result.operation === "copy" ? "copy_files" : "move_files";
        await invoke(command, { paths: result.paths, dest: ctx.currentDirectory });

        if (result.operation === "cut") {
          await invoke("clipboard_write_files", { paths: [], operation: "copy" });
          emitClipboard({ items: [], operation: null });
        }

        ctx.refresh();
      },
    },
  ],
};
