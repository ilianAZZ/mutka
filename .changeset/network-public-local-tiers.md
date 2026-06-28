---
bump: major
---

Split the single `network` permission into two least-privilege tiers, enforced in
Rust by classifying the request URL (`http.rs` → `check_url_allowed`):

- **`network:public`** — HTTPS to a **public domain** only (host with a dot + a
  real TLD). **https is enforced** so a public request can't leak credentials/data
  over plaintext. IP addresses, `localhost`, and bare hostnames are refused, which
  blocks SSRF to the cloud metadata endpoint, loopback services, and the LAN.
- **`network:local`** — http or https to an **IP address or `localhost`** only
  (self-hosted server / NAS). A module needing both declares both; each is flagged
  sensitive at install.

`host.net.request` now requires *either* tier (the gateway gained `anyOf`
permission support), and `capabilities.ts` passes Rust which tiers the module
holds, computed from its authoritative manifest so a worker can't widen them.
`github-discovery` → `network:public`; the example WebDAV module → both. Removes
the old `network` permission (breaking). Residual: the check is by hostname, not
resolved IP, so DNS rebinding against `network:public` is out of scope — see
docs/safety.md.
