---
bump: minor
---

Close the module network-exfiltration gap. A community module runs in a Web
Worker, which ambiently has `fetch`/`XMLHttpRequest`/`WebSocket`/etc.; CORS does
not stop those (it blocks reading a cross-origin reply, not sending the request),
so a module could send data anywhere with no `network` permission. Enforce a
Content-Security-Policy whose `connect-src` is restricted to the Tauri IPC bridge
and whose `script-src` forbids remote origins, so the only network egress from the
WebView (main realm and worker realm alike) is `invoke → Rust`, i.e. the gated
`host.net`. WebKit applies this below JavaScript, so no `eval`/`Function`/string
trick can bypass it — a denylist of API names would be fragile, this is not.

Adds `app.security.csp` + `devCsp` in `tauri.conf.json` and mirrors the dev policy
as a Vite dev-server header (Tauri's CSP doesn't cover the dev origin). Documents
the "no native network — use `host.net`" rule in the worker and in
`docs/safety.md`.
