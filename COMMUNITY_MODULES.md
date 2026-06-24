# Community Modules — Developer Guide

Macows Explorer is built around a module system. Every feature — clipboard, navigation, file ops — is a module. Community members can build and distribute their own modules using the same API.

---

## How modules are loaded (production)

At startup, Macows Explorer scans `~/.macows/modules/` for community modules and loads them alongside the built-in ones. Built-in modules are bundled into the app; community modules live on disk and are loaded dynamically at runtime.

```text
~/.macows/modules/
  my-extension/
    index.js        ← pre-bundled ESM (required)
    manifest.json   ← metadata for the future marketplace (optional for now)
  another-module/
    index.js
```

**Loading mechanism:** Macows reads the JS file via IPC, wraps it in a Blob URL, and `import()`s it. This means your module must be **pre-bundled into a single file** — you can't use `import` statements at the top of your module. All dependencies must be inlined by your bundler.

---

## Writing a module

A module is a plain JavaScript object that satisfies the `MacowsModule` shape. Export it as a named or default export from `index.js`.

```javascript
// ~/.macows/modules/my-extension/index.js

// Use window.__TAURI__.core.invoke — NOT `import { invoke } from "@tauri-apps/api/core"`
// Static imports are unavailable in a community module (blob context).
const { invoke } = window.__TAURI__.core;

export const myExtension = {
  id: "acme.my-extension",       // unique forever — never change after publish
  name: "My Extension",
  version: "1.0.0",
  description: "One sentence describing what this module does.",

  actions: [
    {
      id: "acme.my-extension.do-thing",
      label: "Do Thing",
      shortcut: "meta+shift+d",
      showInContextMenu: true,

      isEnabled: (ctx) => ctx.selectedItems.length > 0,

      execute: async (ctx) => {
        const paths = ctx.selectedItems.map((i) => i.path);
        await invoke("open_item", { path: paths[0] });
        ctx.refresh();
      },
    },
  ],
};
```

### `ActionContext` — what you get in `execute`

| Property                    | Type                      | Description                          |
| --------------------------- | ------------------------- | ------------------------------------ |
| `selectedItems`             | `FileItem[]`              | Currently selected files/folders     |
| `currentDirectory`          | `string`                  | Active directory path                |
| `clipboard`                 | `ClipboardState`          | Read-only clipboard snapshot         |
| `navigation.navigate(path)` | `(path: string) => void`  | Navigate to a directory              |
| `navigation.goBack()`       | `() => void`              | Go back in history                   |
| `navigation.goForward()`    | `() => void`              | Go forward in history                |
| `navigation.canGoBack`      | `boolean`                 | Whether back is available            |
| `navigation.canGoForward`   | `boolean`                 | Whether forward is available         |
| `refresh()`                 | `() => void`              | Reload the current directory listing |
| `dialog.prompt(opts)`       | `Promise<string \| null>` | Show a text-input dialog             |
| `dialog.confirm(opts)`      | `Promise<boolean>`        | Show a confirm dialog                |

### `FileItem` — the shape of a file/folder

```typescript
interface FileItem {
  name: string;
  path: string;
  isDir: boolean;
  size: number;        // bytes
  modified: number;    // Unix timestamp (seconds)
  extension?: string;  // "png", "ts", etc. — absent for directories
}
```

---

## Bundling your module

Your source can be TypeScript. Use Vite in library mode to produce a single ESM file.

**Minimal `vite.config.ts` for a community module:**

```typescript
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      // Do NOT externalize anything — everything must be inlined.
      // The module is loaded from a blob URL and cannot resolve bare specifiers.
      external: [],
    },
    outDir: "dist",
  },
});
```

Run `vite build` → copy `dist/index.js` to `~/.macows/modules/<your-id>/index.js`.

**Exception:** `window.__TAURI__` is available as a global — don't bundle it.

---

## Installing a module

```bash
# Create the modules directory if it doesn't exist
mkdir -p ~/.macows/modules/my-extension

# Copy your bundled output
cp dist/index.js ~/.macows/modules/my-extension/index.js

# Restart Macows Explorer
```

The module is registered on next app launch. No build step is needed on the user's machine.

---

## Module ID convention

| Origin              | Format                      | Example              |
| ------------------- | --------------------------- | -------------------- |
| Community           | `author.module-name`        | `acme.git-status`    |
| Fork of existing    | `author.original-name-fork` | `bob.clipboard-fork` |
| Built-in (reserved) | `core.*`                    | `core.navigation`    |

IDs are permanent. **Never rename a module ID after users install it** — it would break their install.

---

## Security model

Community modules run in the same WebView as the app, with full access to the `ActionContext` and all Tauri commands the app exposes. There is currently no sandbox.

**What a module can do:**
- Call any Tauri command already registered in `lib.rs` via `invoke()`
- Subscribe to and emit EventBus events
- Register new actions, open handlers, and sidebar panels

**What a module cannot do (yet):**
- Register new Tauri commands (Rust code must be in the app binary)
- Access the network directly (no Tauri http plugin is exposed)
- Modify the DOM outside its sidebar panel component

Future versions will add a `permissions` field to the `MacowsModule` interface so users can see and approve what each module can access before installing.

---

## Planned: in-app marketplace (Phase 2)

The goal is a VS Code-style extension panel built into Macows Explorer. The planned flow:

1. **Module registry** — a public JSON endpoint (or npm tag `macows-module`) lists available modules with metadata: `id`, `name`, `description`, `version`, `author`, `downloadUrl`.

2. **Module Manager UI** — a built-in sidebar panel (`core.module-manager`) that browses the registry, shows installed modules, and lets users install/uninstall/update.

3. **Install flow** — the Module Manager downloads the bundled `index.js` to `~/.macows/modules/<id>/` and optionally hot-reloads the module without a restart (using `ModuleRegistry.unregister()` + re-import).

4. **Permission UI** — before install, the user sees a list of the module's declared permissions (e.g. `invoke:delete_item`, `invoke:open_item`).

### What to implement now (Phase 1 → 2 bridge)

Add `manifest.json` next to your `index.js` so the future marketplace can read it:

```json
{
  "id": "acme.my-extension",
  "name": "My Extension",
  "version": "1.0.0",
  "description": "One sentence.",
  "author": "Your Name",
  "homepage": "https://github.com/you/my-extension",
  "permissions": ["invoke:open_item"]
}
```

This file is ignored today but will be required by the marketplace.

---

## Open questions (tracked in CLAUDE.md)

- **Registry URL**: npm tag `macows-module`? Custom JSON endpoint? GitHub topic?
- **Module namespace**: `author.name` (current) vs `@author/name`?
- **Permission enforcement**: declared vs. runtime-enforced?
- **Code signing**: trust model for marketplace modules?
