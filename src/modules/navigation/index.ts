import { invoke } from "@tauri-apps/api/core";
import { MacowsModule } from "../../core/types";

// Default open handlers at priority 0.
// Any module can register a higher-priority handler to override these.
//
// Example: a "tabs" module registers priority 10 for folders → its handler
// runs instead of navigate(), opening the folder in a new tab.

export const navigationModule: MacowsModule = {
  id: "core.navigation",
  name: "Navigation",
  version: "1.0.0",
  description: "Default open behavior: folders navigate in place, files open with the system",
  actions: [
    {
      id: "core.navigation.go-back",
      label: "Go Back",
      shortcut: "meta+[",
      showInContextMenu: false,
      isEnabled: (ctx) => ctx.navigation.canGoBack,
      execute: (ctx) => ctx.navigation.goBack(),
    },
    {
      id: "core.navigation.go-forward",
      label: "Go Forward",
      shortcut: "meta+]",
      showInContextMenu: false,
      isEnabled: (ctx) => ctx.navigation.canGoForward,
      execute: (ctx) => ctx.navigation.goForward(),
    },
  ],
  openHandlers: [
    {
      id: "navigation.open-folder",
      priority: 0,
      matches: (item) => item.isDir,
      handle: (item, ctx) => ctx.navigation.navigate(item.path),
    },
    {
      id: "navigation.open-file",
      priority: 0,
      matches: (item) => !item.isDir,
      handle: (item) => invoke("open_item", { path: item.path }),
    },
  ],
};
