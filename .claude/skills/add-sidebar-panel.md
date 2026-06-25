---
name: add-sidebar-panel
description: Explains Macows Explorer sidebar panels (MacowsSidebarPanel + components/Sidebar) and why sandboxed modules cannot contribute them yet.
---

# Skill: Sidebar panels

> **Read this first.** Module-contributed sidebar panels are **NOT supported** in the
> current unified (sandboxed) module model. A module runs in a Web Worker and cannot
> ship a React component to the main thread, so the `defineModule` format has no
> `sidebarPanels` field and `host` exposes no way to register UI. Only **core UI** can
> register a panel today. The unsolved problem ("constrained host-rendered components
> vs. iframe webview") is tracked in `TODO.md` → "Sandboxed custom UI".

Use this skill to understand the panel infrastructure that already exists and where the
gap is — not as a recipe a community module can follow.

## What exists today

The panel infrastructure is real and rendered by `App.tsx`:

- `MacowsSidebarPanel` — the panel descriptor type, in
  `src/core/module-registry/module-registry.types.ts`.
- `src/components/Sidebar/` — the host that renders a tab strip (one icon per panel) and
  shows/hides the active panel.
- The registry stores panels and `App.tsx` renders them.

Only **core** code can register a `MacowsSidebarPanel` directly. Sandboxed built-in and
community modules (the `defineModule` format) cannot contribute one.

## The `MacowsSidebarPanel` shape

```typescript
interface MacowsSidebarPanel {
  id: string;                         // unique, "owner.panel-name"
  icon: string;                       // emoji or SF Symbol shown in the tab strip
  title: string;                      // tooltip / accessible label
  side?: "left" | "right";            // preferred side (core may override)
  defaultWidth?: number;              // pixels, 180–480
  component: ComponentType<SidebarPanelProps>;
}
```

The component receives `SidebarPanelProps` — a snapshot of app state plus callbacks:

```typescript
interface SidebarPanelProps {
  selectedItems: FileItem[];
  currentDirectory: string;
  navigate: (path: string) => void;
  refresh: () => void;
}
```

## Why a sandboxed module can't provide one

A community module is plain ESM in a Worker: no DOM, no React reconciler shared with the
main thread, and only structured-clone-serializable values may cross the wire. A React
`ComponentType` is a function — it cannot be serialized or rendered on the host's behalf.
The host ↔ worker protocol (`src/core/sandbox/protocol.ts`) carries commands, open
handlers, and capability calls; it deliberately carries no UI.

## What a module CAN do instead today

Until host-rendered module UI exists, a module surfaces itself through the channels the
sandbox already supports:

- A **command** (`commands` + `host.onCommand`) that runs logic and reports via
  `host.dialog.prompt` / `host.dialog.confirm` or `host.log`.
- An **open handler** (`openHandlers` + `host.onOpen`) to change double-click behavior.

See the `new-module` and `add-open-handler` skills.

## If you are adding a CORE panel

Core panels are part of the app shell, not modules. Register the descriptor through the
core path and render it under `src/components/Sidebar/`. Panel component rules still
apply:

- Handle the empty-selection state (`selectedItems.length === 0`).
- Never call `invoke()` directly — data arrives via `SidebarPanelProps`.
- Colors only via CSS variables (`var(--glass-mid)`, `var(--text)`, …); see
  `src/STYLE_GUIDE.md`.
- Prefix CSS classes with the panel id.
