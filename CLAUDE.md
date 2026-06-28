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

### 6. Docs are part of the public API — keep them in sync

Because modules are built by people outside this repo, the docs ARE a contract.
**Whenever you change an interface, type, capability, permission, event, Tauri command,
the `host`/`defineModule` shape, the host ↔ worker protocol, or any architectural flow,
update the matching documentation in the SAME change** — root `CLAUDE.md`, the per-directory
`CLAUDE.md` files, and `docs/{architecture,flows,events}.md`. Never leave docs stale, and
grep for any renamed symbol so no old name survives. Run the `update-docs` skill — it maps
each kind of change to the file(s) that document it. Purely internal refactors (no shape
change) need no doc update.

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

## Releasing — the tag IS the release trigger

**Releases are not created from the GitHub UI and CI does not invent the tag.** A
release happens because **a `vX.Y.Z` git tag is pushed**; that push (and only that
push) triggers `.github/workflows/release.yml`, which builds the universal macOS
bundle and creates a **draft** GitHub Release with the `.dmg`, `.app.tar.gz`, and
updater `latest.json` + signature attached. You then click **Publish**.

Versioning is **changeset-based** — never hand-edit a version number. The rules:

1. **Every source-changing commit needs a changeset** (`src/`, `src-tauri/src/`, or
   the manifests). Use the `add-changeset` skill; the pre-commit hook blocks commits
   that lack one. Docs/chore/changeset-only commits are exempt.
2. **Bump level**: `patch` (fix/refactor), `minor` (new feature/capability/permission/
   event/Tauri command, backward-compatible), `major` (breaking change to the module
   API — `host`/`defineModule`/`protocol.ts`/any documented contract). Highest staged
   bump wins.
3. **Cut the release** with `pnpm release` — it consumes the changesets, bumps the
   three manifests in lockstep (`package.json`, `tauri.conf.json`, `Cargo.toml`),
   writes `CHANGELOG.md`, commits `release: vX.Y.Z`, and **creates the tag**. Then
   `git push --follow-tags` to push the tag and fire CI. Do **not** create the tag or
   release by hand — `tauri-action` owns the release for that tag, so a manually
   created one collides.

See `docs/releasing.md` and `.changeset/README.md` for the full flow, and the
`add-changeset` / `cut-release` skills.

### Signing secrets (repo Actions secrets)

Two independent concerns, both optional — CI still builds installable bundles without them:

- **Apple code signing & notarization** (so the app opens with a normal double-click
  instead of right-click → Open): `APPLE_CERTIFICATE` (base64 of the exported
  `Developer ID Application` `.p12`), `APPLE_CERTIFICATE_PASSWORD` (that `.p12`'s
  password), `APPLE_SIGNING_IDENTITY` (e.g. `Developer ID Application: Name (TEAMID)`),
  `APPLE_ID` (your Apple developer account email), `APPLE_PASSWORD` (an
  **app-specific password**, not your real one), `APPLE_TEAM_ID`. These require a paid
  Apple Developer account. Unset today → builds are **unsigned**.
- **Updater signing** (so the in-app auto-updater activates): `TAURI_SIGNING_PRIVATE_KEY`
  (already set) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if the key has one. This is
  unrelated to Apple signing — it only signs the update payload against the public key
  in `tauri.conf.json`.

---

## Project structure

