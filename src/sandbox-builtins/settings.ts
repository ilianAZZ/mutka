import { defineModule } from "../core/sandbox/defineModule";

// Opening settings is a feature, not core UI — so it lives here as a command bound
// to ⌘, (routed through ShortcutManager like every other shortcut). The command
// flips SettingsStore via the `settings` capability; App renders the panel from it.
export default defineModule({
  id: "core.settings",
  name: "Settings",
  version: "1.0.0",
  description: "Open the settings panel (⌘,).",
  permissions: ["view"],
  commands: [
    {
      id: "core.settings.toggle",
      label: "Settings…",
      icon: "settings",
      shortcut: "meta+,",
      contextMenu: false,
    },
  ],
  setup(host) {
    host.onCommand("core.settings.toggle", async () => { await host.settings.toggle(); });
  },
});
