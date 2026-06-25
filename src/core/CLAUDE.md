# src/core/ — Infrastructure Layer

This folder is the **skeleton of the app**. It has zero features.
Modules and components depend on it; it depends on nothing inside `src/` outside core.

Each subsystem lives in its own folder (`module-registry/`, `sandbox/`, `app-bridge/`,
`event-bus/`, `shortcut-manager/`, `input-manager/`, `theme-manager/`, `tab-manager/`,
`stores/`). `types.ts` holds the cross-cutting foundation types.

---

## How modules reach the system (read this first)

A module — built-in or community — is `export default defineModule({ id, name, version,
permissions, commands, openHandlers, setup })`. It imports NOTHING from core. In
`setup(host)` it receives a `host` object, which is the ONLY way it touches anything
privileged. Every `host.*` call is routed through the **permission gateway**.

```text
module.setup(host) → host.fs.readDir(p)
  → gateway.ts: does the module's manifest declare the required permission?
       no  → throws "Permission denied"
       yes → capabilities.ts runs it (the ONLY place that calls invoke / AppBridge / TabManager)
```

Two runtimes host modules, **same format, same gateway**:

- **`sandbox/LocalHost.ts`** — built-in/trusted modules, IN-PROCESS (direct calls).
- **`sandbox/SandboxHost.ts`** — community/untrusted modules, ISOLATED in a Web Worker
  (no DOM, no `invoke`, no core reference; reaches the system only via postMessage).

Switching a module between the two is a one-line change in `moduleLoader.ts`; the module
code is identical. For an author's guide, see `COMMUNITY_MODULES.md`.

---

## Files and their single responsibilities

### `types.ts` — Foundation Types

Cross-cutting types used by multiple subsystems: `FileItem`, `ClipboardState`,
`NavigationAPI`, `DialogAPI` (+ its option shapes), and `BaseContext` (the read-only view
of app state used only by `isVisible`/`isEnabled`/`when` predicates — modules never act
through it).

Types that belong to a single subsystem live next to their owner:
- `MacowsModule`, `MacowsAction`, `MacowsOpenHandler`, `MacowsSidebarPanel`,
  `ModulePermission`, `ContextMenuCategories` → `module-registry/module-registry.types.ts`
- `ThemePreference` → `theme-manager/theme-manager.types.ts`
- `TabBarTab`, `TabsSnapshot` → `tab-manager/tab-manager.types.ts`

**Critical invariant:** `FileItem` must exactly mirror the Rust struct in
`src-tauri/src/lib.rs` with `#[serde(rename_all = "camelCase")]`. Change one, change the other.

---

### `module-registry/` — The Hub

`ModuleRegistry.ts` is a singleton that stores what modules contribute and dispatches to
them. Modules act through their OWN `host`, not through an injected context — the registry
only stores actions/handlers and reads app state for visibility checks.

Public API:
```typescript
ModuleRegistry.init(): void                         // wire the "action:dispatch" bus listener once
ModuleRegistry.register(module: MacowsModule): void
ModuleRegistry.unregister(moduleId: string): void
ModuleRegistry.executeAction(actionId: string): Promise<void>
ModuleRegistry.resolveOpen(item: FileItem): Promise<void>
ModuleRegistry.getContextMenuActions(context: BaseContext, zone: MenuZone): ContextMenuGroup[]
ModuleRegistry.getSidebarPanels(): MacowsSidebarPanel[]
```

- `init()` runs once from `App.tsx`; it subscribes to the `"action:dispatch"` EventBus
  event so a shortcut or menu click resolves to `executeAction(actionId)`.
- `executeAction` / `resolveOpen` are async and catch all errors per-module. On throw they
  log and emit `"error:action"` — never crash the app. They take NO context argument; the
  registry reads current state itself (via `SelectionStore`, `ClipboardStore`, `AppBridge`).
- `getContextMenuActions` filters by the clicked `zone` (an action's
  `contextMenuZones`, default file rows + empty background — see `menu/menuZone.ts`) and by
  each action's `isVisible`, then groups by `contextMenuCategory` into `ContextMenuGroup[]`.
  Right-clicks in an editable field resolve to `"editable"` and show the native menu instead.

