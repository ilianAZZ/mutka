# Mutka — Project Guide for AI Agents

## What this project is

Mutka is a **community-driven, modular file explorer for macOS** built with:

- **Tauri 2** (Rust backend + native WebView)
- **React 18 + TypeScript** (frontend)
- **Vite** (dev server and bundler)

The design goal: ship a minimal, rock-solid core and let the community build everything else as **modules**. Even built-in features (copy/paste, file creation, navigation) are modules. The core provides infrastructure only.

---

## Philosophy — read this before writing any code

### 1. Small files with one concern each

Every file does ONE thing. If a file exceeds ~150 lines, split it.
A file named `clipboard.ts` contains only clipboard logic.
A file named `FileRow.tsx` renders only a single file row.
Never mix concerns in the same file.

### 2. TypeScript types are the contract

Every public interface lives in `src/core/types.ts`. That file is the law.
No `any`. No `unknown` without a type guard immediately after.
If a shape is unknown at compile time, model it explicitly and guard it.

### 3. Modules own their logic, the core owns infrastructure

The core (`src/core/`) provides: registry, module runtime + permission gateway,
event bus, shortcut manager, type definitions.
The core NEVER contains feature logic (no copy, no navigate, no rename).
Feature logic lives in modules: built-ins in `src/sandbox-builtins/<name>.ts`,
community modules on disk in `~/.mutka/modules/<id>/index.js`.

### 4. Community-first architecture

Every architectural decision must ask: "Can someone outside this repo implement this?"
The `defineModule` shape (`src/core/sandbox/defineModule.ts`) is the public API a module
author writes; the `host` object passed to `setup` is the only system surface they touch.
The core must never require knowledge of specific modules.

### 5. Liquid Glass macOS native style

The UI follows macOS 26 "Liquid Glass" design. See `src/STYLE_GUIDE.md`.
All colors live in CSS variables. Never hardcode a color.
Dark mode follows the system (+ user override stored in localStorage).

---

## Tech stack

| Layer          | Technology                      | Why                                            |
| -------------- | ------------------------------- | ---------------------------------------------- |
| Window + shell | Tauri 2                         | Native WebView, ~15MB binary, Rust for FS ops  |
| UI framework   | React 18 + TypeScript           | Largest contributor pool for community modules |
| Build tool     | Vite 5                          | Fast HMR during development                    |
| Styling        | CSS variables + backdrop-filter | Liquid Glass without a CSS framework           |
| Rust deps      | serde, window-vibrancy          | Serialization + native macOS vibrancy          |

---

## Running the project

```bash
# Prerequisites: Rust + Node.js 18+ + Xcode CLI tools
npm install
npm run tauri dev      # opens app window with HMR
npm run tauri build    # production .app bundle
```

First `tauri dev` takes 3–5 min (Cargo downloads + compiles Tauri).
Subsequent runs are fast (<5s for Rust changes, instant for TS/CSS changes).

---

## Project structure

