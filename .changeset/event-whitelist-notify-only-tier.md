---
bump: minor
---

Widen the event whitelist a sandboxed module may subscribe to, in two tiers. Modules can now subscribe to the trivial, non-path signals with their payload (`navigation:back`/`forward`, `theme:changed`, `view:changed`, `settings:changed`, `modules-ui:changed`, `sidebar:changed`, `module:registered`/`unregistered`, `columns:cell-resolved`/`widths-changed`). A new `NOTIFY_ONLY_EVENTS` tier forwards `clipboard:changed`, `tabs:changed`, and `action:dispatch` as a bare ping with the payload stripped to `undefined` — the occurrence is useful but the full payload is profiling-grade, so a module that needs the data re-fetches it through a permission-gated capability (e.g. `board.readFiles` needs `clipboard:read`). Host-internal events (`ui:changed`, `statusbar:changed`, `error:action`) remain unreachable. Also adds a `com.event-monitor` dev module that live-streams every subscribable event to a side panel and the console.
