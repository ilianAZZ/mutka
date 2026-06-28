---
bump: minor
---

Give module authors real TypeScript types. Every `host` method is now precisely
typed instead of returning `Promise<unknown>` (`host.fs.readDir` → `FileItem[]`,
`host.fs.readBytes` → `Uint8Array`, `host.dialog.confirm` → `boolean`,
`host.board.readFiles` → `ClipboardFiles | null`, `host.sys.appsForFile` →
`AppInfo[]`, `host.net.request` → `NetResponse`, mutations → `void`, …), so authors
no longer cast results. Backward-compatible: existing casts still compile. Two new
exported result types, `ClipboardFiles` and `CloudStatus`.

Ships two npm packages for authoring modules outside this repo (in `packages/`,
published in lockstep with the app on each release tag):

- **`@mutka-explorer/module`** — the author-facing types only (no runtime code),
  generated from `src/core/sandbox` so they can't drift. `import type` it for a fully
  typed `host`, `defineModule` shape, permissions, `when` clauses, `UINode`, and
  `FormSchema`.
- **`@mutka-explorer/create`** — the `npm create @mutka-explorer` scaffolder that
  generates a typed TS module project (a working `src/index.ts`, a `tsup` build to one
  self-contained ESM file, and the GitHub-discovery layout).
