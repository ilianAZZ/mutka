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
│   │   ├── types.ts        # MacowsModule / MacowsAction contract
│   │   ├── ModuleRegistry.ts
│   │   ├── EventBus.ts
│   │   └── ShortcutManager.ts
│   │
│   ├── modules/            # Built-in modules (each is a MacowsModule)
│   │   ├── clipboard/      # copy, cut, paste
│   │   └── file-ops/       # new file, new folder, rename, delete
│   │
│   ├── components/
│   │   ├── FileList.tsx
│   │   ├── Breadcrumb.tsx
│   │   └── ContextMenu.tsx
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
│
├── package.json
└── vite.config.ts
```

---

## Writing a module

A module is a plain TypeScript object implementing `MacowsModule`. Drop it in
`src/modules/your-module/index.ts`, register it in `App.tsx`, and it's live.

```typescript
// src/modules/my-module/index.ts
import { MacowsModule } from "../../core/types";

export const myModule: MacowsModule = {
  id: "community.my-module",   // must be unique
  name: "My Module",
  version: "1.0.0",
  actions: [
    {
      id: "my-module.hello",
      label: "Say Hello",
      shortcut: "meta+h",
      showInContextMenu: true,
      execute: (ctx) => {
        alert(`Hello from ${ctx.currentDirectory}!`);
      },
    },
  ],
};
```

```typescript
// src/App.tsx — add two lines
import { myModule } from "./modules/my-module";
ModuleRegistry.register(myModule);
```

### Action context

| Property           | Type             | Description                      |
| ------------------ | ---------------- | -------------------------------- |
| `selectedItems`    | `FileItem[]`     | Currently selected files         |
| `currentDirectory` | `string`         | Absolute path of the open folder |
| `clipboard`        | `ClipboardState` | What's in the clipboard          |
| `navigate(path)`   | `fn`             | Open a different folder          |
| `refresh()`        | `fn`             | Re-read current folder           |

### Conditional actions

```typescript
isEnabled: (ctx) => ctx.selectedItems.length > 0,
isVisible: (ctx) => ctx.selectedItems.every(i => !i.isDir),
```

### Calling Rust from a module

Add a command in `src-tauri/src/lib.rs`:

```rust
#[tauri::command]
fn my_command(path: String) -> Result<String, String> {
    Ok(format!("got {}", path))
}
// Don't forget to add it to .invoke_handler(tauri::generate_handler![..., my_command])
```

Call it from TypeScript:

```typescript
import { invoke } from "@tauri-apps/api/core";
const result = await invoke<string>("my_command", { path: "/some/path" });
```
