---
name: add-open-handler
description: Add an open handler to a Mutka module to intercept double-click behavior for specific file types or folders.
---

# Skill: Add an open handler

Use this skill when a module wants to intercept double-click behavior for specific file types or folders.

## How open handlers work

A module declares open handlers as **data** in its `openHandlers` array and registers
the function that runs them inside `setup` via `host.onOpen(handlerId, fn)`.

When the user double-clicks an item, the host picks the highest-priority handler whose
serializable `match` clause fits the item, then runs the function the module registered
under that handler's `handler` id. `match` is data (not a predicate) because a function
can't cross the worker boundary — the host evaluates it.

Built-in defaults (priority 0, from `src/sandbox-builtins/navigation.ts`):

- folder (`isDir: true`) → `host.nav.navigate(item.path)`
- file (`isDir: false`) → `host.fs.openItem(item.path)` (macOS system open)

A module overrides these by registering a handler with a HIGHER priority.

## The `match` clause

`match` is a `SandboxOpenMatch`:

```typescript
{ isDir?: boolean; extensions?: string[] }
```

- `{ isDir: true }` — any folder
- `{ isDir: false }` — any file
- `{ extensions: ["png", "jpg", "jpeg", "gif", "webp"] }` — files with these extensions
- `{ isDir: false, extensions: ["md"] }` — combine constraints

## Priority guide

| Priority | Meaning                                                 |
| -------- | ------------------------------------------------------- |
| 0        | Core default — used by `core.navigation`                |
| 1–9      | Soft override — this module prefers to handle this type |
| 10–50    | Hard override — always handles this in-app              |
| 51–100   | Reserved for user-configured overrides                  |

## Step-by-step

### 1. Declare the handler in `openHandlers`

```typescript
import { defineModule } from "../core/sandbox/defineModule";

export default defineModule({
  id: "author.image-viewer",
  name: "Image Viewer",
  version: "1.0.0",
  permissions: ["navigation"],
  openHandlers: [
    {
      id: "author.image-viewer.open-image",
      priority: 10,                       // > 0 beats the core default
      match: { isDir: false, extensions: ["png", "jpg", "jpeg", "gif", "webp"] },
      handler: "open-image",              // the host.onOpen id to run on a match
    },
  ],
  setup(host) {
    // 2. Register the function the host runs when an item matches.
    host.onOpen("open-image", (item) => {
      host.log("would open image viewer for", item.path);
      // e.g. open it in a tab, or hand off to the system:
      host.tabs.openTab(item.path);
    });
  },
});
```

### Real example: the core default

`src/sandbox-builtins/navigation.ts` shows the canonical pattern — two priority-0
handlers, each registered with `host.onOpen`:

```typescript
openHandlers: [
  { id: "core.navigation.open-folder", priority: 0, match: { isDir: true },  handler: "open-folder" },
  { id: "core.navigation.open-file",   priority: 0, match: { isDir: false }, handler: "open-file" },
],
setup(host) {
  host.onOpen("open-folder", (item) => { host.nav.navigate(item.path); });
  host.onOpen("open-file",   (item) => { host.fs.openItem(item.path); });
},
```

## Common patterns

### Pattern: open a folder in a new tab (override the folder default)

```typescript
openHandlers: [
  { id: "author.tabs.open-folder", priority: 10, match: { isDir: true }, handler: "tab-open" },
],
setup(host) {
  host.onOpen("tab-open", (item) => { host.tabs.openTab(item.path); });
},
```

### Pattern: fall back to system if something fails

```typescript
host.onOpen("open-custom", async (item) => {
  try {
    await doCustomThing(item.path);
  } catch {
    await host.fs.openItem(item.path);   // system open
  }
});
```

## Notes

- Every capability the handler calls (`host.nav`, `host.tabs`, `host.fs`, …) must be
  declared in `permissions[]`, or the gateway denies it.
- The declarative `openHandlers` + `host.onOpen` shape is the AUTHOR API. The
  `MutkaOpenHandler` interface in `module-registry.types.ts` (with `matches()` /
  `handle()` functions) is the internal registry shape that a runtime builds from your
  declaration — you do not write it directly.
