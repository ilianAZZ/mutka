---
bump: minor
---

Type-check command ids against `host.onCommand`. `defineModule` is now generic and
infers the union of `commands[].id` literals, threading it into the `host` passed to
`setup` so `host.onCommand` only accepts an id you declared — a typo'd or stale command
id is a compile error, with autocomplete. `SandboxModuleDef`, `SandboxHostApi`, and
`SandboxCommand` gained an optional command-id type parameter (defaulting to `string`,
so existing code is unaffected); built-in modules get the same checking for free.

The `@mutka-explorer/module` package now ships one tiny runtime export — `defineModule`,
an identity function (`def => def`) — alongside the types, so the inference works at the
call site. A bundler inlines it, so an authored module's built file stays import-free.
Authors who want no runtime import can still annotate `SandboxModuleDef<"the.command.id">`
for the same matching. The scaffolder template now uses `defineModule({…})`.
