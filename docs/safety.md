# Mutka — Safety & Security Model

> Keep this document in sync whenever you change the module runtime, the gateway,
> the permission set, the capability table, the secret/config namespacing, or the
> install/validation path. These are the security contracts — stale docs here are
> worse than none.

This page explains **why running an untrusted community module can't compromise the
user**. The short version: a community module runs as isolated worker code that
can't touch the system directly, every privileged call is permission-checked on
the way out, and each module's stored data (secrets, config) is namespaced to its
own id. The rest is detail.

---

## Threat model

A **community module is untrusted code.** It is a plain ESM file downloaded from
GitHub and run on the user's machine. We assume the author may be hostile and the
code may try to read other modules' data, reach the filesystem it wasn't granted,
exfiltrate data, or escape its sandbox. The defenses below are designed against
that assumption.

Built-in modules (`src/sandbox-builtins/`) are **trusted** — they ship in the repo
and run in-process. They are still gated by the same permission barrier (defense in
depth), but isolation buys nothing for code we wrote, so they skip the worker.

---

## Layer 1 — Worker isolation (no direct backend access)

A community module runs inside a **Web Worker** (`core/sandbox/sandbox.worker.ts`,
hosted by `core/sandbox/SandboxHost.ts`). Inside that worker the module has:

- **no DOM** — no `document`, no `window`, no access to the React app or its state;
- **no `invoke`** — the Tauri IPC bridge to the Rust backend simply isn't present in
  the worker realm, so the module **cannot call a Rust command directly**;
- **no reference to the core** — it's imported from a `blob:` URL as an opaque ESM
  module; it never imports anything from `src/core`.

The only thing the worker can do to affect the outside world is `postMessage` a
**host-call** (`{ t: "host-call", cap, method, args }`) and wait for a reply. There
is no other channel. A denied capability isn't just refused — it is **physically
unreachable**, because the code that performs it (`invoke`, `AppBridge`,
`TabManager`) lives on the other side of the worker boundary.

**No native network.** A module must NOT make its own network calls — not `fetch`,
`XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`, WebRTC, a
nested `Worker`, nor a remote dynamic `import()`. CORS does not make these safe: it
blocks *reading* a cross-origin reply, not *sending* the request, so a raw `fetch`
to an attacker's URL would be an **ungated exfiltration channel** that defeats the
network permissions. The only sanctioned egress is `host.net.*` (gated by
`network:public` / `network:local`, executed in Rust). This is enforced **at the engine level by the app
Content-Security-Policy** (`src-tauri/tauri.conf.json`), not by deleting JS globals
(a denylist of API names would be fragile and incomplete): `connect-src` is
restricted to the Tauri IPC bridge, so no other host is reachable, and `script-src`
forbids remote origins, so a remote `import()` can't load code. WebKit applies that
policy below JavaScript — in the worker realm too — so no `eval` / `Function` /
string trick can get around it. The same CSP also confines the main (trusted)
realm.

`host.net` itself is split into two permission tiers, enforced in Rust
(`src-tauri/src/http.rs`, `check_url_allowed`) by classifying the request URL:

- **`network:public`** — HTTPS to a **public domain** only (a host with a dot and a
  real TLD). **https is enforced**: a public request may never go over plaintext
  http, so credentials and user data can't be read or tampered with in transit.
  IP addresses, `localhost`, and bare hostnames are refused, which blocks SSRF to
  the cloud metadata endpoint (`169.254.169.254`), loopback services, and the LAN.
- **`network:local`** — http or https to a **private IP range** (RFC1918 / loopback /
  link-local / CGNAT / IPv6 ULA) or **`localhost`** only (e.g. a self-hosted server or
  NAS). A module that needs both internet and LAN access declares both tiers; the
  install dialog flags each as sensitive.

A **public IP literal** (e.g. `https://8.8.8.8`) and **plaintext http to a public
domain** are refused by *both* tiers: public access must go through an https domain,
local access through a private IP / localhost.

`network:local` is the **broader-trust** tier: beyond a NAS/self-hosted server it can
reach routers, admin panels, and internal services, and via a forwarding proxy on the
LAN it can reach the internet too — so it is effectively a superset of `network:public`'s
reach and should be granted more cautiously. Conversely `network:public` **cannot** reach
a private network at all, with the single exception of DNS rebinding (below).

Redirects are **not** followed: the HTTP agent is built with `redirects(0)`, so a 3xx
is returned to the module as-is rather than fetched. Auto-following would reach a
redirect target that was never tier-checked (the classic `network:public` →
private/metadata SSRF bounce). A module that wants to follow a redirect re-requests
the `Location` itself — which goes through `check_url_allowed` again.

