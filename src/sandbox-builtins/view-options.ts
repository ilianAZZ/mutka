import { defineModule } from "../core/sandbox/defineModule";

// Toggles whether hidden/system files (dotfiles) appear in the listing — the
// Finder's ⌘⇧. behavior. The preference lives in core's ViewStore (persisted);
// flipping it re-reads the current directory. A built-in like any other: it
// reaches the toggle only through the gated `view` capability.
export default defineModule({
  id: "core.view-options",
  name: "View Options",
  version: "1.0.0",
  description: "Show or hide hidden/system files (dotfiles).",
  permissions: ["view"],
  commands: [
    {
      id: "core.view-options.toggle-hidden",
      label: "Show Hidden Files",
      icon: "eye",
      shortcut: "meta+shift+.",
      contextMenu: true,
      contextMenuCategory: "View",
      // Background-only: this is a directory-wide toggle, not a per-item action.
      contextMenuZones: ["background"],
    },
  ],
  setup(host) {
    host.onCommand("core.view-options.toggle-hidden", () => {
      host.view.toggleHidden();
    });
  },
});
