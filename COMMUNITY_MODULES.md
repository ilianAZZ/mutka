# Community Modules — Developer Guide

Mutka is built around a module system. Every feature — clipboard, navigation,
file ops — is a module, and they all use the **same format** you'll use here. A community
module is a single ESM file that `export default`s a `defineModule(...)` object. It imports
nothing: everything it can do arrives through the `host` it's given, and every `host` call
is checked against the permissions it declares.

The key difference between built-in and community modules is **where they run**: built-ins
run in-process; **your community module runs ISOLATED in a Web Worker** — no DOM, no
`invoke`, no reference to the app. It can only reach the system through permission-checked
capability calls. This is by design (see [Security model](#security-model)).

---

## How modules are loaded

At startup Mutka scans `~/.mutka/modules/` and loads each module into its own isolated
worker, after the built-in modules (so built-in open handlers at priority 0 are registered
before your overrides).

```text
~/.mutka/modules/
  com.dir-stats/
    index.js        ← your module, a single ESM file (required)
```

The app reads `index.js` over IPC and runs it inside a worker. Because the worker has no
module resolver, **your file must be self-contained** — pre-bundle any dependencies into the
one file. Do NOT `import` from `@tauri-apps/api`, the core, or anything else; you don't need
to, and it won't resolve.

> **Dev tip:** during `tauri dev`, modules in this repo's `dev-modules/<id>/index.js` are
> loaded through the same isolated worker path, so you can iterate without installing. A
> complete working example lives at `dev-modules/com.dir-stats/index.js`.

---

## Writing a module

A module is an object with `id`, `name`, `version`, `permissions`, optional `commands` /
`openHandlers`, and a `setup(host)` function. Here is the full canonical example (this is
the real `dev-modules/com.dir-stats/index.js`):

```javascript
// ~/.mutka/modules/com.dir-stats/index.js
//
// Untrusted, runs ISOLATED in a Web Worker. Imports NOTHING — everything it can
// do arrives through `host`, and every host call is gated by the permissions
// declared below.
export default {
  id: "com.dir-stats",
  name: "Directory Stats",
  version: "1.0.0",
  permissions: ["fs:read"],          // declare every capability you use, or it's denied
  commands: [
    {
      id: "com.dir-stats.count",
      label: "Count items here (sandboxed)",
      contextMenu: true,
      contextMenuCategory: "View",
      when: { selection: "any" },     // declarative visibility (see below)
    },
  ],
  setup(host) {
    host.onCommand("com.dir-stats.count", async (snap) => {
      const items = await host.fs.readDir(snap.currentDirectory);
      const dirs = items.filter((i) => i.isDir).length;
      host.log(
        `${snap.currentDirectory} → ${items.length} items (${dirs} folders, ${items.length - dirs} files)`
      );
    });
  },
};
```

> If you write in TypeScript you can `import { defineModule } from ".../defineModule"` for
> types during development and `export default defineModule({...})` — but the **shipped**
> `index.js` must be bundled to a self-contained file with no remaining imports. The plain
> object above is exactly what that bundle looks like.

### Contributions

**`commands`** — entries surfaced into menus / shortcuts. You register the handler in
`setup` with `host.onCommand(id, handler)`.

| Field                 | Type          | Notes                                                                               |
| --------------------- | ------------- | ----------------------------------------------------------------------------------- |
| `id`                  | `string`      | Globally unique, `"module-id.command-name"`.                                        |
| `label`               | `string`      | Shown in menus.                                                                     |
| `icon`                | `string?`     | Icon-registry key (unknown keys render nothing).                                    |
| `shortcut`            | `string?`     | Normalized, e.g. `"meta+shift+d"`, `"f2"`. Last registration wins on conflict.      |
| `contextMenu`         | `boolean?`    | Show in the right-click menu.                                                       |
| `contextMenuCategory` | `string?`     | Group header. Use `"File" / "Edit" / "Selection" / "View" / "Share"` or any string. |
| `when`                | `WhenClause?` | Declarative visibility (below).                                                     |

The handler receives a serializable **snapshot**:
`{ selectedItems: FileItem[], currentDirectory: string, clipboard: ClipboardState }`.

**`openHandlers`** — override double-click behavior for matching items. Register with
`host.onOpen(handlerId, handler)`.

```javascript
openHandlers: [
  { id: "com.img.open", priority: 10, match: { extensions: ["png", "jpg"] }, handler: "open-image" },
],
setup(host) {
  host.onOpen("open-image", (item) => { /* item: FileItem */ });
}
```

`match` is `{ isDir?: boolean; extensions?: string[] }`. `priority` 0 is the core default;
use a higher number to win. The handler receives the matched `FileItem`.

### Visibility — the `when` clause

A function predicate cannot cross the worker boundary, so visibility is **data**, evaluated
host-side (same approach as VS Code when-clauses):

```javascript
when: { selection: "single" }     // show only when exactly one item is selected
when: { clipboard: "hasItems" }   // e.g. a Paste command
```

`selection` values: `any` · `none` · `some` · `single` · `multiple` · `singleDir` ·
`singleFile` · `files` · `dirs`. `clipboard`: `"hasItems"`.

---

## The `host` API

Every method is **async** (returns a Promise) and gated by the permission in the right
column. Calling one without declaring its permission **throws**.

| Capability       | Methods                                                                                                   | Permission                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `host.fs`        | `readDir`, `openItem`, `copyFiles`, `moveFiles`, `deleteItem`, `renameItem`, `createFile`, `createFolder` | `fs:read` (reads/`openItem`) · `fs:write` (mutations) |
| `host.board`     | `readFiles`, `writeFiles(paths, "copy"\|"cut")`                                                           | `clipboard:read` / `clipboard:write`                  |
| `host.nav`       | `navigate`, `goBack`, `goForward`, `goUp`                                                                 | `navigation`                                          |
| `host.tabs`      | `openTab`, `openTabInBackground`, `isActive`                                                              | `navigation`                                          |
| `host.dialog`    | `prompt`, `confirm`                                                                                       | `dialog`                                              |
| `host.sys`       | `homeDir`                                                                                                 | `fs:read`                                             |
| `host.refresh()` | re-read the current directory                                                                             | `fs:read`                                             |

Non-privileged helpers (no permission needed):

- `host.onCommand(id, handler)` / `host.onOpen(handlerId, handler)` — register handlers.
- `host.events.on(event, handler)` — subscribe to a **whitelisted** app event (currently
  only `"input:mouse-navigate"` and `"file:modifier-open"`). Other events are ignored.
- `host.log(...args)` — forwarded to the app console, prefixed with your module id.

### Permissions

Declare every capability you use in `permissions`:

`fs:read` · `fs:write` · `clipboard:read` · `clipboard:write` · `navigation` · `dialog` ·
`network` · `shell`.

---

## Installing a module

```bash
mkdir -p ~/.mutka/modules/com.dir-stats
cp index.js ~/.mutka/modules/com.dir-stats/index.js
# restart Mutka
```

The module loads on next launch into its own isolated worker.

---

## Module ID convention

| Origin              | Format                      | Example              |
| ------------------- | --------------------------- | -------------------- |
| Community           | `author.module-name`        | `acme.git-status`    |
| Fork of existing    | `author.original-name-fork` | `bob.clipboard-fork` |
| Built-in (reserved) | `core.*`                    | `core.navigation`    |

IDs are permanent. **Never rename a module ID after users install it** — it breaks their install.

---

## Security model

Community modules are treated as **untrusted code** and enforced by two layers:

1. **Worker isolation** — your module runs in a Web Worker with no DOM, no `invoke`, and no
   reference to the app or core. Its only window on the world is `postMessage`. It physically
   cannot bypass the host: there is nothing privileged in its scope to reach for.

2. **Permission gateway** — every `host.*` call is checked by `core/sandbox/gateway.ts`
   against your declared `permissions`. The capability runs only if the required permission
   is present (the actual operation lives in `core/sandbox/capabilities.ts`, the single place
   that touches the file system, clipboard, navigation, or tabs). Undeclared → denied.

**See it yourself:** in the example above, remove `"fs:read"` from `permissions` and reload.
The same code now throws on `host.fs.readDir(...)`:

```text
Permission denied: "fs.readDir" requires "fs:read", which "com.dir-stats" did not declare.
```

Add it back and the call works again. This is the contract: declare what you use, get exactly
that, nothing more.

---

## Open questions (tracked in CLAUDE.md)

- **Registry URL**: npm tag `mutka-module`? Custom JSON endpoint? GitHub topic?
- **Module namespace**: `author.name` (current) vs `@author/name`?
- **Custom UI from a worker**: sidebar panels from a sandboxed module are not supported yet
  (rendering React across the worker boundary is a separate problem). Core UI may register
  panels directly today.
- **Code signing**: trust model for distributed modules.
