---
name: new-module
description: Create a new Macows Explorer module with actions, open handlers, and sidebar panels. Use when adding any new feature to the app.
---

# Skill: Create a new Macows Explorer module

Use this skill whenever asked to add a new feature, action, or open handler to the app.

## Step-by-step

### 1. Choose the module ID
Format: `core.<name>` for built-ins, `<author>.<name>` for community modules.
The ID is permanent — it can never be renamed after users install the module.

### 2. Create the folder

```
src/modules/<module-id>/
├── index.ts       ← required: exports the MacowsModule object
├── actions.ts     ← if the module has more than 2 actions
├── handlers.ts    ← if the module has open handlers
├── panels.ts      ← if the module has sidebar panels
└── state.ts       ← if the module needs local state
```

### 3. Write `index.ts`

```typescript
// src/modules/<id>/index.ts
import type { MacowsModule } from "../../core/types";
// Import sub-files if you split actions/handlers/panels
// import { myActions } from "./actions";

export const myModule: MacowsModule = {
  id: "author.module-name",
  name: "Human Readable Name",
  version: "1.0.0",
  description: "One sentence description.",
  actions: [
    // inline here, or import from ./actions.ts
  ],
  openHandlers: [],      // omit if none
  sidebarPanels: [],     // omit if none
  onMount: () => {},     // omit if no setup needed
  onUnmount: () => {},   // omit if no cleanup needed
};
```

### 4. Write actions (if any)

```typescript
// src/modules/<id>/actions.ts
import { invoke } from "@tauri-apps/api/core";
import type { MacowsAction } from "../../core/types";

export const myAction: MacowsAction = {
  id: "module-id.action-name",    // MUST start with module ID
  label: "Action Label",
  shortcut: "meta+k",             // optional
  showInContextMenu: true,
  isEnabled: (ctx) => ctx.selectedItems.length > 0,
  execute: async (ctx) => {
    try {
      await invoke("rust_command_name", { path: ctx.currentDirectory });
      ctx.refresh();
    } catch (err: unknown) {
      console.error("[module-id] action failed:", err);
    }
  },
};
```

### 5. Write open handlers (if any)

```typescript
// src/modules/<id>/handlers.ts
import type { MacowsOpenHandler } from "../../core/types";

export const myHandler: MacowsOpenHandler = {
  id: "module-id.handler-name",
  priority: 5,   // > 0 to override core defaults, ≤ 100
  matches: (item) => item.extension === "pdf",
  handle: (item, ctx) => {
    // implement open behavior
  },
};
```

### 6. Register the module in `src/App.tsx`

Add TWO lines:
```typescript
// At the top with other module imports:
import { myModule } from "./modules/<id>";

// In the registration block (after core modules):
ModuleRegistry.register(myModule);
```

### 7. If a new Tauri command is needed

Read `src-tauri/CLAUDE.md` and follow the "Adding a Tauri command" steps.

## Checklist before finishing

- [ ] Module ID is unique and follows `author.name` format
- [ ] All action IDs are prefixed with the module ID
- [ ] All `execute()` functions catch errors and log them
- [ ] `ctx.refresh()` is called after any file system mutation
- [ ] `onUnmount()` unsubscribes everything `onMount()` subscribed
- [ ] No imports from `src/components/` in non-panel files
- [ ] No imports from other modules
- [ ] Module is registered in `App.tsx`
