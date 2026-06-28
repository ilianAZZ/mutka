# packages/ — Published npm tooling for module authors

These are the **public npm packages a community module author installs**. They are
NOT part of the app bundle — the app never imports them. They exist so people
outside this repo can build modules in typed TypeScript instead of hand-written JS.

Both publish to npm on each `vX.Y.Z` release tag (jobs `publish-sdk` /
`publish-create` in `.github/workflows/release.yml`), **versioned in lockstep with
the app**. Publishing needs the `NPM_TOKEN` repo secret and the `mutka-explorer` npm
org. See `docs/releasing.md`.

| Package                   | npm name                  | What it is                                                            |
| ------------------------- | ------------------------- | -------------------------------------------------------------------- |
| `module-sdk/`             | `@mutka-explorer/module`  | Author-facing TS **types only** (no runtime code).                   |
| `create-module/`          | `@mutka-explorer/create`  | The `npm create @mutka-explorer` **scaffolder** (plain ESM, no deps). |

---

## `module-sdk/` — `@mutka-explorer/module`

Ships a single self-contained `index.d.ts` (zero runtime code). Authors
`import type { SandboxModuleDef } from "@mutka-explorer/module"` — the import is
erased at compile time, so the built module file stays import-free, exactly what the
worker loader needs.

- **The d.ts is generated from the app source**, never hand-written: `build.mjs` runs
  `dts-bundle-generator` over `src/index.ts`, which re-exports the author-facing types
  straight from `src/core/sandbox/{defineModule,hostProxy,protocol}.ts`,
  `src/core/types.ts`, etc. So the published types **cannot drift** from the real host
  API — regenerating picks up any change automatically.
- It is committed as `.gitignore`d output (`index.d.ts`); CI regenerates before publish.
- `build.mjs` stamps the version from `MUTKA_VERSION` (the release tag) or the root
  `package.json` locally.

**Consequence for contract changes:** if you change the `host` surface, `defineModule`
shape, `protocol.ts`, or a re-exported type, the SDK just needs a **rebuild** (no manual
type edits) — but update the author-facing docs that mention it (`COMMUNITY_MODULES.md`,
root `CLAUDE.md`). If you add a NEW author-facing type, also add it to
`module-sdk/src/index.ts`'s export list so authors can name it. See the `update-docs` skill.

## `create-module/` — `@mutka-explorer/create`

A dependency-free Node CLI (built on `node:readline`/`parseArgs`) so it runs instantly
via `npm create @mutka-explorer` / `npx @mutka-explorer/create`. It prompts for
id/name/permissions (or takes flags + `--yes`) and writes a project: a typed
`src/index.ts`, a `package.json` pinning `@mutka-explorer/module` + a `tsup` build to one
ESM file, `tsconfig.json`, `mutka.config.json` (for GitHub discovery), and a
`scripts/dev-install.mjs` that copies the build into `~/.mutka/modules/<id>/`.

- `lib/templates.mjs` owns every generated file's contents (incl. the `PERMISSIONS` list —
  keep it in sync with `ModulePermission`). `lib/main.mjs` orchestrates; `lib/scaffold.mjs`
  writes + installs; `lib/prompt.mjs` is the minimal prompter.
- It pins the types dep to its **own version** (`^X.Y.Z`), so a project scaffolded by the
  CLI at vX.Y.Z gets a matching `@mutka-explorer/module`.

---

## Conventions

- Keep `create-module` **dependency-free** (it must `npx` with nothing to install).
- Don't import app code into these packages at runtime — `module-sdk` references app
  source **for type generation only**; `create-module` references nothing from `src/`.
- A module author's built file must be ONE self-contained ESM file — the scaffolder's
  `tsup` build and the SDK's `import type` shape both exist to guarantee that.