```text
mutka/
├── CLAUDE.md                    ← you are here (project overview)
├── INSTALL.md                   ← end-user install guide
├── docs/                        ← architecture.md, flows.md, events.md
│
├── dev-modules/                 ← repo-local community modules (DEV only)
│   ├── com.dir-stats/index.js   ← example untrusted module, worker-loaded
│   ├── com.folder-inspector/index.js ← example: declarative panel + form + status item
│   ├── com.webdav/index.js      ← virtual filesystem (WebDAV) + declarative settings UI
│   └── com.sqlite-browser/index.js ← claims .sqlite files → tables/rows (decodes the file format in-worker, fs:read only)
│
├── src/                         ← React + TypeScript frontend
│   ├── CLAUDE.md                ← frontend architecture rules
│   ├── STYLE_GUIDE.md           ← macOS visual design rules
│   ├── main.tsx                 ← entry point (mounts React root, imports CSS tokens)
│   ├── App.tsx                  ← root component (no module imports — uses moduleLoader)
│   ├── moduleLoader.ts          ← discovers built-in, community, and dev modules
│   │
│   ├── sandbox-builtins/        ← trusted built-in modules (defineModule format)
│   │   ├── navigation.ts        ← default open handlers (folder→navigate, file→open)
│   │   ├── clipboard.ts         ← copy (⌘C), cut (⌘X), paste (⌘V) via NSPasteboard
│   │   ├── file-ops.ts          ← new file, new folder, rename (F2), delete (⌘⌫)
│   │   ├── tabs.ts              ← new tab (⌘T), open-in-new-tab, modifier-open
│   │   ├── mouse-navigation.ts  ← back/forward mouse buttons (no commands)
│   │   ├── home.ts              ← on app:ready: resolve home dir → HomeStore, restore last dir
│   │   ├── settings.ts          ← open settings (⌘,) → toggles SettingsStore
│   │   ├── drop-import.ts       ← import files dropped from Finder (temp file → copy)
│   │   ├── auto-refresh.ts      ← re-read the list on "directory:changed" (file watch)
│   │   └── reveal.ts            ← example: open with system default app
│   │
│   ├── styles/                  ← global CSS split by concern
│   │   ├── tokens.css           ← Liquid Glass design tokens (light + dark)
│   │   ├── base.css             ← reset, body, #app shell, scrollbar
│   │   └── toolbar.css          ← toolbar + toolbar button styles
│   │
│   ├── core/                    ← infrastructure only, no features
│   │   ├── CLAUDE.md
│   │   ├── types.ts             ← shared foundation types (FileItem, BaseContext, …)
│   │   ├── sandbox/             ← the module system (two runtimes, one gateway)
│   │   │   ├── defineModule.ts  ← author-facing module shape (imports nothing)
│   │   │   ├── protocol.ts      ← the only contract crossing host ↔ worker
│   │   │   ├── hostProxy.ts     ← the `host` object handed to setup()
│   │   │   ├── capabilities.ts  ← the ONLY place system access is defined
│   │   │   ├── gateway.ts       ← THE permission barrier (dispatchCapability)
│   │   │   ├── whenClause.ts    ← evaluates serializable visibility clauses
│   │   │   ├── eventWhitelist.ts← events a sandboxed module may subscribe to
│   │   │   ├── proxyModule.ts   ← turns a manifest into a MutkaModule
│   │   │   ├── LocalHost.ts     ← in-process runtime (trusted built-ins)
│   │   │   ├── SandboxHost.ts   ← Web Worker runtime (untrusted community)
│   │   │   └── sandbox.worker.ts← the isolated realm community code runs in
│   │   ├── module-registry/
│   │   │   ├── ModuleRegistry.ts        ← register/unregister, dispatch actions/opens
│   │   │   └── module-registry.types.ts ← MutkaModule/Action/permissions contract
│   │   ├── app-bridge/AppBridge.ts      ← lets nav/dialog/refresh caps reach App state
│   │   ├── event-bus/{EventBus,events}.ts ← typed global event bus (EventMap)
│   │   ├── shortcut-manager/ShortcutManager.ts ← keyboard shortcut registry
│   │   ├── input-manager/InputManager.ts       ← raw input → semantic events
│   │   ├── file-watch/DirectoryWatcher.ts      ← relays Rust `directory-changed` → bus
│   │   ├── theme-manager/{ThemeManager,…}.ts    ← dark/light/system theme
│   │   ├── tab-manager/{TabManager,…}.ts         ← tab state + history
│   │   └── stores/{SelectionStore,ClipboardStore,UIStore,StatusBarStore,…}.ts ← reactive state owners
│   │
│   └── components/              ← reusable UI components (no business logic)
│       ├── CLAUDE.md
│       ├── FileList/            ← scrollable file list, owns selection state
│       ├── Breadcrumb/          ← clickable path segments
│       ├── ContextMenu/         ← floating Liquid Glass context menu
│       ├── Dialog/              ← Liquid Glass modal (prompt + confirm)
│       ├── Declarative/         ← renders module UINode trees (view/form/panel/modal)
│       ├── StatusBar/           ← bottom bar: core counts + module status items
│       ├── SettingsPanel/       ← theme picker and app settings
│       ├── Sidebar/             ← hosts module-contributed sidebar panels
│       └── TabBar/              ← tab strip
│
└── src-tauri/                   ← Rust backend (thin FS/system API layer)
    ├── CLAUDE.md                ← Rust conventions and command guide
    ├── Cargo.toml
    ├── tauri.conf.json
    └── src/
        ├── main.rs              ← entry point (calls lib::run)
        ├── watcher.rs           ← single FSEvents watcher for the current dir
        └── lib.rs              ← all Tauri commands (read_dir, copy_files, …,
                                   list_user_modules, read_module_file)
```