> Built-in modules run in-process via `LocalHost` and *do* share the realm, which is
> exactly why only first-party code is allowed to. The module source is identical
> either way; only the transport differs.

---

## Layer 2 — The gateway (permissions checked on *every* backend call)

Every host-call — from a worker module or a built-in — funnels through one function,
`dispatchCapability` in [gateway.ts](../src/core/sandbox/gateway.ts):

```ts
const def = capabilities[cap]?.[method];
if (!def) throw new Error(`Unknown capability "${cap}.${method}"`);
if (!manifest.permissions.includes(def.permission))
  throw new Error(`Permission denied: requires "${def.permission}"…`);
return def.run(args, manifest.id);
```

Three guarantees fall out of this:

1. **The check is per-call, not per-session.** There is no "unlock once" — every
   single `host.fs.readDir`, `host.net.request`, `host.secrets.get` re-checks the
   manifest. A module can't escalate after load.
2. **The capability table is the whole vocabulary.** `capabilities.ts` (and the
   `core/file-system/FileSystemRegistry.ts` it delegates fs routing to, reached only
   through the gateway) are the *only* files that call `invoke` / `AppBridge` /
   `TabManager`. If an operation isn't listed there, **no module can perform it** —
   there is no escape hatch to add one at runtime.
3. **Permissions are declared up front and can't be forged.** A module lists its
   `permissions` in its manifest; the worker reports that manifest *before* `setup`
   runs (so the host knows the permission set before serving any call). The module
   can't widen it later — the host holds the authoritative copy.

---

## Layer 3 — Informed consent at install

Permissions are declared, so the user sees them **before** the module is enabled.
The install review dialog (`components/ModulesPanel/InstallReviewDialog.tsx`) lists
every requested permission with a human label, and the **sensitive ones are flagged**
(`module-manager/permissionInfo.ts` → `dangerous: true`): `fs:write` (can delete),
`clipboard:write`, `network:public` / `network:local` (can send data off the machine), `secrets`, `discovery`, `shell`.
Nothing is granted silently.

---

## Layer 4 — Per-module data isolation (secrets & config)

This is the answer to *"if two modules both hold the `secrets` permission, can one
read the other's secrets?"* — **No.**

Secrets are namespaced by the module's id, and **the module never chooses the
namespace.** When a module calls `host.secrets.get(key)` it passes only the *account*
(key) and *value* — never the keychain *service*. The gateway injects the module's
own id (`def.run(args, manifest.id)`), and the capability derives the service from
it ([capabilities.ts](../src/core/sandbox/capabilities.ts)):

```ts
secretService = (moduleId) => `mutka.${moduleId}`;
secrets.get = { permission: "secrets",
  run: ([key], moduleId) => invoke("secret_get", { service: secretService(moduleId), account: key }) };
```

So module `A`'s calls always resolve to keychain service `mutka.<A's id>`. There is
**no parameter `A` can set to reach `mutka.<B's id>`** — the Rust side
(`secrets.rs`) is a blind passthrough to the Keychain; it trusts the service name the
gateway computed. The `secrets` permission is a key to *your own* drawer, not a master
key.

The **only** way two modules could share a secret namespace is if they had the
**same module id** — and that can't happen for two installed modules, because a module
is installed at `~/.mutka/modules/<id>/` (one directory per id). Installing a second
module that declares an existing id collides with / overwrites the first rather than
coexisting beside it and reading its drawer. So the boundary is exactly as strong as
**id uniqueness**, which the single-directory-per-id install enforces.

The same namespacing protects module config: `host.config.*` keys are stored under
`mutka.modcfg.<moduleId>:<key>` with the id injected the same way — one module can't
read another's stored config either. The id↔key delimiter is `:`, not `.`, on
purpose: a module id may contain dots (`com.acme.vault`), so a `.` here would let
module `com` reach `com.acme.vault`'s keys via key `acme.vault.<k>` (the joined
strings would match). `:` can't appear in an id, so the id segment is unambiguous.

---

## Layer 5 — Filesystem confinement of module code

Module *code* can only ever live in one place. The Rust commands that read and write
modules (`src-tauri/src/modules.rs`) are hard-confined to `~/.mutka/modules/`:

- `read_module_file` rejects any path that doesn't start with the modules dir — a
  module file can't be loaded from elsewhere on disk.
- `install_module` / `uninstall_module` validate the id with `is_safe_id`: non-empty,
  no leading dot, no path separators, no `..`, only `[A-Za-z0-9._-]`, ≤ 200 chars.
  This is what prevents a malicious id like `../../etc` from escaping the modules
  directory, and it's the same check that makes the id usable as the secret namespace.

(Note this confines where module *code* lives. A granted `fs:read` / `fs:write`
capability still operates on real paths the user navigates to — see Residual risks.)

---

## Layer 6 — Event whitelist

