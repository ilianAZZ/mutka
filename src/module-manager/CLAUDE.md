# src/module-manager/ — Module Lifecycle & Marketplace

This folder owns the **runtime lifecycle of modules**: discovering them, reading
their manifests, enabling/disabling them live, and installing/deleting community
modules from a catalog (GitHub today). It is the app-layer service behind the
**Modules** overlay (`components/ModulesPanel/`).

It lives **outside `core/`** on purpose: like the old `moduleLoader.ts`, it calls
`invoke()` to reach Rust. `core/` may not. Components reach it as a singleton
(`ModuleManager`), the same way they import `ThemeManager` / `ModuleRegistry`.

---

## Why this exists

The two runtimes (`LocalHost`, `SandboxHost`) and `ModuleRegistry` already support
**hot teardown**: `ModuleRegistry.unregister(id)` → `onUnmount` → `runtime.dispose()`
→ (for community) `worker.terminate()`. What was missing was someone **tracking**
the live host per module so it can be disabled/re-enabled/replaced without a
restart. That tracker is `ModuleManager`.

---

## Files (one concern each)

| File                 | Responsibility                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `types.ts`           | `ManagedModule`, `ModuleDescriptor`, `ModuleConfig`, `InstalledMeta`, and the discovery types (`ModuleDiscoverySource`, `ModuleListing`, `DiscoveryQuery`/`Result`, `ResolvedModule`). |
| `ModuleManager.ts`   | The singleton lifecycle owner: `init`, `getAll`, `subscribe`, `enable`, `disable`, `install`, `uninstall`.     |
| `descriptors.ts`     | Builds `ModuleDescriptor`s from the three sources (built-in glob, dev glob, community `invoke`). Owns the globs. |
| `moduleConfig.ts`    | Loads/saves `~/.mutka/config.json` (disabled set + install metadata) via the Rust config commands.             |
| `probeManifest.ts`   | Loads a module's source in a THROWAWAY worker → its manifest, or throws. Used for validation + disabled metadata. |
| `DiscoveryRegistry.ts` | Singleton registry of discovery sources: `discover` (aggregate + filter + paginate) and `resolve` (fetch + probe). |
| `githubSource.ts`    | The built-in `ModuleDiscoverySource`: searches `mutka-module-*` repos, probes entries for metadata, fetches source. |
| `installModule.ts`   | Writes a validated module to disk via the Rust `install_module` command; returns its `InstalledMeta`.          |
| `authorInfo.ts`      | Turns a manifest `author` (+ repo-owner fallback) into avatar/profile URLs for the Modules UI.                  |
| `permissionInfo.ts`  | Human labels + **danger classification** for the install consent screen.                                        |

---

## The three module sources

Every module is a `ModuleDescriptor` with `probe()` (read manifest without running)
and `activate()` (create + register the live host):

- **`builtin`** — `import.meta.glob("../sandbox-builtins/*.ts")`. Trusted, in-process
  (`LocalHost`). Manifest derived from the def with no setup, so probing is free.
- **`dev`** — `import.meta.glob("../../dev-modules/*/index.js", "?raw")`, DEV builds
  only. Isolated worker (`SandboxHost`). Folder name = id.
- **`community`** — `invoke("list_user_modules")` → `~/.mutka/modules/<id>/index.js`.
  Isolated worker. The only source that can be installed/deleted.

`collectDescriptors()` returns built-ins first so they register at base open-handler
priority before community overrides.

---

## Lifecycle (all hot — no restart)

```text
init()      discover all → activate enabled, probe disabled → one ManagedModule each
enable(id)  remove from config.disabled, save, descriptor.activate() → live host
disable(id) ModuleRegistry.unregister(id) (tears the worker down), add to disabled, save
install(r)  install_module writes ~/.mutka/modules/<id>/index.js → activate → record meta
uninstall(id) unregister + uninstall_module removes the dir + drop from config
```

