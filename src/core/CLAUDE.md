# src/core/ — Infrastructure Layer

This folder is the **skeleton of the app**. It has zero features.
Modules and components depend on it; it depends on nothing inside `src/`.

---

## Files and their single responsibilities

### `types.ts` — The Contract

The ONLY file that defines public interfaces shared across modules, components, and the core.
**If you need a new shared type, it goes here and only here.**

Key types:
- `FileItem` — a single FS entry (mirrors the Rust `FileItem` struct exactly)
- `ActionContext` — the module's view of app state at execution time
- `MacowsAction` — a named operation with shortcut + menu integration
- `MacowsOpenHandler` — controls double-click behavior per item type
- `MacowsSidebarPanel` — a panel a module can inject into the sidebar
- `MacowsModule` — the top-level contract every module must satisfy
- `ThemePreference` — `"system" | "light" | "dark"`

**Critical invariant:** The `FileItem` interface must exactly mirror the Rust struct
in `src-tauri/src/lib.rs` with `#[serde(rename_all = "camelCase")]`.
If you change one, change the other.

---

### `ModuleRegistry.ts` — The Hub

Singleton that manages all registered modules.

Public API:
```typescript
ModuleRegistry.register(module: MacowsModule): void
ModuleRegistry.unregister(moduleId: string): void
ModuleRegistry.executeAction(actionId: string, context: ActionContext): Promise<void>
ModuleRegistry.resolveOpen(item: FileItem, context: ActionContext): Promise<void>
ModuleRegistry.getContextMenuActions(context: ActionContext): MacowsAction[]
ModuleRegistry.getToolbarActions(): MacowsAction[]
ModuleRegistry.getSidebarPanels(): MacowsSidebarPanel[]
ModuleRegistry.getModules(): MacowsModule[]
```

`executeAction` and `resolveOpen` are async and catch all errors per-module.
If a module throws, it logs the error and emits `EventBus.emit("error:action", ...)` —
it never crashes the app.

Modules are no longer registered manually in `App.tsx`.
They are auto-discovered by `src/moduleLoader.ts` using Vite's `import.meta.glob`.

Registration order (enforced by moduleLoader):
1. `core.navigation` (must be first — registers priority-0 open handlers)
2. `core.clipboard`
3. `core.file-ops`
4. `core.mouse-navigation`
5. Community modules (loaded after core modules are stable)

**Do NOT** add business logic here. The registry dispatches; modules execute.

---

### `EventBus.ts` — Loose Coupling

A simple publish/subscribe bus. Use it when two modules need to react to each other
**without importing each other**.

```typescript
// Module A emits
EventBus.emit("file:created", { path: "/foo/bar.txt" });

// Module B listens (in onMount)
const unsub = EventBus.on("file:created", (data) => { ... });
// Module B unsubscribes (in onUnmount)
unsub();
```

Event naming convention: `"<noun>:<verb>"` — e.g. `"file:created"`, `"module:registered"`, `"theme:changed"`.

**Do NOT** use the EventBus for data that a component needs to render.
For rendering, pass data via props or React state. EventBus is for side effects.

#### Known events (keep this table up to date)

| Event | Emitted by | Payload | Consumed by |
| --- | --- | --- | --- |
| `"navigation:back"` | `goBack()` in `App.tsx` | none | `App.tsx` toolbar flash animation |
| `"navigation:forward"` | `goForward()` in `App.tsx` | none | `App.tsx` toolbar flash animation |
| `"theme:changed"` | `ThemeManager` | `{ resolved: "dark" \| "light" }` | any theme-aware component |
| `"clipboard:changed"` | `core.clipboard` module | `ClipboardState` | `App.tsx` (updates React clipboard state) |
| `"error:action"` | `ModuleRegistry` | `{ actionId, error }` | future toast/notification module |
| `"module:registered"` | `ModuleRegistry` | `{ moduleId }` | Module Manager UI |
| `"module:unregistered"` | `ModuleRegistry` | `{ moduleId }` | Module Manager UI |

When you add a new event, add a row here. Undocumented events become invisible debt.

---

### `ShortcutManager.ts` — Keyboard

Listens to `document keydown`. When a registered shortcut fires, dispatches
`CustomEvent("macows:action", { detail: { actionId } })` on `document`.

`App.tsx` listens to `macows:action` and calls `ModuleRegistry.executeAction()`.

Shortcut format (normalized): `"meta+c"`, `"meta+shift+n"`, `"f2"`, `"meta+backspace"`.
Parts: `meta`, `ctrl`, `alt`, `shift`, then the key name (lowercase).

**Conflict rule**: last registration wins. If two modules bind the same shortcut,
the second one overrides the first with a `console.warn` message. Document your
shortcuts in your module's README to avoid silent conflicts.

---

### `InputManager.ts` — Low-level Input Capture

Captures raw platform input events and translates them to semantic EventBus events.
Modules subscribe to these events instead of touching `document.addEventListener` directly.

```typescript
InputManager.init()    // called once at app startup (module scope in App.tsx)
InputManager.dispose() // called on app teardown
```

#### Events emitted

| Event | Payload | When |
| --- | --- | --- |
| `"input:mouse-navigate"` | `{ direction: "back" \| "forward" }` | Mouse button 3/4 (DOM) or NSEvent swipe (Tauri) |

#### Two paths for mouse navigation (see mouse-navigation/CLAUDE.md for details)

- **Path A** (driver-managed mice): Tauri NSEvent monitor in `lib.rs` emits `"mouse-navigate"`. `InputManager` subscribes via `listen()` and re-emits on the EventBus.
- **Path B** (raw HID mice): DOM `mousedown` with `button === 3` or `4`. `InputManager` intercepts and re-emits on the EventBus.

Modules never need to know which path fired — they just receive `"input:mouse-navigate"`.

**Rules for this singleton:**
- Must NEVER dispatch `macows:action` directly (that is feature logic → belongs in a module)
- Must NEVER call `invoke()` (Tauri commands are feature level)
- May use `listen()` for platform-level event subscriptions

---

### `ThemeManager.ts` — Dark / Light

Reads the user's theme preference from `localStorage` key `"macows.theme"`.
Falls back to `"system"` if not set.

Applies the theme by setting `data-theme="dark"` or `data-theme="light"` on `<html>`.
CSS variables in `styles.css` use `[data-theme="dark"]` selectors.

```typescript
ThemeManager.get(): ThemePreference
ThemeManager.set(pref: ThemePreference): void
ThemeManager.getResolved(): "dark" | "light"  // resolves "system" to actual value
```

The `"system"` value listens to `window.matchMedia("(prefers-color-scheme: dark)")`.
When the OS theme changes, `ThemeManager` updates `data-theme` automatically and emits
`EventBus.emit("theme:changed", { resolved: "dark" | "light" })`.

---

## Rules for this folder

1. **No React imports** — core files must work without a UI framework
2. **No `invoke()` calls** — core files never call Tauri commands
3. **No imports from `src/modules/` or `src/components/`**
4. **Only singletons** — `ModuleRegistry`, `EventBus`, `ShortcutManager`, `ThemeManager` are each instantiated once and exported as a named const
5. **No async initialization** — all setup is synchronous; async work belongs in modules

---

## Adding to the core

Adding a new core file requires answering YES to ALL:
- [ ] Is it shared infrastructure used by 3+ modules or components?
- [ ] Does it have zero business logic (no file system knowledge, no UI rendering)?
- [ ] Can it be fully unit-tested without Tauri?

If any answer is NO → put it in a module instead.
