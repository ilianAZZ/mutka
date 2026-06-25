# Mutka — Module System Roadmap & Feature Ledger

Source of truth for the unified, permission-gated module system.

---

## Architecture

**One module format, one permission gateway, two runtimes.**

Every module — built-in or community — is a `defineModule({ id, permissions,
commands, openHandlers, setup })` default export that imports nothing and reaches
the system only through `host.*`. The difference is only *where it runs*:

| Runtime         | File                          | For                   | Cost                    |
| --------------- | ----------------------------- | --------------------- | ----------------------- |
| **LocalHost**   | `core/sandbox/LocalHost.ts`   | Built-in (trusted)    | in-process, no overhead |
| **SandboxHost** | `core/sandbox/SandboxHost.ts` | Community (untrusted) | isolated Web Worker     |

Both load the same format and gate every capability through the same
`core/sandbox/gateway.ts` → `core/sandbox/capabilities.ts`. Swapping a module
between runtimes is a one-line change; the module code is identical.

The gateway is the single barrier: a module that didn't declare a permission
physically cannot use the capability — worker modules can't even reach `invoke`.

Capabilities exposed today: `fs`, `board` (clipboard), `nav`, `tabs`, `dialog`,
`app.refresh`, `sys.homeDir`. Whitelisted subscribable events:
`input:mouse-navigate`, `file:modifier-open` (`core/sandbox/eventWhitelist.ts`).

---

## Done ✅

Foundation (`core/sandbox/`): protocol, capabilities, gateway, proxyModule,
hostProxy, whenClause, eventWhitelist, defineModule, LocalHost, SandboxHost,
sandbox.worker. Plus `core/app-bridge/AppBridge.ts` (nav/dialog/refresh).

**All 5 built-in modules migrated to the unified format** (`src/sandbox-builtins/`)
and the legacy `src/modules/*` + `src/core/services/*` **deleted**:

- [x] `clipboard.ts` — copy/cut/paste (`board`, `fs`)
- [x] `file-ops.ts` — new file/folder, rename, delete (`fs`, `dialog`)
- [x] `navigation.ts` — go back/forward + open handlers folder→navigate, file→system (`nav`, `fs`)
- [x] `tabs.ts` — new tab, open-in-new-tab, ctrl/⌘-click (`tabs` + `file:modifier-open`)
- [x] `mouse-navigation.ts` — mouse buttons → history (`nav` + `input:mouse-navigate`)
- [x] `reveal.ts` — example built-in (Open with System)

Other:

- [x] TabBar moved from a module panel to core UI (`components/TabBar/`), rendered by App.tsx
- [x] `ModuleRegistry` stripped of the old context/service plumbing (`buildContext`, `tracePermissions`, `connect`); now `init()` + simple `executeAction`/`resolveOpen`
- [x] `types.ts` trimmed (removed `FsAPI`, `ClipboardAPI`, `ActionContext`)
- [x] Loaders: `loadBuiltinSandboxModules` (LocalHost), `loadCommunityModules` (`~/.mutka`, SandboxHost), `loadDevModules` (repo `dev-modules/`, DEV only)
- [x] Example community module `dev-modules/com.dir-stats/index.js`

`tsc --noEmit` ✅ · `vite build` ✅ (worker emits as its own chunk).

---

## Behavior changes from the port (acceptable feature loss)

- Context menu items now **hide** instead of **grey out** (model uses `when`
  visibility, not `isEnabled`): copy/cut hidden when nothing selected, paste
  hidden when the clipboard is empty.
- `go-back`/`go-forward` shortcuts always fire; the nav layer no-ops when there's
  no history (previously the action was disabled).
- Cut→paste clears the pasteboard via `writeFiles([])` (no dedicated `clear`).

---

## NOT validated yet ⚠️ (needs `npm run tauri dev` — can't launch Tauri here)

Run the app and confirm each ported feature still works:

- [ ] Copy/cut/paste (⌘C/⌘X/⌘V), New File/Folder, Rename (F2), Delete (⌘⌫)
- [ ] Double-click folder navigates; double-click file opens; ⌘[ / ⌘]
- [ ] Tabs: ⌘T, "Open in New Tab", ctrl/⌘-double-click a folder; TabBar renders
- [ ] Mouse back/forward buttons navigate
- [ ] `com.dir-stats` "Count items here (sandboxed)" logs a real count from its worker
- [ ] **Delete `"fs:read"` from `dev-modules/com.dir-stats/index.js` → call DENIED** (the original goal)
- [ ] Confirm Tauri CSP allows `import(blobURL)` inside the worker (fallback: stream source over a MessagePort instead of blob import)

---

## Done (later passes)

- [x] All docs rewritten to the unified architecture (root + src + core + components
      + src-tauri CLAUDE.md, docs/{architecture,flows,events}.md, COMMUNITY_MODULES.md,
      README, INSTALL, and the `.claude/skills/*` authoring guides).