---

## The module system — one format, two runtimes, one gateway

A module is a plain ESM file that `export default defineModule({ id, name, version,
permissions, commands, openHandlers, setup })`. **Authors import nothing from the core.**
Inside `setup(host)` the module receives a `host` object — its ONLY way to reach the
system. Every privileged call (`host.fs.*`, `host.board.*`, `host.nav.*`, `host.tabs.*`,
`host.dialog.*`, `host.ui.*`, `host.statusbar.*`, `host.refresh()`) is checked against the
module's declared `permissions`.

The same format runs in two interchangeable runtimes, differing only in transport:

```text
                       ┌──────────────── one module format (defineModule) ────────────────┐
   built-in / trusted  │                                       │  community / untrusted    │
                       ▼                                       ▼                            │
   ┌──────────────────────────────┐         ┌────────────────────────────────────────────┐│
   │ LocalHost  (in-process)      │         │ SandboxHost                                 ││
   │ no Worker, no postMessage,   │         │  ╔═══ Web Worker (isolation boundary) ═════╗││
   │ direct calls                 │         │  ║ no DOM · no invoke · no core reference  ║││
   │                              │         │  ║ module source imported from a blob URL  ║││
   │                              │         │  ║ reaches system only via postMessage RPC ║││
   │                              │         │  ╚═════════════════════════════════════════╝││
   └──────────────┬───────────────┘         └───────────────────────┬────────────────────┘│
                  │                                                  │                      │
                  └──────────────► dispatchCapability() ◄────────────┘                      │
                                   ════════════════════                                     │
                                   THE GATEWAY (gateway.ts)                                  │
                                   one permission barrier: requested cap's required          │
                                   permission must be in the module's manifest, else throw   │
                                          │                                                  │
                                          ▼                                                  │
                          capabilities.ts — the ONLY code that touches                       │
                          invoke() · AppBridge · TabManager                                  │
                                          │                                                  │
                  ┌───────────────────────┼───────────────────────┐                         │
                  ▼                       ▼                       ▼                          │
            Rust commands (invoke)   App React state (AppBridge)  TabManager                 │
```

- **Built-ins run in-process** (LocalHost): isolation buys nothing and a worker per
  module would waste memory and add latency. Still gated identically.
- **Community modules run isolated** (SandboxHost → Web Worker): a denied permission is
  not just refused, it is *physically* unreachable — the worker has no `invoke`.
- **`capabilities.ts` is the whole vocabulary.** If an operation is not listed there,
  no module can perform it. To expose something new, add it there and nowhere else.

### Capabilities and the permissions they require

| Capability                                                                       | Required permission | Backed by                                           |
| -------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------- |
| `fs.readDir`, `fs.openItem`                                                      | `fs:read`           | Rust `read_dir` / `open_item`                       |
| `fs.readBytes`                                                                   | `fs:read`           | Rust `read_file_base64` (decoded to a `Uint8Array`) |
| `fs.cloudStatus`                                                                 | `fs:read`           | Rust `cloud_status` (`SF_DATALESS` stat flag)       |
| `fs.copyFiles`/`moveFiles`/`deleteItem`/`renameItem`/`createFile`/`createFolder` | `fs:write`          | Rust FS commands                                    |
| `board.readFiles`                                                                | `clipboard:read`    | Rust `clipboard_read_files`                         |
| `board.writeFiles`                                                               | `clipboard:write`   | Rust `clipboard_write_files`                        |
| `nav.navigate`/`goBack`/`goForward`/`goUp`                                       | `navigation`        | AppBridge                                           |
| `tabs.openTab`/`openTabInBackground`/`isActive`                                  | `navigation`        | TabManager                                          |
| `dialog.prompt`/`confirm`                                                        | `dialog`            | AppBridge                                           |
| `app.refresh`                                                                    | `fs:read`           | AppBridge                                           |
| `home.get`                                                                       | `fs:read`           | HomeStore (the app home dir, not the OS home)       |
| `home.set`                                                                       | `view`              | HomeStore (any module may override the home dir)    |
| `settings.toggle`                                                                | `view`              | SettingsStore (open/close the settings overlay)     |
| `ui.render`/`clear`/`modal`                                                      | `ui`                | UIStore (declarative UINode surfaces + the modal)   |
| `statusbar.set`/`remove`                                                         | `ui`                | StatusBarStore (bottom status-bar items)            |
| `sys.homeDir`                                                                    | `fs:read`           | Rust `get_home_dir` (the OS home dir)               |
| `sys.lastDir`                                                                    | `fs:read`           | localStorage (last visited dir, for launch restore) |
| `sys.writeTempFile`                                                              | `fs:temp`           | Rust `write_temp_file` (lower-risk than `fs:write`) |

