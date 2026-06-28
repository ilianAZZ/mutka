---
bump: patch
---

Set `app.withGlobalTauri: false`. It injected `window.__TAURI__` (a ready-to-use
`invoke`) into the page; nothing in the app uses it (we import from
`@tauri-apps/api`, which goes through `__TAURI_INTERNALS__`), so it was pure attack
surface — any script injected into the main realm got the full backend for free.
Disabling it complements the CSP: fewer ambient handles to the Rust commands.
