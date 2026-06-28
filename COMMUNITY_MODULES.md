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
> loaded through the same isolated worker path, so you can iterate without installing.
> Working examples: `dev-modules/com.dir-stats/index.js` (a command),
> `dev-modules/com.folder-inspector/index.js` (a declarative panel + form + status item),
> `dev-modules/com.webdav/index.js` (a virtual filesystem + settings UI), and
> `dev-modules/com.sqlite-browser/index.js` (claims `.sqlite` files, browses tables/rows in
> the right pane by reading the bytes with `fs:read` and decoding the SQLite file format
> in-worker — the reference for parsing a file format without a host capability).

---

## TypeScript types (optional but recommended)

The fastest start is the scaffolder — it generates a typed project (a working
`src/index.ts`, the types dependency, and a one-file `tsup` build) for you:

```bash
npm create @mutka-explorer@latest my-module
```

You can also write plain JS, or add the types to an existing project by hand. For
full IntelliSense and type-checking on `host`, permissions, `when` clauses, and the
declarative UI tree, install the types package and write TypeScript:

```bash
npm i -D @mutka-explorer/module
```

```ts
import { defineModule } from "@mutka-explorer/module";

export default defineModule({
  id: "you.hello",
  permissions: ["fs:read"],
  commands: [{ id: "you.hello.count", label: "Count", when: { selection: "any" } }],
  setup(host) {
    host.onCommand("you.hello.count", async (snap) => { /* host is fully typed */ });
    // host.onCommand("you.hello.typo", …)   ← compile error: not a declared command id
  },
});
```

`defineModule` is the package's **only** runtime export — an identity function
(`def => def`). It exists purely so TypeScript can infer your `commands[].id`s and type
`host.onCommand` to them, so a typo'd or stale id fails at compile time. A bundler
inlines it, so your built file stays self-contained. (Prefer no runtime import? Use
`import type { SandboxModuleDef }` and annotate `SandboxModuleDef<"you.hello.count">` —
same matching, purely in types.) The package is generated from this app's source and
versioned in lockstep with the app, so the types always match the host API. Then bundle
to one ESM file (e.g. `tsup src/index.ts --format esm`) before installing. See
`packages/module-sdk/`.

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

## Rendering UI — declarative, no React (requires `ui`)

Your module runs in a worker, so it **cannot ship a React component**. Instead you describe
UI as a serializable **`UINode` tree** and the host renders it natively. You can fill four
surfaces, all with the same node format:

- **A side-pane panel** — declare `panels: [{ id, title, icon, side?, defaultWidth? }]`.
- **A settings section** — declare `settingsSections: [{ id, title }]`.
- **A status-bar item** (dynamic) — `host.statusbar.set({ id, text, icon, badge, onClick })`.
- **A modal** — `host.ui.modal(node)` to open, `host.ui.modal(null)` to close.

Fill a panel/section by rendering into its surface id: `host.ui.render(surfaceId, node)`.
Re-render anytime to update it (e.g. from a `selection:changed` or `directory:changed` event).

```javascript
export default {
  id: "acme.inspector",
  name: "Inspector",
  version: "1.0.0",
  permissions: ["ui"],
  panels: [{ id: "panel", title: "Inspector", icon: "info", side: "right" }],
  setup(host) {
    const render = (n) => host.ui.render("panel", {
      type: "vstack", gap: 8, children: [
        { type: "text", text: `${n} selected`, weight: "bold" },
        { type: "divider" },
        { type: "button", label: "Say hi", action: "hi", variant: "primary" },
        { type: "form", action: "save", submitLabel: "Save",
          schema: { type: "object", required: ["name"],
            properties: { name: { type: "string", title: "Name" } } } },
      ],
    });
    host.events.on("app:ready", () => render(0));
    host.events.on("selection:changed", (p) => render((p.items || []).length));
    host.onUIEvent("hi", () => host.ui.modal({ type: "text", text: "Hi!" }));
    host.onUIEvent("save", (values) => host.log("form:", values)); // values = the form object
  },
};
```

