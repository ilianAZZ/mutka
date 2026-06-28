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
| `types.ts`           | `ManagedModule`, `ModuleDescriptor`, `ModuleConfig`, `InstalledMeta`. Re-exports the discovery types, which now live in `core/discovery/types.ts`. |
| `ModuleManager.ts`   | The singleton lifecycle owner: `init`, `getAll`, `subscribe`, `enable`, `disable`, `install`, `uninstall`.     |
| `descriptors.ts`     | Builds `ModuleDescriptor`s from the three sources (built-in glob, dev glob, community `invoke`). Owns the globs. |
| `moduleConfig.ts`    | Loads/saves `~/.mutka/config.json` (disabled set + install metadata) via the Rust config commands.             |
| `probeManifest.ts`   | Re-export of `core/sandbox/probeManifest` (it now also backs the `modules.probe` capability).                  |
| `DiscoveryRegistry.ts` | Re-export of `core/discovery/DiscoveryRegistry` (sources are contributed by module runtimes, so it lives in core). |
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

Discovery sources are **contributed by modules** — there is no hardwired catalog,
and adding one means **installing a module, not editing the app**. A module
declares sources and serves them through `host` (the `fileSystemProviders` pattern):

```ts
defineModule({
  permissions: ["network:public", "discovery"],
  discoverySources: [{ id: "github", label: "GitHub" }],
  setup(host) {
    host.onDiscover("github", async (query) => ({ listings, nextPage })); // metadata page
    host.onFetchSource("github", async (ref) => "/* index.js source */"); // the ESM as text
  },
});
```

`core/discovery/DiscoveryRegistry` (re-exported here) holds the live sources. When
a module with `discoverySources` loads, its runtime (`LocalHost`/`SandboxHost`)
registers each source — backed by the module via direct call (built-in) or worker
RPC (community) — and unregisters on unload. The registry only **finds + fetches**;
the core still owns **load / install / unload**.

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
- A discovery module can't probe (no nested worker); it reads listing metadata via
  the **`host.modules.probe(source)`** capability (gated by the `discovery`
  permission), which runs `probeManifest` in the host and returns the manifest.

`ModuleListing.permissions` are **advisory** (for filtering/preview); the
authoritative set comes from the manifest probed at install time.

### The GitHub source — a built-in module

`sandbox-builtins/github-discovery.ts` is the built-in discovery source, written as
a **module** (public `host` API only — `net` + `modules.probe`). It searches repos
named `mutka-module-*`. A repo ships **either** a `mutka.config.json` listing entry
path(s) — one repo may carry several modules, each surfaced as its own listing — **or**,
with no config, a bare `index.js` at its root **or** `dist/index.js` (where a TypeScript
module's build lands; a repo with both is de-duped by module id):

```json
{ "projects": ["sql/index.js", "webdav/index.js"] }
```

(The legacy `{ "modules": [{ "entry": "…" }] }` form is still accepted.) It probes
each entry (via `host.modules.probe`) to read its manifest metadata (`name` /
`icon` / `author` / `tags`), caching the source so `fetchSource` is instant at
install. `author.github` defaults to the repo owner. Disabling this module disables
GitHub discovery — discovery genuinely *is* a module.

---

## Security

Community code is untrusted. Before an install is written, the **install review
dialog** (`components/ModulesPanel/InstallReviewDialog.tsx`) shows every permission
the module requests, with dangerous ones (`fs:write`, `network:public`,
`network:local`, `secrets`, `clipboard:write`, `discovery`, `shell`) explicitly
flagged (`permissionInfo.ts`). Permissions
are still enforced at runtime by the gateway regardless — the dialog is informed
consent, not the enforcement boundary.

Disk writes are confined to `~/.mutka/` by the Rust commands (`install_module`,
`uninstall_module`, `read_module_config`, `write_module_config` in `modules.rs`).

---

## Adding a new discovery source — write a module (no core edits)

1. Write a module (built-in or community) that declares
   `discoverySources: [{ id, label }]` and `permissions: ["discovery", …]`.
2. In `setup`, register `host.onDiscover(id, …)` (return `{ listings, nextPage? }`)
   and `host.onFetchSource(id, …)` (return the ESM as a string). Use whatever the
   source needs to fetch — `host.net` for HTTP, `host.fs` for a local folder — and
   `host.modules.probe(source)` to read manifest metadata for the listings.
3. That's it. Its runtime registers the source with `DiscoveryRegistry` on load;
   the registry validates every fetched source with `probeManifest` before install,
   so a source can't smuggle in unvalidated code. `ModuleManager` and the UI don't
   change. This is how GitLab / a private registry would ship — as a module.

A source can even ship **as a module** later (declare it, serve `discover`/
`fetchSource` over worker RPC like `fileSystemProviders`) — not wired yet.
