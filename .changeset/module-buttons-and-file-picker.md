---
bump: minor
---

Stage 2 of local module install: a module-contributed button extension point + a
Mutka file picker.

- **`moduleManagerButtons`** — a new manifest field so ANY module can add buttons to
  the Modules overlay (Browse tab). Click → the module's `host.onUIEvent(id, …)`
  handler. Registered/rendered like other contributions (`ModuleRegistry
  .getModuleManagerButtons`).
- **`host.dialog.pickFile(options?)`** — a new capability (gated by `dialog`) that
  opens a Mutka-native file-browser modal (`FilePickerModal`, reusing
  `FileSystemRegistry`) and resolves with the chosen path or null. `options.fileNames`
  restricts which files are selectable (e.g. `["index.js"]`).
- The built-in **Local Installer** now adds an **"Import local file"** button that
  opens the picker and installs the chosen `index.js` (via the same review dialog as
  the context-menu and GitHub paths).
