# Macows Explorer — Installation Guide

## Prerequisites

### 1. Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

### 2. Node.js (18+)

```bash
# Via nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install 20
nvm use 20
```

### 3. Tauri system dependencies (macOS)

```bash
# Xcode Command Line Tools — required for building
xcode-select --install
```

---

## Run in development

```bash
cd Macows-Explorer

# Install JS dependencies
npm install

# Start dev server + Tauri window
npm run tauri dev
```

The first build will take a few minutes while Cargo downloads and compiles Tauri.
Hot-reload is active: saving a `.tsx` file updates the UI instantly without restarting Tauri.

---

## Build for production

```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/macos/Macows Explorer.app`

---

## Project structure

```text
Macows-Explorer/
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Entry point (calls lib.rs)
│   │   └── lib.rs          # All Tauri commands (read_dir, copy, move…)
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src/                    # React + TypeScript frontend
│   ├── core/
│   │   ├── types.ts        # Foundation types
│   │   └── sandbox/        # defineModule, host gateway, module runtimes
│   │
│   ├── sandbox-builtins/   # Built-in modules (one defineModule file each)
│   │   ├── clipboard.ts    # copy, cut, paste
│   │   └── file-ops.ts     # new file, new folder, rename, delete
│   │
│   ├── components/
│   │   ├── FileList/
│   │   ├── Breadcrumb/
│   │   └── ContextMenu/
│   │
│   ├── App.tsx
│   ├── main.tsx
│   ├── moduleLoader.ts     # Auto-discovers built-in + community modules
│   └── styles/             # Liquid Glass CSS tokens, split by concern
│
├── package.json
└── vite.config.ts
```

---

## Writing a module

A module is one file that does `export default defineModule({ ... })`. It imports nothing
from the core and touches the system only through the `host` given to `setup`. Drop a
built-in in `src/sandbox-builtins/my-module.ts` and it's auto-discovered — no registration.

```typescript
// src/sandbox-builtins/my-module.ts
import { defineModule } from "../core/sandbox/defineModule";

export default defineModule({
  id: "community.my-module",   // must be unique
  name: "My Module",
  version: "1.0.0",
  permissions: ["dialog"],     // declare every capability host.* uses
  commands: [
    {
      id: "community.my-module.hello",
      label: "Say Hello",
      shortcut: "meta+h",
      contextMenu: true,
      when: { selection: "any" },
    },
  ],
  setup(host) {
    host.onCommand("community.my-module.hello", async (snapshot) => {
      await host.dialog.confirm({ message: `Hello from ${snapshot.currentDirectory}!` });
    });
  },
});
```

A community module is the same object literal, dropped in `~/.macows/modules/<id>/index.js`
(without the `defineModule` import), and runs isolated in a Web Worker. See
`COMMUNITY_MODULES.md`.

### Command snapshot

A command handler receives a serializable snapshot of app state:

| Property           | Type             | Description                      |
| ------------------ | ---------------- | -------------------------------- |
| `selectedItems`    | `FileItem[]`     | Currently selected files         |
| `currentDirectory` | `string`         | Absolute path of the open folder |
| `clipboard`        | `ClipboardState` | What's in the clipboard          |

Navigation, refresh, and dialogs are reached through `host.nav`, `host.refresh()`, and
`host.dialog` (each gated by a permission).

### Conditional commands

Visibility is declarative data (not a function), so it can cross the worker boundary:

```typescript
when: { selection: "single" },      // any | none | some | single | multiple | singleDir | singleFile | files | dirs
when: { clipboard: "hasItems" },    // e.g. gate a Paste command
```

### Calling Rust from a module

Modules never call `invoke` directly. Add a command in `src-tauri/src/lib.rs`:

```rust
#[tauri::command]
fn my_command(path: String) -> Result<String, String> {
    Ok(format!("got {}", path))
}
// Don't forget to add it to .invoke_handler(tauri::generate_handler![..., my_command])
```

Then expose it to modules by adding an entry to `src/core/sandbox/capabilities.ts` (the
single gateway), behind the appropriate permission. The module reaches it via `host.*`.
