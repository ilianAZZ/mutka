---
bump: minor
---

Module discovery is now a pluggable registry of sources, not a hardwired GitHub catalog. A `ModuleDiscoverySource` implements `discover(query)` (metadata + filters + pagination) and `fetchSource(ref)` (returns the ESM as text), so a future GitLab / local-folder / private-registry source — even one shipped as a module — drops in without touching the core or UI. The core still owns load/install/unload: it validates every fetched source in a throwaway worker before writing it. Browse adds permission filters, pagination ("Load more"), per-result source labels, an inline source viewer in the install review, and a `tags` field on modules.
