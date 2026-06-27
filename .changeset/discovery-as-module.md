---
bump: minor
---

Module discovery is now itself a module. A module can declare `discoverySources: [{ id, label }]` and serve them with `host.onDiscover` / `host.onFetchSource` (over worker RPC, like `fileSystemProviders`), backed by the new `discovery` permission and a `host.modules.probe(source)` capability for reading listing metadata. GitHub discovery ships as exactly such a built-in module (`sandbox-builtins/github-discovery.ts`) — so adding a GitLab / local-folder / private-registry source means installing a module, with no edits to the app core. The `DiscoveryRegistry` (now in `core/discovery`) collects sources contributed by module runtimes and is what the Browse tab queries.
