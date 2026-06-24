# src/ — Frontend Architecture

## Responsibilities

This folder contains the entire React + TypeScript frontend.
The Rust backend (src-tauri/) is a thin FS/system API layer — all logic lives here.

---

## TypeScript rules (enforced, no exceptions)

### No `any`
```typescript
// ❌ NEVER
const items: any[] = await invoke("read_dir", { path });

// ✅ ALWAYS
const items = await invoke<FileItem[]>("read_dir", { path });
```

### Explicit return types on all exported functions
```typescript
// ❌
export function formatSize(bytes: number) { ... }

// ✅
export function formatSize(bytes: number): string { ... }
```

### Type guards when narrowing `unknown`
```typescript
// ❌
const data = JSON.parse(raw);
data.name; // unsafe

// ✅
function isFileItem(x: unknown): x is FileItem {
  return typeof x === "object" && x !== null && "path" in x && "isDir" in x;
}
const data: unknown = JSON.parse(raw);
if (isFileItem(data)) { data.name; } // safe
```

### No non-null assertion (`!`) on values that could realistically be null
```typescript
// ❌ — crashes if element is missing
document.getElementById("root")!.innerHTML = "";

// ✅ — guard it
const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
```

### Interfaces over type aliases for object shapes
```typescript
// ✅ — interface for object shapes (extendable, shows in error messages)
interface FileRowProps {
  item: FileItem;
  isSelected: boolean;
}

// ✅ — type alias for unions, primitives, or mapped types
type ThemePreference = "system" | "light" | "dark";
```

---

## File naming conventions

| Pattern | Rule | Example |
|---|---|---|
| React component | PascalCase `.tsx` | `FileRow.tsx` |
| React hook | camelCase starting with `use` | `useTheme.ts` |
| Pure logic / utilities | camelCase `.ts` | `formatSize.ts` |
| Type-only files | camelCase `.ts` | `types.ts` |
| Module index | `index.ts` | `modules/clipboard/index.ts` |
| Constants | SCREAMING_SNAKE in file, camelCase file name | `shortcuts.ts` |

---

## Folder rules

### `src/core/` — infrastructure only
- Contains: `types.ts`, `ModuleRegistry.ts`, `EventBus.ts`, `ShortcutManager.ts`, `ThemeManager.ts`
- Must NEVER contain feature logic
- Must NEVER import from `src/modules/` or `src/components/`
- Must NEVER import React (it is framework-agnostic infrastructure)

### `src/modules/` — one folder per module
- Each module is a self-contained folder: `modules/<id>/index.ts`
- May have sub-files: `modules/clipboard/actions.ts`, `modules/clipboard/state.ts`
- Must ONLY import from `src/core/types.ts` and `@tauri-apps/api/core`
- Must NEVER import from `src/components/` (components import from core, not vice versa)
- Sidebar panel components are the only exception: they may import shared UI primitives

### `src/components/` — presentational UI only
- Components receive data via props, emit events via callbacks
- Must NEVER call `invoke()` directly — all data comes from props
- Must NEVER import from `src/modules/`
- May import from `src/core/types.ts` for type annotations only

---

## React component rules

### One component per file
```typescript
// FileRow.tsx — only exports FileRow
export function FileRow({ item, isSelected, onSelect, onOpen }: FileRowProps) { ... }
```

### Props interface always defined above the component
```typescript
interface FileRowProps {
  item: FileItem;
  isSelected: boolean;
  isCut: boolean;
  onSelect: (item: FileItem, event: React.MouseEvent) => void;
  onOpen: (item: FileItem) => void;
}

export function FileRow({ item, isSelected, isCut, onSelect, onOpen }: FileRowProps) { ... }
```

### No inline arrow functions in JSX when logic is non-trivial
```typescript
// ❌ — hard to read, creates new function on every render
<FileRow onClick={(e) => { if (e.shiftKey) { ... } else { ... } }} />

// ✅ — named handler
const handleClick = useCallback((e: React.MouseEvent) => { ... }, [deps]);
<FileRow onClick={handleClick} />
```

### `useCallback` for handlers passed as props; `useMemo` for expensive computations
```typescript
const handleOpen = useCallback((item: FileItem) => {
  ModuleRegistry.resolveOpen(item, getContext());
}, [getContext]);
```

---

## Adding a new feature — decision checklist

Before writing code, ask:
1. Is this a **core infrastructure concern**? → `src/core/`
2. Is this a **user-facing operation** (action, open behavior)? → new module in `src/modules/`
3. Is this **pure UI presentation** (no FS, no business logic)? → `src/components/`
4. Does it need a **Rust command**? → add to `src-tauri/src/lib.rs` and read `src-tauri/CLAUDE.md`
5. Does it cross these boundaries? → split it into multiple files, one per concern