**Nodes:** `vstack` / `hstack` (layout), `text`, `row` (label+value), `button`, `list`,
`badge`, `icon`, `image` (data-URI only), `divider`, `spacer`, and `form`. Buttons, list rows
and forms carry an `action` id you handle with `host.onUIEvent(id, handler)` — a form's handler
receives the collected values object.

**Forms** are a `form` node carrying a **`schema`** in a JSON-Schema-subset (`type: "object"`
with `properties` + `required`). It's the standard format — generate it from zod with
`z.toJSONSchema()` (zod v4) or `zod-to-json-schema`, then re-validate the returned values with
your zod schema inside the worker.

**Status bar** items: `{ id, text?, icon?, tint?, badge?, tooltip?, side?, onClick? }` where
`onClick` is `{ command: "<id>" }` or `{ popover: "<surfaceId>" }` (render that surface first).
Colours (`tint`) must be `var(--…)` design tokens; anything else is dropped.

> A complete working example lives at `dev-modules/com.folder-inspector/index.js`.

---

## The `host` API

Every method is **async** (returns a Promise) and gated by the permission in the right
column. Calling one without declaring its permission **throws**.

| Capability       | Methods                                                                                                                               | Permission                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `host.fs`        | `readDir`, `openItem`, `readBytes`, `cloudStatus`, `copyFiles`, `moveFiles`, `deleteItem`, `renameItem`, `createFile`, `createFolder` | `fs:read` (reads/`openItem`/`readBytes`) · `fs:write` (mutations) |
| `host.board`     | `readFiles`, `writeFiles(paths, "copy"\|"cut")`                                                                                       | `clipboard:read` / `clipboard:write`                              |
| `host.nav`       | `navigate`, `goBack`, `goForward`, `goUp`                                                                                             | `navigation`                                                      |
| `host.tabs`      | `openTab`, `openTabInBackground`, `isActive`                                                                                          | `navigation`                                                      |
| `host.dialog`    | `prompt`, `confirm`, `choose`                                                                                                         | `dialog`                                                          |
| `host.ui`        | `render(surfaceId, node)`, `clear(surfaceId)`, `modal(node\|null)`                                                                    | `ui`                                                              |
| `host.statusbar` | `set(item)`, `remove(itemId)`                                                                                                         | `ui`                                                              |
| `host.net`       | `request`, `download`, `upload`                                                                                                       | `network`                                                         |
| `host.config`    | `get(key)`, `set(key, value)`                                                                                                         | `storage`                                                         |
| `host.secrets`   | `get(key)`, `set(key, value)`, `delete(key)`                                                                                          | `secrets`                                                         |
| `host.sys`       | `homeDir`, `lastDir`, `writeTempFile`, `quickLook`, `appsForFile`, `openWith`, …                                                      | `fs:read` (most) · `fs:temp` (`writeTempFile`)                    |
| `host.refresh()` | re-read the current directory                                                                                                         | `fs:read`                                                         |

Non-privileged helpers (no permission needed):

- `host.onCommand(id, handler)` / `host.onOpen(handlerId, handler)` — register handlers.
- `host.onColumn(id, provider)` — produce a custom list-column cell value.
- `host.onUIEvent(id, handler)` — handle a button/list/form interaction in your declarative UI.
- `host.events.on(event, handler)` — subscribe to a **whitelisted** app event (`app:ready`,
  `selection:changed`, `directory:changed`, `input:mouse-navigate`, `file:modifier-open`,
  `file:middle-open`, `file:open-no-app`, `file:external-drop`, `sidebar:item-remove`). Other
  events are ignored.
- `host.log(...args)` — forwarded to the app console, prefixed with your module id.

### Permissions

Declare every capability you use in `permissions`:

`fs:read` · `fs:write` · `fs:temp` · `clipboard:read` · `clipboard:write` · `navigation` ·
`view` · `dialog` · `network` · `storage` · `secrets` · `ui` · `shell`.

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
- **Richer UI from a worker**: sandboxed modules now render declarative panels, settings,
  modals and status-bar items (see "Rendering UI" above). The `UINode` vocabulary is
  deliberately small — custom layout/animation and a panel's direct read of the current
  directory are still open.
- **Code signing**: trust model for distributed modules.
