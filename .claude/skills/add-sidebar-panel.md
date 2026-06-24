---
name: add-sidebar-panel
description: Add a sidebar panel component to a Macows Explorer module for persistent UI (preview, git status, favorites, etc.).
---

# Skill: Add a sidebar panel

Use this skill when a module wants to display persistent UI in the sidebar
(e.g. file preview, git status, tag browser, favorites).

## How panels work

Panels are React components registered via `MacowsSidebarPanel` in a module's `sidebarPanels` array.
The sidebar host (planned: `src/components/Sidebar/Sidebar.tsx`) renders a tab strip
with one icon per registered panel. Clicking a tab shows/hides the panel.

The panel component receives `SidebarPanelProps` — a snapshot of current app state.
It must NOT import from `src/App.tsx` or any other module.

## Step-by-step

### 1. Create the panel component file

```
src/modules/<id>/panels/MyPanel.tsx
```

```typescript
// src/modules/<id>/panels/MyPanel.tsx
import type { SidebarPanelProps } from "../../../core/types";

export function MyPanel({ selectedItems, currentDirectory, navigate, refresh }: SidebarPanelProps) {
  if (selectedItems.length === 0) {
    return <div className="panel-empty">No selection</div>;
  }

  const item = selectedItems[0];

  return (
    <div className="panel-my-module">
      <h3 className="panel-title">{item.name}</h3>
      <p className="panel-meta">{item.path}</p>
    </div>
  );
}
```

### 2. Define the panel descriptor

```typescript
// src/modules/<id>/panels.ts
import type { MacowsSidebarPanel } from "../../core/types";
import { MyPanel } from "./panels/MyPanel";

export const myPanel: MacowsSidebarPanel = {
  id: "my-module.main-panel",  // unique, prefixed with module ID
  icon: "🔍",                  // emoji shown in sidebar tab strip
  title: "My Panel",           // tooltip / screen reader label
  side: "right",               // "left" or "right"
  defaultWidth: 260,           // pixels, 180–480
  component: MyPanel,
};
```

### 3. Include in the module

```typescript
// src/modules/<id>/index.ts
import { myPanel } from "./panels";

export const myModule: MacowsModule = {
  // ...
  sidebarPanels: [myPanel],
};
```

## Panel component rules

### Required: handle empty state
```typescript
// Panels MUST handle cases where selectedItems is empty
if (selectedItems.length === 0) {
  return <div className="panel-empty">Select a file to preview</div>;
}
```

### Do NOT call `invoke()` directly
```typescript
// ❌
const meta = await invoke("get_metadata", { path: item.path });

// ✅ — use the EventBus to request data from an action
// or receive pre-fetched data via SidebarPanelProps extensions
```

### Use only CSS variables for colors
```css
/* ✅ */
.panel-my-module { background: var(--glass-mid); color: var(--text); }

/* ❌ */
.panel-my-module { background: #f0f0f0; color: #333; }
```

### CSS class naming: prefix with module ID
```css
.panel-my-module { }
.panel-my-module-title { }
.panel-my-module-empty { }
```

## EventBus integration (for reactive panels)

Panels receive props on re-render, but for finer-grained updates
(e.g. reacting to a file being created without a full list refresh):

```typescript
import { useEffect, useState } from "react";
import { EventBus } from "../../../core/EventBus";
import type { SidebarPanelProps } from "../../../core/types";

export function MyPanel({ selectedItems }: SidebarPanelProps) {
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const unsub = EventBus.on("file:created", (data) => {
      setLog((prev) => [...prev, String(data)]);
    });
    return unsub; // cleanup on unmount
  }, []);

  // ...
}
```