`module-registry.types.ts` is the INTERNAL registry contract (`MacowsModule`,
`MacowsAction`, `MacowsOpenHandler`, `MacowsSidebarPanel`, `ModulePermission`,
`ContextMenuCategories`). Authors do NOT write these — they write `defineModule(...)` and
`sandbox/proxyModule.ts` converts a manifest into a `MacowsModule` the registry stores.

Modules are auto-discovered by `src/moduleLoader.ts`; they are never registered by hand in
`App.tsx`. Built-in open handlers register at priority 0 first, so community modules can
override with a higher priority.

**Do NOT** add business logic here. The registry dispatches; modules execute.
There is no `connect()`, `buildContext()`, `tracePermissions()`, `getToolbarActions()`,
or `getModules()` — those were removed.

---

### `sandbox/` — The Module Runtime

The module execution + permission layer. Files:

| File | Responsibility |
| --- | --- |
| `defineModule.ts` | Author-facing helper. Types only — returns its argument unchanged. |
| `hostProxy.ts` | Builds the `host` object (`fs`, `board`, `nav`, `tabs`, `dialog`, `sys`, `refresh`, `onCommand`, `onOpen`, `events.on`, `log`). All methods async. |
| `capabilities.ts` | THE gateway vocabulary. Maps each capability to its required permission and the operation that fulfils it. The ONLY file that calls `invoke` / `AppBridge` / `TabManager`. |
| `gateway.ts` | The permission barrier. Checks the manifest declared the required permission, then runs the capability. No declaration → throws. |
| `LocalHost.ts` | In-process runtime for built-ins. |
| `SandboxHost.ts` | Web-Worker runtime for community modules. |
| `sandbox.worker.ts` | The worker entry that loads untrusted source and proxies host-calls. |
| `protocol.ts` | The only shapes allowed to cross the host↔worker boundary (structured-clone safe): `SandboxCommand`, `SandboxOpenHandler`, `WhenClause`, `SandboxManifest`, `HostSnapshot`, wire messages. |
| `proxyModule.ts` | Turns a manifest into a `MacowsModule` and registers it. |
| `whenClause.ts` | Evaluates a declarative `when` clause against `BaseContext` (host-side). |
| `eventWhitelist.ts` | The set of events a module may subscribe to via `host.events.on`. |

Permissions: `fs:read`, `fs:write`, `clipboard:read`, `clipboard:write`, `navigation`,
`dialog`, `network`, `shell`. A module must declare every one it uses.

Why `when` is data, not a function: a worker module can't hand a predicate across
postMessage, so visibility is described declaratively (`selection`, `clipboard`) and
evaluated host-side via `whenClause.ts`.

---

### `app-bridge/AppBridge.ts` — React State Bridge

A handful of privileged operations live in `App.tsx` React state: navigation history, the
modal dialog, and directory refresh. `App.tsx` connects a provider once via
`AppBridge.connect(...)`; the `nav`, `dialog`, and `app.refresh` capabilities read through
it. This is what lets those capabilities exist without core knowing about React.

---

### `event-bus/` — Loose Coupling

`EventBus.ts` is a typed publish/subscribe bus; `events.ts` defines the `EventMap` (every
event → payload type) and the `Events` name constants. Use it when two parts need to react
to each other **without importing each other**.

```typescript
EventBus.emit(Events.Clipboard.changed, state);
const unsub = EventBus.on(Events.Clipboard.changed, (s) => { ... });
unsub();
```

Use `Events.Namespace.name` constants, not bare strings. Community modules add custom
events via declaration merging on `EventMap` (see the comment in `events.ts`).

**Do NOT** use the EventBus for data a component renders — pass that via props/state.

#### Known events (keep this in sync with `events.ts`)

| Event | Payload | Notes |
| --- | --- | --- |
| `theme:changed` | `{ preference; resolved }` | from `ThemeManager` |
| `clipboard:changed` | `ClipboardState` | from `ClipboardStore` / clipboard module |
| `navigation:back` / `navigation:forward` | `undefined` | toolbar flash animation |
| `file:modifier-open` | `{ item; modifiers }` | ctrl/⌘-open of an item (subscribable by modules) |
| `module:registered` / `module:unregistered` | `{ moduleId }` | sidebar-panel refresh |
| `error:action` | `{ actionId; error }` | failed action |
| `input:mouse-navigate` | `{ direction }` | mouse back/forward (subscribable by modules) |
| `tabs:changed` | `TabsSnapshot` | any tab-state mutation |
| `tabs:last-closed` | `{ path }` | last tab closed → global nav resumes |
| `action:dispatch` | `{ actionId }` | a shortcut/menu requests an action run |
| `selection:changed` | `{ items }` | from `SelectionStore` |

