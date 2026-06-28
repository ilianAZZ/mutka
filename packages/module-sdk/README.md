# @mutka-explorer/module

Types + the `defineModule()` helper for authoring [Mutka](https://github.com/ilianAZZ/mutka) modules.

A Mutka module is a single self-contained ESM file that
`export default`s a module definition. It reaches the system only through the
`host` object passed to `setup(host)`, and every `host.*` call is checked against
the permissions it declares.

This package is **types plus one tiny runtime export**: `defineModule`, an identity
function (`def => def`). Everything else is types, erased at compile time. The only
reason `defineModule` exists at runtime is type inference — it captures your
`commands[].id`s so `host.onCommand` only accepts ids you declared (a typo or stale
id is a compile error). A bundler inlines the call, so your built `index.js` stays
import-free — exactly what Mutka loads.

## Install

```bash
npm i -D @mutka-explorer/module
```

## Usage

```ts
import { defineModule } from "@mutka-explorer/module";

export default defineModule({
  id: "you.hello",
  name: "Hello",
  version: "1.0.0",
  permissions: ["fs:read"],
  commands: [
    { id: "you.hello.count", label: "Count items", contextMenu: true, when: { selection: "any" } },
  ],
  setup(host) {
    host.onCommand("you.hello.count", async (snap) => {   // ✓ autocompleted from commands[]
      const items = await host.fs.readDir(snap.currentDirectory);
      host.log(`${items.length} items`);
    });
    // host.onCommand("you.hello.typo", …)   ← compile error: not a declared command id
  },
});
```

`host` is fully typed (`host.fs`, `host.ui`, `host.net`, `host.dialog`, …), as
are permissions, `when` clauses, the declarative `UINode` tree, and `FormSchema`.

> Prefer no runtime import at all? `import type { SandboxModuleDef } from
> "@mutka-explorer/module"` and annotate `const mod: SandboxModuleDef<"you.hello.count">
> = { … }` — the generic param enforces the same command-id matching, purely in types.

### Build to a single file

Mutka loads one ESM file with the default export intact. Bundle your TypeScript
(and any pure-JS dependencies) down to one `index.js`, e.g. with
[tsup](https://tsup.egoist.dev/):

```bash
tsup src/index.ts --format esm --bundle
```

> The module runs in a Web Worker with **no DOM and no native network**
> (`fetch`/`XMLHttpRequest`/`WebSocket` are blocked). Use `host.net` for HTTP.
> Pure-logic libraries bundle fine; DOM- or network-dependent ones do not.

## What's exported

Types only: `SandboxModuleDef`, `SandboxHostApi` (the `host`), `ModulePermission`,
`SandboxCommand`, `SandboxOpenHandler`, `WhenClause`, `UINode`, `FormSchema`,
`FileItem`, `HostSnapshot`, the contribution shapes (panels, columns, status-bar,
file icons, discovery sources), and their supporting types.

## Versioning

The package version tracks the Mutka app release it was generated from, so the
types always match a shipped host API. See the app's `docs/` for the full module
architecture.
