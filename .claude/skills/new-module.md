---
name: new-module
description: Create a new Mutka module with commands and open handlers using defineModule. Use when adding any new feature to the app.
---

# Skill: Create a new Mutka module

Use this skill whenever asked to add a new feature, command, or open handler to the app.

A module is a single ESM file that does `export default defineModule({ ... })`. It
imports NOTHING from the core — its only window on the system is the `host` object
passed to `setup(host)`. Built-in and community modules use the identical shape.

- **Built-in** modules live at `src/sandbox-builtins/<name>.ts` and run in-process via
  `LocalHost`.
- **Community** modules are plain ESM at `~/.mutka/modules/<id>/index.js` and run
  ISOLATED in a Web Worker via `SandboxHost`. They cannot import `defineModule`, so they
  `export default { ... }` the same object literal.

Every capability a module uses must be declared in `permissions[]`, or the gateway
denies the call.

## Step-by-step

### 1. Choose the module ID

Format: `core.<name>` for built-ins, `<author>.<name>` for community modules.
The ID is permanent — it can never be renamed after users install the module.

### 2. Create the file

```text
src/sandbox-builtins/<name>.ts        ← built-in (in this repo)
~/.mutka/modules/<id>/index.js       ← community (on the user's disk)

```

One file per module. Keep it small.

### 3. Write the module

```typescript
// src/sandbox-builtins/<name>.ts
import { defineModule } from "../core/sandbox/defineModule";

export default defineModule({
  id: "author.module-name",
  name: "Human Readable Name",
  version: "1.0.0",
  description: "One sentence description.",
  permissions: ["fs:write", "dialog"],   // declare EVERY capability host.* uses
  commands: [
    {
      id: "author.module-name.do-thing",   // MUST start with the module ID
      label: "Do Thing",
      shortcut: "meta+k",                   // optional
      icon: "trash",                        // optional, icon-registry key
      contextMenu: true,                    // show in right-click menu
      contextMenuCategory: "File",          // optional grouping
      when: { selection: "single" },        // serializable visibility (see below)
    },
  ],
  setup(host) {
    host.onCommand("author.module-name.do-thing", async (snapshot) => {
      // snapshot = { selectedItems, currentDirectory, clipboard }
      const item = snapshot.selectedItems[0];
      const ok = await host.dialog.confirm({ message: `Delete ${item.name}?`, destructive: true });
      if (!ok) return;
      await host.fs.deleteItem(item.path);
      await host.refresh();
    });
  },
});

```

A community module is byte-identical except it drops the `import` and exports the
object literal directly: `export default { id: "...", ... }`.

### 4. Command visibility — the `when` clause

Visibility is data, not a function (predicates can't cross the worker boundary).
The host evaluates `when` against the live snapshot.

`when.selection`: `any` | `none` | `some` | `single` | `multiple` | `singleDir` |
`singleFile` | `files` | `dirs`.
`when.clipboard`: `"hasItems"` (e.g. to gate a Paste command).

### 5. The `host` API (all async)

| Group            | Methods                                                                                                   | Permission                           |
| ---------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `host.fs`        | `readDir`, `openItem`, `copyFiles`, `moveFiles`, `deleteItem`, `renameItem`, `createFile`, `createFolder` | `fs:read` / `fs:write`               |
| `host.board`     | `readFiles`, `writeFiles(paths, "copy" \| "cut")`                                                         | `clipboard:read` / `clipboard:write` |
| `host.nav`       | `navigate`, `goBack`, `goForward`, `goUp`                                                                 | `navigation`                         |
| `host.tabs`      | `openTab`, `openTabInBackground`, `isActive`                                                              | `navigation`                         |
| `host.dialog`    | `prompt({ message, placeholder?, defaultValue? })`, `confirm({ message, detail?, destructive? })`         | `dialog`                             |
| `host.sys`       | `homeDir`                                                                                                 | `fs:read`                            |
| `host.refresh()` | re-read the current directory after a mutation                                                            | `fs:read`                            |

Plus, registered inside `setup`:

- `host.onCommand(id, (snapshot) => {})` — run when a command fires.
- `host.onOpen(handlerId, (item) => {})` — run when an open handler matches (see `add-open-handler`).
- `host.events.on(event, handler)` — subscribe to a whitelisted event (`"input:mouse-navigate"`, `"file:modifier-open"`).
- `host.log(...)` — forwarded to the host console, prefixed with the module id.

Permissions: `fs:read`, `fs:write`, `clipboard:read`, `clipboard:write`, `navigation`,
`dialog`, `network`, `shell`.

### 6. Open handlers (if any)

See the `add-open-handler` skill. Declare them in `openHandlers: [...]` and register
the runner with `host.onOpen(handlerId, (item) => {})`.

### 7. If a new Tauri command is needed

Read `src-tauri/CLAUDE.md` and follow the "Adding a Tauri command" steps. Then expose
it to modules by adding an entry to `src/core/sandbox/capabilities.ts` (the single
gateway) — modules never call `invoke` directly.

## No registration step

Built-in modules are auto-discovered by `src/moduleLoader.ts` (`import.meta.glob` over
`src/sandbox-builtins/*.ts`). Community modules are loaded from `~/.mutka/modules/`.
No `App.tsx` changes are ever needed.

## Checklist before finishing

- [ ] Module ID is unique and follows `author.name` format
- [ ] All command / handler IDs are prefixed with the module ID
- [ ] Every `host.*` capability used is declared in `permissions[]`
- [ ] Command `execute` logic lives in `host.onCommand`, not inline in `commands`
- [ ] `host.refresh()` is called after any file-system mutation
- [ ] A built-in imports ONLY `defineModule`; a community module imports nothing
- [ ] Visibility expressed as a serializable `when` clause (no predicate functions)