`init()` resolves once every enabled module is registered — that's what gates
`app:ready` (same contract the old `moduleLoader` had). The UI subscribes via
`ModuleManager.subscribe` (see `hooks/useModules.ts`).

Built-in/dev modules can be toggled but **not deleted** (they ship in the bundle).
Community modules can be deleted from disk.

---

## Discovery (pluggable sources; GitHub today)

Discovery is a **registry of sources**, not a hardwired catalog. The seam is
`ModuleDiscoverySource` (in `types.ts`):

```ts
interface ModuleDiscoverySource {
  id: string; label: string;
  discover(query: DiscoveryQuery): Promise<DiscoveryResult>; // { listings, nextPage? }
  fetchSource(ref: string): Promise<string>;                 // the ESM source for a listing
}
```

`DiscoveryRegistry` (singleton) holds the sources. `githubSource` is the built-in
one; a future source (GitLab, a local folder, a private registry — even shipped as
a module) registers the same shape and the manager + UI don't change. The registry
only **finds + fetches**; the core still owns **load / install / unload**.

- **`discover(query)`** returns one page of `ModuleListing`s (metadata only: name,
  version, icon, author, permissions, tags). `DiscoveryQuery` carries text +
  filters (`permissions`, `tags`) + **pagination** (`page`, `perPage`). The
  registry aggregates across sources and applies any filters a source didn't.
- **`resolve(listing)`** calls the owning source's `fetchSource(ref)` to get the
  **source as a string**, then **validates it in a throwaway worker**
  (`probeManifest`). The returned `ResolvedModule` (listing + source + probed
  manifest) is what the install dialog shows and `ModuleManager.install` consumes.
- The **download is the source's job**: `fetchSource` returns bytes-as-text, so
  HTTP, a local folder (`fs:read`), or an authed API all work — the core never
  knows the transport. It can only trust what the probe + gateway allow.

`ModuleListing.permissions` are **advisory** (for filtering/preview); the
authoritative set comes from the manifest probed at install time.

### The GitHub source

`githubSource` searches repos named `mutka-module-*`. A repo ships **either** a bare
`index.js` at its root, **or** a `mutka.config.json` listing entry path(s) — one
repo may carry several modules, each surfaced as its own listing:

```json
{ "projects": ["sql/index.js", "webdav/index.js"] }
```

(The legacy `{ "modules": [{ "entry": "…" }] }` form is still accepted.) It
downloads + probes each entry to read its manifest metadata (`name` / `icon` /
`author` / `tags` from `defineModule`), caching the source so `fetchSource` is
instant at install. `author.github` defaults to the repo owner via `authorInfo.ts`.

---

## Security

Community code is untrusted. Before an install is written, the **install review
dialog** (`components/ModulesPanel/InstallReviewDialog.tsx`) shows every permission
the module requests, with dangerous ones (`fs:write`, `network`, `secrets`,
`clipboard:write`, `shell`) explicitly flagged (`permissionInfo.ts`). Permissions
are still enforced at runtime by the gateway regardless — the dialog is informed
consent, not the enforcement boundary.

Disk writes are confined to `~/.mutka/` by the Rust commands (`install_module`,
`uninstall_module`, `read_module_config`, `write_module_config` in `modules.rs`).

---

## Adding a new discovery source

1. Implement `ModuleDiscoverySource` (`id`, `label`, `discover`, `fetchSource`) in
   a new file here. `discover` returns metadata pages; `fetchSource(ref)` returns
   the module's ESM as a string (however that source fetches — HTTP, disk, API).
2. `DiscoveryRegistry.register(yourSource)` (today `githubSource` is registered in
   its constructor). The registry validates every fetched source with
   `probeManifest` in `resolve()`, so a source can't smuggle in unvalidated code.
3. Nothing in `ModuleManager` or the UI changes — Browse queries the registry.

A source can even ship **as a module** later (declare it, serve `discover`/
`fetchSource` over worker RPC like `fileSystemProviders`) — not wired yet.
