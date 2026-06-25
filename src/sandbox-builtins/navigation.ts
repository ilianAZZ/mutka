import { defineModule } from "../core/sandbox/defineModule";

// Default open behavior at priority 0: folders navigate in place, files open
// with the system. Any module can register a higher-priority open handler to
// override these (e.g. an image viewer for .png).
export default defineModule({
  id: "core.navigation",
  name: "Navigation",
  version: "1.0.0",
  description: "Default open behavior: folders navigate in place, files open with the system.",
  permissions: ["navigation", "fs:read"],
  commands: [
    { id: "core.navigation.go-back", label: "Go Back", shortcut: "meta+[" },
    { id: "core.navigation.go-forward", label: "Go Forward", shortcut: "meta+]" },
    // ⌫ (Delete) also goes back, like the Finder. A separate command because a
    // single command binds a single shortcut; both just call host.nav.goBack().
    { id: "core.navigation.go-back-delete", label: "Go Back (Delete)", shortcut: "backspace" },
  ],
  openHandlers: [
    // A real folder navigates in place; a package (.app, …) is opaque, so it is
    // NOT matched here — it's launched by open-package below, like the Finder.
    { id: "core.navigation.open-folder", priority: 0, match: { isDir: true, isPackage: false }, handler: "open-folder" },
    { id: "core.navigation.open-file", priority: 0, match: { isDir: false }, handler: "open-file" },
    { id: "core.navigation.open-package", priority: 0, match: { isPackage: true }, handler: "open-package" },
  ],
  setup(host) {
    host.onCommand("core.navigation.go-back", () => { host.nav.goBack(); });
    host.onCommand("core.navigation.go-back-delete", () => { host.nav.goBack(); });
    host.onCommand("core.navigation.go-forward", () => { host.nav.goForward(); });
    host.onOpen("open-folder", (item) => { host.nav.navigate(item.path); });
    host.onOpen("open-file", (item) => { host.fs.openItem(item.path); });
    // Launch the bundle (e.g. run the .app) rather than browsing its contents.
    host.onOpen("open-package", (item) => { host.fs.openItem(item.path); });
  },
});
