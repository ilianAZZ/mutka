---
bump: major
---

Harden the `network` capability so one command has one role and one permission.
`host.net.download` and `host.net.upload` are removed — they secretly wrote and
read the filesystem under the `network` permission alone (a module granted only
`network` could exfiltrate any file via `upload`, or write anywhere via a
`../`-traversing `download` filename). The `net` surface is now a single pure
primitive, `host.net.request({ url, method?, headers?, body? })`, that sends a
request and returns `{ status, headers, body, bytes }` — it never touches disk.

To upload, a module now reads bytes via `host.fs.readBytes` (the `fs:read`
permission) and passes them as `body`; to save a response it writes `bytes` via
`host.fs.*` or `host.sys.writeTempFile` (`fs:temp`). `writeTempFile` now accepts
a `Uint8Array` as well as a base64 string, and Rust confines the write to the
temp dir by stripping any path components from the filename (fixes the
`write_temp_file` path-traversal). The example WebDAV dev-module is migrated to
the new shape.