```text
mutka/
├── CLAUDE.md                    ← you are here (project overview)
├── INSTALL.md                   ← end-user install guide
├── docs/                        ← architecture.md, safety.md, flows.md, events.md, releasing.md
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
│   ├── App.tsx                  ← root component (no module imports — calls ModuleManager.init)
│   │
│   ├── module-manager/          ← module lifecycle + marketplace (app layer, calls invoke)
│   │   ├── CLAUDE.md
│   │   ├── ModuleManager.ts     ← singleton: discover, enable/disable/install/uninstall (live)
│   │   ├── descriptors.ts       ← the 3 module sources (built-in glob, dev glob, community invoke)
│   │   ├── moduleConfig.ts      ← read/write ~/.mutka/config.json (disabled set + install meta)
│   │   ├── probeManifest.ts     ← validate a module by loading it in a throwaway worker
│   │   ├── DiscoveryRegistry.ts ← re-export of core/discovery (sources come from modules)
│   │   ├── authorInfo.ts        ← manifest author → avatar/profile URLs
│   │   ├── installModule.ts     ← write a validated module to disk (install_module)
│   │   ├── permissionInfo.ts    ← permission labels + dangerous-permission flags
│   │   └── types.ts             ← ManagedModule, ModuleConfig, ModuleDiscoverySource, …
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
│   │   ├── telemetry.ts         ← times folder opens (data vs render) via nav/listing events
│   │   ├── github-discovery.ts  ← module-discovery source for GitHub, shipped AS a module
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
│   │   │   ├── probeManifest.ts ← validate a source in a throwaway worker → manifest
│   │   │   └── sandbox.worker.ts← the isolated realm community code runs in
│   │   ├── discovery/           ← pluggable module discovery (sources come from modules)
│   │   │   ├── DiscoveryRegistry.ts ← holds module-contributed sources; discover + resolve
│   │   │   └── types.ts             ← ModuleListing, DiscoveryQuery/Result, ModuleDiscoverySource
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
│       ├── ModulesPanel/        ← module manager overlay (installed list + GitHub browse + install review)
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
        ├── modules.rs           ← module discovery + install/uninstall + config (~/.mutka)
        └── lib.rs              ← all Tauri commands (read_dir, copy_files, …,
                                   list_user_modules, read_module_file, install_module,
                                   uninstall_module, read_module_config, write_module_config)
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
| `dialog.prompt`/`confirm`/`choose`                                               | `dialog`            | AppBridge                                           |
| `dialog.pickFile`                                                                | `dialog`            | AppBridge → Mutka file-picker modal (returns a path) |
| `net.request`                                                                    | `network:public` **or** `network:local` | Rust `http_request` (host-proxied HTTP; URL tier-checked) |
| `app.refresh`                                                                    | `fs:read`           | AppBridge                                           |
| `app.activate`                                                                   | `navigation`        | `ModuleRegistry.resolveOpen` (run an item's open handlers) |
| `home.get`                                                                       | `fs:read`           | HomeStore (the app home dir, not the OS home)       |
| `home.set`                                                                       | `view`              | HomeStore (any module may override the home dir)    |
| `settings.toggle`                                                                | `view`              | SettingsStore (open/close the settings overlay)     |
| `ui.render`/`clear`/`modal`                                                      | `ui`                | UIStore (declarative UINode surfaces + the modal)   |
| `statusbar.set`/`remove`                                                         | `ui`                | StatusBarStore (bottom status-bar items)            |
| `sys.homeDir`                                                                    | `fs:read`           | Rust `get_home_dir` (the OS home dir)               |
| `sys.lastDir`                                                                    | `fs:read`           | localStorage (last visited dir, for launch restore) |
| `sys.writeTempFile`                                                              | `fs:temp`           | Rust `write_temp_file` (lower-risk than `fs:write`) |
| `modules.probe`                                                                  | `discovery`         | `probeManifest` (validate a source → manifest, for discovery sources) |
| `modules.install`                                                                | `discovery`         | `ModulesStore.requestInstall` → install-review dialog (user consent) |
| `config.get`/`set`                                                               | `storage`           | localStorage, namespaced `mutka.modcfg.<id>.<key>`  |
| `secrets.get`/`set`/`delete`                                                     | `secrets`           | Rust Keychain, namespaced `mutka.<id>`              |
| `selection.set`                                                                  | `view`              | SelectionStore                                      |
| `view.setSort`/`toggleSort`/`toggleHidden`/`setShowHidden`                       | `view`              | ListingStore / ViewStore                            |
| `sys.quickLook`/`previewUpdate`                                                  | `fs:read`           | Rust Quick Look panel                              |
| `sys.appsForFile`/`openWith`                                                     | `fs:read`           | Rust Launch Services ("Open With") — **can launch apps** |
| `sys.startDrag`                                                                  | `fs:read`           | DragService (native OS file drag-out)              |

`ModulePermission`: `fs:read`, `fs:write`, `fs:temp`, `clipboard:read`, `clipboard:write`,
`navigation`, `view`, `dialog`, `network:public`, `network:local`, `storage`, `secrets`,
`ui`, `discovery`, `shell` (`shell` is reserved — no capability uses it yet). `discovery` lets a module contribute a
module-discovery source (`discoverySources` + `host.onDiscover`/`onFetchSource`) and probe
fetched sources (`host.modules.probe`); GitHub discovery ships as exactly such a built-in
module (`sandbox-builtins/github-discovery.ts`). `fs:temp` writes only to the OS temp dir,
so it is deliberately weaker than `fs:write`. `ui` gates declarative UI + status-bar
contributions. There is deliberately no SQLite/`db` capability: a `.sqlite` file IS the
database, so a module reads its bytes with `fs:read` and decodes the format in its own
worker (see `com.sqlite-browser`) — the core stays format-agnostic.

**Network is two least-privilege tiers.** There is no blanket `network` permission.
A module declares whichever it needs (or both):
`network:public` allows **HTTPS to public domains only** — https is enforced so data
can't be read in transit, and IPs/`localhost` are refused, which blocks SSRF to the
cloud metadata endpoint and LAN services; `network:local` allows **http/https to a
private IP range or `localhost`** (a self-hosted server or NAS — public IPs refused). The URL is classified and
enforced in Rust (`http.rs` → `check_url_allowed`). Crucially, a module **cannot make
native network calls at all** (`fetch`, `XMLHttpRequest`, `WebSocket`, a remote
`import()`, …): the app Content-Security-Policy (`tauri.conf.json`) restricts
`connect-src` to the Tauri IPC bridge and forbids remote scripts, so the only egress
from the WebView is `host.net` → Rust → the permission gateway. See `docs/safety.md`.

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
App.tsx (module scope) calls ModuleManager.init() (src/module-manager/):
  collectDescriptors() gathers the three sources (descriptors.ts):
    builtin   import.meta.glob("../sandbox-builtins/*.ts")        → LocalHost(def)
    dev       import.meta.glob("../../dev-modules/*/index.js","?raw") → SandboxHost(source)  (DEV only)
    community invoke("list_user_modules") → invoke("read_module_file") → SandboxHost(source)
  loadConfig() reads ~/.mutka/config.json (which modules are disabled)
  for each descriptor:
    enabled?  descriptor.activate() → host.register()  ← creates + registers the live host
    disabled? descriptor.probe()    ← reads the manifest in a throwaway worker (no register)

Each host: gets the module's manifest (setup runs in its runtime), then
registerProxyModule() turns the manifest into a MutkaModule and registers it:
  ├── stores each command as a MutkaAction (its when-clause → isVisible predicate)
  ├── binds each command.shortcut via ShortcutManager
  └── stores each openHandler sorted by priority (desc)

Once ModuleManager.init() resolves (all enabled modules registered) AND AppBridge is
connected, App emits `app:ready` — the launch hook. `core.home` listens for it to
resolve the home dir into HomeStore and run the initial navigation. (Emitted after
registration so subscriptions are wired, and after AppBridge.connect so
`host.nav.navigate` reaches real React state.)
```

