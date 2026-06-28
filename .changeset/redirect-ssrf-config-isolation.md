---
bump: minor
---

Three follow-up isolation fixes found auditing the new network/permission code:

- **Redirect SSRF bypass.** The HTTP client auto-followed redirects, but only the
  original URL was tier-checked — so a `network:public` request could be `302`-bounced
  to `169.254.169.254`/a LAN host. The agent now uses `redirects(0)`: a 3xx is returned
  to the module as-is, never followed, so the only URL fetched is the one the module
  asked for (and tier-checked). A module that wants to follow a redirect re-requests
  the `Location`, which is validated again. (Behavior change: `host.net` no longer
  auto-follows redirects.) Also tightened the tiers: `network:local` is **private** IP
  ranges + `localhost` only, and a **public IP literal** (or plaintext http to a public
  domain) is refused by both — public access must be an https domain.
- **Config namespace collision.** `host.config` keys were `mutka.modcfg.<id>.<key>`;
  since ids can contain dots, module `com` (key `acme.vault.x`) collided with module
  `com.acme.vault` (key `x`). The id↔key delimiter is now `:`, which ids can't
  contain, restoring per-module config isolation. (Existing module config keys reset.)
- **`read_module_file` confinement.** Replaced the string-prefix check (which accepted
  `~/.mutka/modules-evil/…` and didn't collapse `..`) with a canonicalized,
  component-wise `starts_with` against the modules dir.
