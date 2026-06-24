# src/modules/ — Module Development Guide

A module is a TypeScript object that satisfies the `MacowsModule` interface.
It is the **primary extension point** for the entire application.

---

## Module anatomy

```text
src/modules/<module-id>/
├── index.ts          ← exports the MacowsModule object (required)
├── actions.ts        ← MacowsAction definitions (if > 2 actions)
├── handlers.ts       ← MacowsOpenHandler definitions (if any)
├── panels.ts         ← MacowsSidebarPanel definitions (if any)
├── state.ts          ← module-local state (if any)
├── types.ts          ← types private to this module (if any)
└── CLAUDE.md         ← module-specific documentation (required for non-trivial modules)
```

Split into sub-files whenever `index.ts` would exceed ~80 lines.

---

## Minimal module

```typescript
// src/modules/my-module/index.ts
import type { MacowsModule } from "../../core/types";

export const myModule: MacowsModule = {
  id: "author.my-module",       // unique, never changes after publish
  name: "My Module",
  version: "1.0.0",
  description: "One sentence describing what this module does.",
  actions: [],
};
```

---

## Module ID convention

| Origin           | Format                          | Example              |
| ---------------- | ------------------------------- | -------------------- |
| Built-in core    | `core.<name>`                   | `core.clipboard`     |
| Community        | `<author>.<name>`               | `acme.git-status`    |
| Fork of existing | `<author>.<original-name>-fork` | `bob.clipboard-fork` |

IDs are permanent once published. **Never rename a module ID after users install it.**

---

## Registering a module

**No manual registration needed.** Drop your module folder under `src/modules/` and
`src/moduleLoader.ts` will auto-discover it via Vite's `import.meta.glob` on the next restart.

The loader finds every `./modules/*/index.ts` file and calls `isMacowsModule()` on each
export. Anything that satisfies the `MacowsModule` interface is registered automatically.

Core modules are registered first in this fixed order:

1. `core.navigation` (priority-0 open handlers must be in place first)
2. `core.clipboard`
3. `core.file-ops`
4. `core.mouse-navigation`
5. Everything else (alphabetical by discovery order)

If you need to guarantee a specific registration order relative to another community module,
open an issue — there is currently no declared-dependency mechanism.

---

## Writing actions

```typescript
// src/modules/my-module/actions.ts
import { invoke } from "@tauri-apps/api/core";
import type { MacowsAction } from "../../core/types";

export const myAction: MacowsAction = {
  id: "my-module.do-something",      // "module-id.action-name"
  label: "Do Something",
  shortcut: "meta+shift+d",          // normalized format
  showInContextMenu: true,
  showInToolbar: false,
  separator: false,

  // Only show when at least one non-directory is selected
  isVisible: (ctx) => ctx.selectedItems.some((i) => !i.isDir),

  // Only enable when not empty
  isEnabled: (ctx) => ctx.selectedItems.length > 0,

  execute: async (ctx) => {
    const paths = ctx.selectedItems.map((i) => i.path);
    await invoke("my_rust_command", { paths });
    ctx.refresh();
  },
};
```

### Action rules

- `id` format: `"<module-id>.<action-name>"` — always namespaced
- `execute` may be async; unhandled errors will be caught and logged by ModuleRegistry
- Always call `ctx.refresh()` after mutating the file system
- Always call `ctx.navigation.navigate(path)` instead of `ctx.refresh()` when changing directory
- `isEnabled` vs `isVisible`: disabled = greyed out in menu; invisible = not shown at all

---

## Writing open handlers

```typescript
// src/modules/my-module/handlers.ts
import type { MacowsOpenHandler } from "../../core/types";

export const imageOpenHandler: MacowsOpenHandler = {
  id: "my-module.open-image",
  priority: 5,      // > 0 overrides the core.navigation default

  // Handle only image files
  matches: (item) =>
    !item.isDir &&
    ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(
      item.extension?.toLowerCase() ?? ""
    ),

  handle: (item, ctx) => {
    // Show in-app preview — implementation specific to this module
    // e.g. emit an event that a panel listens to
    EventBus.emit("image-viewer:open", { path: item.path });
  },
};
```

### Priority guide

| Priority | Use case                                                    |
| -------- | ----------------------------------------------------------- |
| 0        | Core defaults (navigation module)                           |
| 1–9      | Soft overrides (prefer in-app but fallback to system is OK) |
| 10–50    | Hard overrides (always handle this type in-app)             |
| 51–100   | Reserved for user-defined overrides                         |

---

## Writing sidebar panels

```typescript
// src/modules/my-module/panels.ts
import type { MacowsSidebarPanel, SidebarPanelProps } from "../../core/types";

function MyPanel({ selectedItems, currentDirectory }: SidebarPanelProps) {
  return (
    <div className="panel-my-module">
      <p>{selectedItems.length} selected in {currentDirectory}</p>
    </div>
  );
}

export const myPanel: MacowsSidebarPanel = {
  id: "my-module.panel",
  icon: "🔍",
  title: "My Panel",
  side: "right",
  defaultWidth: 240,
  component: MyPanel,
};
```

### Panel rules

- Panel components receive only `SidebarPanelProps` — no other imports from App.tsx
- Panel components must handle the case where `selectedItems` is empty
- `defaultWidth` must be between 180 and 480
- Panels must NOT call `invoke()` directly — pass the data need via props or use EventBus

---

## Module lifecycle

```typescript
export const myModule: MacowsModule = {
  // ...
  onMount: () => {
    // Called after registration. Use for:
    // - subscribing to EventBus events
    // - setting up timers or watchers
    unsubFileCreated = EventBus.on("file:created", handleFileCreated);
  },
  onUnmount: () => {
    // Called before unregistration. Use for:
    // - unsubscribing from EventBus (call the function returned by EventBus.on)
    // - clearing timers
    // MUST mirror everything done in onMount
    unsubFileCreated?.();
  },
};
```

---

## What modules MUST NOT do

| Forbidden | Why | Alternative |
| --- | --- | --- |
| Import from `src/components/` | Creates circular dependency | Use `sidebarPanels` with your own component |
| Import from another module | Creates tight coupling | Use EventBus for cross-module communication |
| Import React in `index.ts` / `actions.ts` | Core modules must be framework-agnostic | Put React code only in panel components |
| Mutate any `ActionContext` property directly | Side effects on shared state | Call `ctx.navigation.navigate()` or `ctx.refresh()` |
| Write to clipboard via `ctx.clipboard` | `ctx.clipboard` is a read-only snapshot | Call `invoke("clipboard_write_files", ...)` then `EventBus.emit("clipboard:changed", state)` |
| Call Tauri commands not in `src-tauri/src/lib.rs` | Runtime error | Add the command to lib.rs first |
| Store data in `window` or `globalThis` | Pollutes global scope | Use a local `state.ts` with module-scoped variables |

---

## Built-in modules reference

| Module ID             | File                      | What it provides                                          |
| --------------------- | ------------------------- | --------------------------------------------------------- |
| `core.navigation`     | `navigation/index.ts`     | Open handlers: folder→navigate, file→system open          |
| `core.clipboard`      | `clipboard/index.ts`      | Actions: copy (⌘C), cut (⌘X), paste (⌘V)                  |
| `core.file-ops`       | `file-ops/index.ts`       | Actions: new file, new folder, rename (F2), delete (⌘⌫)   |
| `core.module-manager` | `module-manager/index.ts` | Built-in UI for installing/managing modules (**planned**) |
