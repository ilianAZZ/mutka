# packages/ — Published npm tooling for module authors

These are the **public npm packages a community module author installs**. They are
NOT part of the app bundle — the app never imports them. They exist so people
outside this repo can build modules in typed TypeScript instead of hand-written JS.

Both publish to npm on each `vX.Y.Z` release tag (jobs `publish-sdk` /
`publish-create` in `.github/workflows/release.yml`), **versioned in lockstep with
the app**. Publishing needs the `NPM_TOKEN` repo secret and the `mutka-explorer` npm
org.

| Package                   | npm name                  | What it is                                                            |
| ------------------------- | ------------------------- | -------------------------------------------------------------------- |
| `module-sdk/`             | `@mutka-explorer/module`  | Author-facing TS types + the `defineModule()` helper (one identity fn). |
| `create-module/`          | `@mutka-explorer/create`  | The `npm create @mutka-explorer` **scaffolder** (plain ESM, no deps). |

---

## `module-sdk/` — `@mutka-explorer/module`

Ships a generated `index.d.ts` plus a one-line `index.js` whose only export is
`defineModule` (an identity function, `def => def`). Authors
`import { defineModule } from "@mutka-explorer/module"` and `export default
defineModule({…})`: it adds no runtime weight (a bundler inlines it), but lets TS infer
the `commands[].id`s and type `host.onCommand` to them. Authors who want zero runtime
import can instead `import type { SandboxModuleDef }` and annotate
`SandboxModuleDef<"the.command.id">` — same matching, purely in types.

- **The d.ts is generated from the app source**, never hand-written: `build.mjs` runs
  `dts-bundle-generator` over `src/index.ts`, which re-exports the author-facing types
  straight from `src/core/sandbox/{defineModule,hostProxy,protocol}.ts`,
  `src/core/types.ts`, `src/core/module-registry/public-types.ts`, etc. So the published
  types **cannot drift** from the real host API — regenerating picks up any change
  automatically.

  **The build must stay React-free.** The bundler type-checks every file it transitively
  loads, so a reachable file that imports `react` (e.g. `module-registry.types.ts`, via
  `MutkaSidebarPanel`'s `ComponentType`) would force `react` into the SDK's deps. That's
  why the author-facing `ModulePermission`/`SidebarItem` live in the React-free
  `module-registry/public-types.ts` and the SDK-reachable files (`defineModule`,
  `hostProxy`, `protocol`, `discovery/types`) import them from THERE, never from
  `module-registry.types.ts`. Keep it that way — don't make a SDK-reachable file import a
  React-coupled module.
- It is committed as `.gitignore`d output (`index.d.ts`); CI regenerates before publish.
- `build.mjs` stamps the version from `MUTKA_VERSION` (the release tag) or the root
  `package.json` locally.

**Consequence for contract changes:** if you change the `host` surface, `defineModule`
shape, `protocol.ts`, or a re-exported type, the SDK just needs a **rebuild** (no manual
type edits) — but update the author-facing docs that mention it (the website MDX pages,
root `CLAUDE.md`). If you add a NEW author-facing type, also add it to
`module-sdk/src/index.ts`'s export list so authors can name it. See the `update-docs` skill.

## `create-module/` — `@mutka-explorer/create`

A dependency-free Node CLI (built on `node:readline`/`parseArgs`) so it runs instantly
via `npm create @mutka-explorer` / `npx @mutka-explorer/create`. It prompts for
id/name/permissions (or takes flags + `--yes`) and writes a project: a typed
`src/index.ts`, a `package.json` pinning `@mutka-explorer/module` + a `tsup` build to one
ESM file, `tsconfig.json`, `mutka.config.json` (for GitHub discovery), a
`scripts/dev-install.mjs` that copies the build into `~/.mutka/modules/<id>/`, and a
`.github/workflows/build.yml`.

**Why the generated build workflow matters.** GitHub discovery
(`sandbox-builtins/github-discovery.ts`) fetches a module's `dist/index.js` from the
repo's **default branch** — it never looks at releases. A TS module's repo only has
`src/index.ts` until something builds it, so the scaffolded `build.yml` rebuilds and
commits `dist/index.js` on every push to `main` (loop-guarded with `paths-ignore:
dist/**` + a `[skip ci]` commit). Authors push only TypeScript; discovery always finds a
fresh build. No core/discovery change was needed — this is the deliberate reason discovery
stayed as-is.

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