`ModulePermission`: `fs:read`, `fs:write`, `fs:temp`, `clipboard:read`, `clipboard:write`,
`navigation`, `view`, `dialog`, `network`, `storage`, `secrets`, `ui`, `shell`
(`shell` is reserved — no capability uses it yet). `fs:temp` writes only to the OS temp dir,
so it is deliberately weaker than `fs:write`. `ui` gates declarative UI + status-bar
contributions. There is deliberately no SQLite/`db` capability: a `.sqlite` file IS the
database, so a module reads its bytes with `fs:read` and decodes the format in its own
worker (see `com.sqlite-browser`) — the core stays format-agnostic.

### Declarative UI — how a sandboxed module renders (no React, no JSX)

A worker module cannot hand a React component across `postMessage`, so it describes its UI
as **data**: a serializable `UINode` tree (see `protocol.ts`). The host renders it natively
with Liquid Glass widgets (`components/Declarative/`). Modules never inject markup, CSS, or
components — only JSON. The same tree fills four surfaces:

- **A side-pane panel** — declare `panels: [{ id, title, icon, side?, defaultWidth? }]`, then
  fill it from `setup` with `host.ui.render(id, node)`.
- **A modal** — `host.ui.modal(node)` to open, `host.ui.modal(null)` to close.
- **A settings section** — declare `settingsSections: [{ id, title }]`, fill with `host.ui.render(id, node)`.
- **A status-bar popover** — a `StatusBarItem` whose `onClick` is `{ popover: surfaceId }`.

**Forms** are a `form` node carrying a `FormSchema` — a **JSON-Schema Draft-7 subset** (the
standard wire format). Authors may generate it from zod (`z.toJSONSchema()` / `zod-to-json-schema`);
the host never imports zod, it just renders the schema and returns the collected values.

**Interactions** (a button click, a list-row click, a form submit) carry an `action` id the
module registered with `host.onUIEvent(id, handler)`; the host routes the event back into the
module's runtime via `ModuleRegistry.dispatchUIEvent`. Status-bar items are dynamic — upserted
with `host.statusbar.set(item)` and removed with `host.statusbar.remove(id)`.

### File watching (current directory only)

The host watches **only the directory in view** — `read_dir` re-arms a single `notify`
watcher on every navigation and emits `directory-changed`. `core/file-watch/DirectoryWatcher.ts`
debounces it and re-broadcasts as the whitelisted `directory:changed` event. Modules subscribe
via `host.events.on("directory:changed", …)`; the built-in `core.auto-refresh` re-reads the
list. No module-requested watchers, so the cost is bounded.

**Listing is never blocked by watching** (rendering folder content is the priority):
`watcher::arm` runs on a detached thread and reuses one persistent watcher (unwatch old +
watch new) instead of dropping/recreating it — dropping a macOS FSEvents watcher joins its
run-loop thread, which previously stalled every `read_dir`. `Access` events are ignored so
merely reading a directory can't loop back into a refresh.

---

## Key architectural flows

### How modules are discovered and registered