A module can subscribe to app events via `host.events.on(...)`, but only to the
**whitelisted** set in `core/sandbox/eventWhitelist.ts`, and that set has two tiers (no
event carries a credential — the gate is privacy, not secrecy):

- **`SUBSCRIBABLE_EVENTS`** are delivered with their payload — trivial signals
  (`app:ready`, `theme:changed`, …) or the single path/items a module legitimately acts
  on (`selection:changed`, `directory:changed`, the mouse/open events, …).
- **`NOTIFY_ONLY_EVENTS`** (`clipboard:changed`, `tabs:changed`) are
  delivered as a bare ping with the payload stripped to `undefined` (via
  `deliverablePayload`): the occurrence is useful but the full payload would be
  profiling-grade. A module that needs the data re-fetches it through a
  permission-gated capability (e.g. `board.readFiles` needs `clipboard:read`).

A handful of whitelisted events also require a **permission to receive**
(`EVENT_REQUIRED_PERMISSION`), because their payload is the data itself rather than a
signal. `file:external-drop` carries the **bytes** of files the user dragged in from
Finder, so a subscriber must hold **`fs:read`** — the same gate that reading those
bytes through `fs.readBytes` would require. Without it the subscription is dropped, so
a module can't harvest dropped-file contents by listening to the bus instead of asking
for `fs:read`. (`core.drop-import` holds `fs:read`, so it still receives the drop.)

A subscription to anything else is dropped with a warning. Host-internal events that
would leak other modules' state (e.g. `ui:changed`) or arbitrary internals
(`error:action`) are on **neither** list, so a module can't passively snoop on the rest
of the app through the event bus.

---

## Residual risks (what this model does *not* protect against)

Be honest about the edges:

- **Granted permissions are real.** If the user approves `network:public`, the
  module can send data to any public website; if they approve `fs:write`, it can
  delete files. The defense is consent + the dangerous-permission flag, not a
  technical block. Review what you install.
- **DNS rebinding against `network:public`.** The public/local tier check
  classifies the URL by its **hostname**, not the IP it resolves to. A public
  domain that an attacker points at a private address (`10.x`, `127.0.0.1`, the
  metadata IP) would pass the `network:public` check and then connect to the
  internal host. We deliberately do **not** pin the resolved IP (it would mean a
  custom resolver/connector in `ureq`); a module that truly needs LAN access is
  expected to hold `network:local` instead. Treat `network:public` as "can reach
  the internet," not "provably cannot reach your LAN."
- **`fs:read` can launch applications.** `host.fs.openItem` and `host.sys.openWith`
  open a path with macOS Launch Services, so a module with `fs:read` can *launch* an
  app or a `.app` bundle (not just read bytes) — i.e. `fs:read` carries a
  code-execution edge, not only data access. Paths are passed as process arguments
  (no shell), so there's no command injection, but treat `fs:read` as "can read files
  **and** open them with the system" when reviewing a module.
- **No per-path filesystem scoping (yet).** `fs:read` / `fs:write` apply to any path
  the module is handed or the user navigates to — there's no "this module may only
  touch `~/Downloads`." A future capability could narrow this.
- **Id authenticity rests on the install path.** The secret/config boundary assumes
  ids are unique, which the single-directory-per-id layout guarantees *locally*.
  There is no cryptographic signing of authorship — a module republished under a
  *different* id is simply a different module with its own (empty) secret drawer; it
  can't read the original's.
- **Worker isolation is the browser's.** We rely on the WebView's Worker boundary
  (no DOM/IPC reachable from a worker). A WebView sandbox-escape vulnerability would
  undercut Layer 1 — kept current via Tauri/OS updates.

---

## Where each guarantee lives (quick map)

| Guarantee | Enforced in |
| --- | --- |
| No direct backend access from community code | `sandbox.worker.ts`, `SandboxHost.ts` (worker boundary) |
| Permission checked on every call | `gateway.ts` → `dispatchCapability` |
| Fixed set of possible operations | `capabilities.ts` (+ its `FileSystemRegistry` fs-routing helper) — the only callers of `invoke`/`AppBridge`/`TabManager` |
| Secrets/config scoped per module | `capabilities.ts` (`secretService` / `cfgKey`, id from gateway) |
| Keychain passthrough trusts the gateway's service name | `src-tauri/src/secrets.rs` |
| Module code can't load/write outside `~/.mutka/modules` | `src-tauri/src/modules.rs` (`is_safe_id`, path check) |
| Informed consent + danger flags | `InstallReviewDialog.tsx`, `permissionInfo.ts` |
| Only whitelisted events reach a module | `eventWhitelist.ts` |

See also [architecture.md](./architecture.md) for the runtime overview and the
capability ↔ permission table.
