# @mutka-explorer/module

TypeScript types for authoring [Mutka](https://github.com/ilianAZZ/mutka) modules.

A Mutka module is a single self-contained ESM file that
`export default`s a module definition. It **imports nothing at runtime** — it
reaches the system only through the `host` object passed to `setup(host)`, and
every `host.*` call is checked against the permissions it declares.

This package ships **only type definitions** (`.d.ts`, zero runtime code). You
`import type` from it, TypeScript erases the import at compile time, and your
built `index.js` stays self-contained — exactly what Mutka loads.

## Install

```bash
npm i -D @mutka-explorer/module
```

## Usage

```ts
import type { SandboxModuleDef } from "@mutka-explorer/module";

const mod: SandboxModuleDef = {
  id: "you.hello",
  name: "Hello",
  version: "1.0.0",
  permissions: ["fs:read"],
  commands: [
    { id: "you.hello.count", label: "Count items", contextMenu: true, when: { selection: "any" } },
  ],
  setup(host) {
    host.onCommand("you.hello.count", async (snap) => {
      const items = await host.fs.readDir(snap.currentDirectory);
      host.log(`${items.length} items`);
    });
  },
};

export default mod;
```

`host` is fully typed (`host.fs`, `host.ui`, `host.net`, `host.dialog`, …), as
are permissions, `when` clauses, the declarative `UINode` tree, and `FormSchema`.

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