Of these, modules may subscribe ONLY to the whitelisted set in
`sandbox/eventWhitelist.ts` (currently `input:mouse-navigate`, `file:modifier-open`).

---

### `shortcut-manager/ShortcutManager.ts` — Keyboard

Listens to `document keydown`, normalizes the combo, and emits `"action:dispatch"` on the
EventBus when a registered shortcut fires. `ModuleRegistry` (wired in `init()`) runs the
matching action.

Shortcut format (normalized): `"meta+c"`, `"meta+shift+n"`, `"f2"`, `"meta+backspace"`.
Parts: `meta`, `ctrl`, `alt`, `shift`, then the key name (lowercase).

**Conflict rule**: last registration wins, with a `console.warn`. Document your shortcuts.

---

### `input-manager/InputManager.ts` — Low-level Input Capture

Captures raw platform input and translates it to semantic EventBus events. Modules
subscribe to those events instead of touching `document.addEventListener`.

```typescript
InputManager.init()    // once at app startup (module scope in App.tsx)
InputManager.dispose()
```

Emits `"input:mouse-navigate"` (`{ direction: "back" | "forward" }`) from either the Tauri
NSEvent monitor (driver-managed mice) or a DOM `mousedown` with `button === 3`/`4` (raw HID
mice). Modules never need to know which path fired.

**Rules:** never dispatch actions directly; never call `invoke()` for feature logic; may use
`listen()` for platform-level subscriptions.

---

### `tab-manager/TabManager.ts` — Tabs (single source of truth)

Owns all tab state AND the current directory when a tab is active. Drives the `TabBar`
component via the `"tabs:changed"` event. Modules reach it ONLY through the `tabs`
capability (`openTab`, `openTabInBackground`, `isActive`); the `nav` capability's
navigate/back/forward also resolve against the active tab. Emits `"tabs:changed"`,
`"tabs:last-closed"`, and `"navigation:back"/"forward"`.

---

### `stores/` — Plain State Singletons

`SelectionStore.ts` (current selection, emits `"selection:changed"`) and
`ClipboardStore.ts` (current clipboard, emits `"clipboard:changed"`). They are the
authoritative read source the registry uses to build a `BaseContext` for visibility checks.

---

### `theme-manager/ThemeManager.ts` — Dark / Light

Reads the preference from `localStorage` `"macows.theme"` (falls back to `"system"`),
applies `data-theme` on `<html>`, and emits `"theme:changed"` when it resolves.

```typescript
ThemeManager.get(): ThemePreference
ThemeManager.set(pref: ThemePreference): void
ThemeManager.getResolved(): "dark" | "light"
```

`"system"` follows `window.matchMedia("(prefers-color-scheme: dark)")` and updates live.

---

## Rules for this folder

1. **No React imports** — core is framework-agnostic infrastructure.
2. **No `invoke()` calls — ONE exception:** `sandbox/capabilities.ts` is the single system
   gateway and intentionally calls `invoke`. No other core file may.
3. **No imports from `src/sandbox-builtins/` or `src/components/`**.
4. **Singletons** — `ModuleRegistry`, `EventBus`, `ShortcutManager`, `InputManager`,
   `ThemeManager`, `TabManager`, `AppBridge`, and the stores are each instantiated once and
   exported as a named const.

---

## Adding to the core

Adding a new core file requires answering YES to ALL:
- [ ] Is it shared infrastructure used by multiple modules or components?
- [ ] Does it have zero feature logic (no specific FS behavior, no UI rendering)?
- [ ] Can it be reasoned about without knowing any specific module?

To expose a NEW system operation to modules, do NOT add it ad hoc: add a Rust command in
`lib.rs`, then a capability entry in `sandbox/capabilities.ts` mapped to its permission.
If a capability isn't listed there, it does not exist for any module.
