---
name: add-open-handler
description: Add an open handler to a Macows Explorer module to intercept double-click behavior for specific file types or folders.
---

# Skill: Add an open handler

Use this skill when a module wants to intercept double-click behavior for specific file types or folders.

## How open handlers work

When the user double-clicks a file or folder, `ModuleRegistry.resolveOpen(item, ctx)` is called.
It iterates all registered handlers sorted by priority (highest first).
The first handler whose `matches(item)` returns `true` handles the open.

Built-in defaults (priority 0, from `core.navigation`):
- `item.isDir === true` → `ctx.navigate(item.path)` (opens folder in current window)
- `item.isDir === false` → `invoke("open_item", { path })` (macOS system open)

## Priority guide

| Priority | Meaning |
|---|---|
| 0 | Core default — used by `core.navigation` |
| 1–4 | Soft override — prefers in-app but fine if not loaded |
| 5–9 | Strong override — this module owns this file type |
| 10–50 | Hard override — always handles this in-app |
| 51–100 | Reserved for user-configured overrides |

## Step-by-step

### 1. Decide on the file types or condition

```typescript
// Example: handle markdown files
matches: (item) => !item.isDir && item.extension === "md"

// Example: handle all image formats
matches: (item) =>
  !item.isDir &&
  ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(
    item.extension?.toLowerCase() ?? ""
  )

// Example: override folder open (like a tabs module would)
matches: (item) => item.isDir

// Example: handle ALL items (catch-all override)
matches: () => true
```

### 2. Write the handler in `handlers.ts`

```typescript
// src/modules/<id>/handlers.ts
import type { MacowsOpenHandler } from "../../core/types";
import { EventBus } from "../../core/EventBus";

export const markdownHandler: MacowsOpenHandler = {
  id: "my-module.open-markdown",
  priority: 5,
  matches: (item) => !item.isDir && item.extension === "md",
  handle: (item, _ctx) => {
    // Signal to a sidebar panel or overlay to show this file
    EventBus.emit("markdown-viewer:open", { path: item.path });
  },
};
```

### 3. Include in the module

```typescript
// src/modules/<id>/index.ts
import { markdownHandler } from "./handlers";

export const myModule: MacowsModule = {
  // ...
  openHandlers: [markdownHandler],
};
```

## Common patterns

### Pattern: open a file in a sidebar panel

```typescript
handle: (item, _ctx) => {
  EventBus.emit("my-module:preview", { path: item.path });
  // The sidebar panel listens to this event and updates its content
}
```

### Pattern: open a folder in a new tab (tabs module)

```typescript
handle: (item, ctx) => {
  // A tabs module would call into its own state management
  TabsState.openNewTab(item.path);
}
```

### Pattern: fall back to system if something fails

```typescript
handle: async (item, _ctx) => {
  try {
    await myCustomOpen(item.path);
  } catch {
    // Fall back to system open
    await invoke("open_item", { path: item.path });
  }
}
```

## Important: handler registration order

`core.navigation` is always registered first, at priority 0.
Your handler with priority > 0 will always take precedence over it.
If two handlers have the same priority, the one registered LATER wins
(last-registration-wins is the tie-breaking rule).