- [x] Dead code removed: top-bar panels (`MutkaTopBarPanel`/`topBarPanels`/`getTopBarPanels`),
      toolbar contributions (`showInToolbar`/`getToolbarActions`), `getModules`/`ModuleManifest`.
- [x] UX wins: middle-click tab close, middle-click folder → background tab, column
      sorting (persisted), internal drag-and-drop move, customizable keybinds + import/export,
      native Quick Look (space). New capability `sys.quickLook`.
- [x] Declarative left sidebar ("Places", `components/Places/`): modules contribute
      `sidebarItems: [{ id, label, icon?, category?, path?|command?, removable? }]`, grouped by
      category (defaults in `SidebarCategories`, custom strings allowed, same category merges).
      Serializable → works for worker modules too. Core shows Home/Computer; WebDAV adds
      a "Cloud → WebDAV" entry. Load errors now surface in the file list.
- [x] DYNAMIC sidebar items: `host.sidebar.set(items)` updates a module's items at runtime
      (`ModuleRegistry.setDynamicSidebarItems` → `sidebar:changed` event → Places re-reads).
      `removable` items show a ✕ that emits `sidebar:item-remove` (whitelisted) back to the module.
      Example: `src/sandbox-builtins/bookmarks.ts` — "Add to Bookmarks" (single dir) + ✕ to remove,
      persisted via `config` (`storage` perm), shown under a custom "Bookmarks" category.

## File System Providers (pluggable file source) ✅ built

The file source is no longer local-only. `core/file-system/FileSystemRegistry.ts`
routes `readDir`/`openItem` by URI scheme: a registered provider handles its scheme,
everything else goes to Rust. A built-in module registers a provider via
`host.onList(scheme, …)` / `host.onOpenFile(scheme, …)` (LocalHost only — providers
are trusted and need DOM APIs the worker lacks). New capabilities: `net.request`/
`net.download` (`network` perm, Rust `ureq` HTTP — bypasses CORS), `config.get`/`config.set`
(`storage` perm, per-module namespaced).

**WebDAV module** (`src/sandbox-builtins/webdav.ts`): generic — works with any WebDAV
server (Nextcloud, ownCloud, mod_dav). Scheme `webdav:/…`, lists via PROPFIND, opens files
by downloading (Rust streams bytes). Config in Settings → WebDAV (full base URL + user +
password), "Connect to WebDAV" command. Errors surface in the file list (401 / HTTP status).
TLS: ureq with an explicit native-tls Agent (`http_agent` in lib.rs).

Write ops implemented: create folder/file, rename, delete (MKCOL/PUT/MOVE/DELETE via `net`,
routed through `FileSystemRegistry`). Path encoding fixed (decoded for display, encoded per
segment for requests). **Upload/copy/move done**: `FileSystemRegistry.copyFiles/moveFiles`
route by destination — local→remote uploads (Rust `http_upload` PUTs the bytes, `net.upload`
capability), remote→remote uses WebDAV COPY/MOVE, move deletes the local original. Paste (⌘V)
into a WebDAV folder and drag-drop both upload.

**Multi-account + Keychain** ✅: accounts `{ id, name, url, username }` in `config`; each
PASSWORD in the macOS **Keychain** via the new `secrets` capability (Rust `keyring` →
`secret_set/get/delete`, namespaced `mutka.<moduleId>`). Scheme is per-account
(`webdav:<accountId>/…`). Settings → WebDAV Accounts manages add/edit/rename/remove
(`components/SettingsPanel/WebDavAccounts.tsx`), emitting `webdav:accounts-changed`. Each
account is a renamable, ✕-removable entry under "Cloud" in the Places sidebar.

⚠️ Validate live: PROPFIND against a real server; Keychain access in `tauri dev` is unsigned,
so macOS may prompt per access / not persist across rebuilds — stable behavior needs a signed
build. Local **caching** of opened files is still naive (re-downloads each open).

## Next

- [ ] Remote write ops for providers (route `fs.copy/move/delete/create` through the registry + provider write handlers).
- [ ] Secrets capability backed by macOS Keychain (replace plaintext config for credentials).
- [ ] Community (worker) providers: needs a provider-call RPC + a worker-safe XML parser.
- [ ] More capabilities as needed: `shell`, broader `sys`.
- [ ] Sandboxed custom UI: constrained host-rendered components vs. iframe webview
      (this is what unblocks module-contributed sidebar panels — the `MutkaSidebarPanel`
      infra exists but the sandbox format can't fill it yet).
- [ ] Native drag-out to Finder (NSDragging, Rust) — currently `dragDropEnabled:false`
      for internal HTML5 DnD, which disables OS↔app native drag.

## Open questions (before the marketplace)

- Module signing / integrity (anyone can drop a file in `~/.mutka/modules`)
- Permission **consent UI** — show `manifest.permissions` before first run
- Per-`run` watchdog/timeout (a worker can busy-loop) + RPC rate/size limits