```text
App.tsx (module scope) fires three loaders from src/moduleLoader.ts:
  loadBuiltinSandboxModules()
    └── import.meta.glob("./sandbox-builtins/*.ts", { eager: true })
          └── new LocalHost(def).register()   ← in-process, trusted
  loadCommunityModules()
    └── invoke("list_user_modules") → for each: invoke("read_module_file", path)
          └── new SandboxHost(source).register()   ← isolated Web Worker
  loadDevModules()  (DEV only)
    └── import.meta.glob("../dev-modules/*/index.js", { query: "?raw" })
          └── new SandboxHost(source).register()   ← exercises the worker path locally

Each host: gets the module's manifest (setup runs in its runtime), then
registerProxyModule() turns the manifest into a MutkaModule and registers it:
  ├── stores each command as a MutkaAction (its when-clause → isVisible predicate)
  ├── binds each command.shortcut via ShortcutManager
  └── stores each openHandler sorted by priority (desc)

Once ALL loaders resolve AND AppBridge is connected, App emits `app:ready` — the
launch hook. `core.home` listens for it to resolve the home dir into HomeStore and
run the initial navigation. (Emitted after registration so subscriptions are wired,
and after AppBridge.connect so `host.nav.navigate` reaches real React state.)
```

Adding a built-in: drop a `.ts` file in `src/sandbox-builtins/`. Adding a community
module: place `index.js` in `~/.mutka/modules/<id>/`. No App.tsx changes needed.

### How a keyboard shortcut / command executes

```text
User presses ⌘C
  → ShortcutManager normalizes key → "meta+c"
  → EventBus.emit("action:dispatch", { actionId: "core.clipboard.copy" })
  → ModuleRegistry.executeAction(actionId): checks isVisible/isEnabled, then action.execute()
  → proxyModule: runtime.run(commandId, appSnapshot())   ← snapshot of selection/dir/clipboard
  → the module's command handler runs (in-process or in its worker)
  → handler calls host.board.writeFiles(...) → gateway checks "clipboard:write" → invoke(...)
  → clipboard module's Rust write + EventBus.emit("clipboard:changed") refresh the UI
```

### How a double-click open resolves

```text
User double-clicks a folder
  → FileList calls onOpen(item) → App.tsx → ModuleRegistry.resolveOpen(item)
  → first openHandler (sorted by priority desc) whose matches(item) is true wins
  → proxyModule: runtime.runOpen(handlerId, item) → the module's open handler
  → default: core.navigation priority 0 → folder→host.nav.navigate, file→host.fs.openItem
  → override: a community module at higher priority can claim e.g. all .png files
```

### How a dialog is shown from a module

```text
A command handler calls: const name = await host.dialog.prompt({ message, defaultValue })
  → gateway checks "dialog" permission → AppBridge.dialog.prompt(opts)
  → App.tsx dialogAPI.prompt() sets dialogState (React state) → renders <Dialog>
  → user types + clicks OK → Dialog resolves the promise
  → value travels back through the gateway (and, for a worker module, back over postMessage)
```

### How a Tauri command is called

```text
capabilities.ts: await invoke<ReturnType>("command_name", { arg: value })
  → IPC bridge → Rust: #[tauri::command] fn command_name(arg: Type) -> Result<ReturnType, String>
  → Result<T, String>: Ok(value) resolves the Promise, Err(msg) rejects it
```

Note: only `capabilities.ts` (and a few App-level reads) call `invoke()`. Modules never do.

---

## Open questions for future decisions

> These are documented here so no agent makes these decisions silently.

- **Module registry URL**: Where is the community module registry hosted, and how does
  `~/.mutka/modules/` get populated? (npm tag? Custom JSON endpoint? GitHub topic?)
- **`shell` permission**: declared in the enum but no capability backs it yet. What
  operations should it unlock, and through which Rust commands? (`network` is now backed
  by the `net.*` capabilities.)
- **Sandbox module UI** — RESOLVED: worker modules now render via a declarative `UINode`
  tree (`host.ui.*`, `host.statusbar.*`, the `ui` permission). See "Declarative UI" above.
  Open follow-ups: the node vocabulary is intentionally small (no custom layout/animation),
  and a declarative panel has no direct read of the current directory — it must track state
  from the whitelisted events it subscribes to. Widen the node set / events as real modules
  need them.
- **Module namespace**: Convention for community module IDs — `author.module-name` (used
  today, e.g. `com.dir-stats`) or `@author/module-name`?
- **Minimum macOS version**: Liquid Glass / NSVisualEffectView requires macOS 10.14+. Tauri 2 requires macOS 10.13+.
- **Code signing**: How are builds distributed? (Homebrew cask? Direct download? Mac App Store?)
