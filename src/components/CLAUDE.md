# src/components/ — UI Component Guide

Components are **pure presentational units**. They render data, emit user intent via
callbacks, and know nothing about the file system, modules, or Tauri.

---

## Component rules

### 1. One component = one file = one concern

```
components/
├── FileList/
│   ├── FileList.tsx      ← renders the scrollable list, owns selection state
│   ├── FileRow.tsx       ← renders a single row (name, date, size, type)
│   └── FileIcon.tsx      ← picks the right emoji/icon for a FileItem
├── Breadcrumb/
│   └── Breadcrumb.tsx    ← clickable path segments
├── ContextMenu/
│   └── ContextMenu.tsx   ← floating Liquid Glass menu
├── Sidebar/              ← hosts module-contributed sidebar panels
│   ├── Sidebar.tsx       ← manages panel tab strip + panel area
│   └── SidebarTab.tsx    ← a single tab button
├── TabBar/               ← core UI: the directory tab strip
│   └── TabBar.tsx        ← reads TabManager snapshot, renders/switches/closes tabs
└── Toolbar/
    └── Toolbar.tsx       ← nav buttons + breadcrumb + action buttons
```

Never put two distinct components in one file.

> **TabBar** is core UI, not a module contribution. It subscribes to the `"tabs:changed"`
> EventBus event and reads `TabManager` (the single source of truth for tabs + current
> directory). Modules drive tabs via their `host.tabs.*` capabilities, never by importing
> the component. There are no module-contributed top-bar panels — the only module-contributed
> UI surface is the **Sidebar**.

---

### 2. Props interface directly above the component

```typescript
// ✅ correct pattern
interface FileRowProps {
  item: FileItem;
  isSelected: boolean;
  isCut: boolean;
  onSelect: (item: FileItem, event: React.MouseEvent) => void;
  onOpen: (item: FileItem) => void;
}

export function FileRow({ item, isSelected, isCut, onSelect, onOpen }: FileRowProps) {
  // ...
}
```

All props are typed explicitly. No `Record<string, unknown>`, no spread-all props.

---

### 3. No business logic in components

```typescript
// ❌ component calling invoke directly
export function FileRow({ item }: FileRowProps) {
  const handleDoubleClick = () => {
    invoke("open_item", { path: item.path }); // NEVER
  };
}

// ✅ component emitting intent, parent resolves
export function FileRow({ item, onOpen }: FileRowProps) {
  const handleDoubleClick = () => onOpen(item);
}
```

---

### 4. No module imports in components

Modules are isolated (built-ins run in-process, community modules in a Web Worker); a
component can never reach into one. Receive any state you need as a prop.

```typescript
// ❌ — modules are not importable; there is no module object to import
import { clipboardModule } from "../../sandbox-builtins/clipboard";

// ✅ — if you need clipboard state, receive it as a prop
interface FileListProps {
  cutItems: FileItem[];  // ← passed in from App.tsx which knows about clipboard
}
```

---

### 5. CSS class naming — BEM-like, component-scoped

```css
/* Component root → component name */
.file-row { }

/* Modifier → double dash */
.file-row--selected { }
.file-row--cut { }

/* Child element → single dash */
.file-row-icon { }
.file-row-name { }
.file-row-meta { }
```

All class names are unique across the project (prefixed by component name).
Never use `style={{}}` inline styles except for dynamic values (e.g. `width`).

---

### 6. Theme-aware components use only CSS variables

```typescript
// ❌ — hardcoded color
<div style={{ background: "#0078d4" }}>

// ✅ — CSS variable from styles.css
<div className="file-row--selected">
```

```css
/* styles.css */
.file-row--selected {
  background: var(--accent-sel);   /* adapts to dark/light automatically */
}
```

Never hardcode colors in TSX or CSS. Every color must be a `var(--...)` token.

---

## Component checklist before writing

- [ ] Does this component render exactly ONE thing?
- [ ] Are all props typed explicitly in an interface?
- [ ] Does it call zero `invoke()` / zero module imports?
- [ ] Does it use only CSS variable colors?
- [ ] Are event handlers callbacks from props (not hardcoded logic)?
- [ ] Is the file name PascalCase and the same as the exported function name?
