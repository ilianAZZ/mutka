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

| Pattern                | Rule                                         | Example                        |
| ---------------------- | -------------------------------------------- | ------------------------------ |
| React component        | PascalCase `.tsx`                            | `FileRow.tsx`                  |
| React hook             | camelCase starting with `use`                | `useTheme.ts`                  |
| Pure logic / utilities | camelCase `.ts`                              | `formatSize.ts`                |
| Type-only files        | camelCase `.ts`                              | `types.ts`                     |
| Built-in module        | camelCase/kebab `.ts`                        | `sandbox-builtins/file-ops.ts` |
| Constants              | SCREAMING_SNAKE in file, camelCase file name | `shortcuts.ts`                 |

---

## Folder rules

### `src/core/` — infrastructure only

- Contains subsystems in their own folders: `module-registry/`, `sandbox/`, `app-bridge/`, `event-bus/`, `shortcut-manager/`, `input-manager/`, `theme-manager/`, `tab-manager/`, `stores/`, plus `types.ts`
- Must NEVER contain feature logic
- Must NEVER import from `src/sandbox-builtins/` or `src/components/`
- Must NEVER import React (it is framework-agnostic infrastructure)
- Documented exception: `sandbox/capabilities.ts` calls `invoke()` — it is the single system gateway — as does the `core/file-system/FileSystemRegistry.ts` it delegates fs routing to (reached only through the gateway). See `src/core/CLAUDE.md`.

### `src/sandbox-builtins/` — built-in modules (one file each)

- Each built-in module is a single file: `sandbox-builtins/<name>.ts`
- Written in the SAME format as community modules: `export default defineModule({ ... })`
- A module imports NOTHING except `defineModule` (a types-only helper). It reaches the system **only** through the `host` object passed to `setup(host)` — every `host.*` call is permission-checked by the gateway.
- Built-ins run in-process (via `LocalHost`); community modules run isolated in a Web Worker (via `SandboxHost`). The module code is identical either way.
- Community modules are NOT in this repo: they live on the user's disk at `~/.mutka/modules/<id>/index.js`. See `COMMUNITY_MODULES.md`.

### `src/components/` — presentational UI only

- Components receive data via props, emit events via callbacks
- Must NEVER call `invoke()` directly — all data comes from props
- Must NEVER import a module
- May import from `src/core/types.ts` (and module-registry types) for type annotations only

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
  ModuleRegistry.resolveOpen(item); // registry reads app state itself; no context arg
}, []);

```

---

## Adding a new feature — decision checklist

Before writing code, ask:

1. Is this a **core infrastructure concern**? → `src/core/`
2. Is this a **user-facing operation** (command, open behavior)? → new `defineModule` file in `src/sandbox-builtins/` (built-in) or a community module under `~/.mutka/modules/` (see `COMMUNITY_MODULES.md`)
3. Is this **pure UI presentation** (no FS, no business logic)? → `src/components/`
4. Does it need a **Rust command**? → add to `src-tauri/src/lib.rs`, then expose it as a capability in `src/core/sandbox/capabilities.ts` (the only place modules can reach it), and read `src-tauri/CLAUDE.md`
5. Does it cross these boundaries? → split it into multiple files, one per concern
