---
bump: minor
---

Require `fs:read` to receive the `file:external-drop` event. Subscribing to a
whitelisted event needs no permission, but `file:external-drop`'s payload is the
actual **bytes** of files the user dragged in from Finder — so a module with no `fs`
permission could harvest dropped-file contents just by listening to the bus (and
exfiltrate them with `network:public`), bypassing the `fs:read` gate. Event delivery
is now permission-gated (`EVENT_REQUIRED_PERMISSION` in `eventWhitelist.ts`, enforced
in both `LocalHost` and `SandboxHost`): without the required permission the
subscription is dropped, like a non-whitelisted event. `core.drop-import` already
holds `fs:read`, so file drops keep working.