Adding a built-in: drop a `.ts` file in `src/sandbox-builtins/`. Adding a community
module: place `index.js` in `~/.mutka/modules/<id>/` (or install one from the Modules
overlay). No App.tsx changes needed.

### How a module is enabled / disabled / installed / deleted at runtime

```text
The Modules overlay (components/ModulesPanel/) drives ModuleManager — all live, no restart:
  enable(id)    → descriptor.activate() spins up the host + registers it
  disable(id)   → ModuleRegistry.unregister(id) → onUnmount → host.dispose → worker.terminate()
  install(listing) → DiscoveryRegistry.resolve() fetches source + validates in a throwaway worker
                  → install review dialog (permissions, dangerous ones flagged, source viewable)
                  → install_module writes ~/.mutka/modules/<id>/index.js → activate
  uninstall(id) → unregister + uninstall_module removes the dir
Every change is persisted to ~/.mutka/config.json (disabled set + install metadata).
Discovery is a registry of ModuleDiscoverySource's (githubSource built in today);
the seam (types.ts) lets a future GitLab / local-folder / private-registry source —
even one shipped as a module — drop in. See src/module-manager/CLAUDE.md.
```

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

Note: only `capabilities.ts` and the `core/file-system/FileSystemRegistry.ts` it
delegates fs routing to (plus a few App-level reads) call `invoke()`. FileSystemRegistry
is reached only *through* the gateway, so it is part of the gateway's fulfilment, not a
second entry point. Modules never call `invoke()`.

---

## Open questions for future decisions

> These are documented here so no agent makes these decisions silently.

- **Module registry URL**: Where is the community module registry hosted, and how does
  `~/.mutka/modules/` get populated? (npm tag? Custom JSON endpoint? GitHub topic?)
- **`shell` permission**: declared in the enum but no capability backs it yet. What
  operations should it unlock, and through which Rust commands? (Network is now backed
  by the `net.request` capability, split into the `network:public` / `network:local`
  permission tiers.)
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
