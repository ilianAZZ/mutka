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
| `types.ts`           | `ManagedModule`, `ModuleDescriptor`, `ModuleConfig`, `InstalledMeta`, and the `CatalogSource` interface.       |
| `ModuleManager.ts`   | The singleton lifecycle owner: `init`, `getAll`, `subscribe`, `enable`, `disable`, `install`, `uninstall`.     |
| `descriptors.ts`     | Builds `ModuleDescriptor`s from the three sources (built-in glob, dev glob, community `invoke`). Owns the globs. |
| `moduleConfig.ts`    | Loads/saves `~/.mutka/config.json` (disabled set + install metadata) via the Rust config commands.             |
| `probeManifest.ts`   | Loads a module's source in a THROWAWAY worker → its manifest, or throws. Used for validation + disabled metadata. |
| `githubCatalog.ts`   | The `CatalogSource` implementation: searches GitHub for `mutka-module-*` repos and resolves+validates them.     |
| `installModule.ts`   | Writes a validated module to disk via the Rust `install_module` command; returns its `InstalledMeta`.          |
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

## The catalog (GitHub today, a DB tomorrow)

`CatalogSource` (in `types.ts`) is the seam. `githubCatalog` implements it against
the GitHub search API; a future source (a DB of GitHub links, a private registry)
implements the same `search` / `resolve` shape and the manager + UI don't change.

A repo ships **either** a bare `index.js` at its root, **or** a `mutka.config.json`
listing entry path(s) — one repo may carry several modules:

```json
{ "modules": [ { "entry": "dist/index.js" }, { "entry": "second/index.js" } ] }
```

`resolve()` downloads each entry and **validates it by loading it in a throwaway
worker** (`probeManifest`) — a module that doesn't load is rejected, never installed.
The authoritative module id comes from the probed manifest (the install folder is
named after it).

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

## Adding a new catalog source

1. Implement `CatalogSource` (`search`, `resolve`) in a new file here.
2. `resolve` MUST validate each module with `probeManifest` before returning it.
3. Swap it in where `githubCatalog` is imported (today: `ModulesPanel`,
   `BrowseCatalog`). Nothing in `ModuleManager` needs to change.
