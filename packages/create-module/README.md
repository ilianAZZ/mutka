# @mutka-explorer/create

Scaffold a new [Mutka](https://github.com/ilianAZZ/mutka) module — a typed
TypeScript project wired to [`@mutka-explorer/module`](https://www.npmjs.com/package/@mutka-explorer/module)
that builds to a single self-contained ESM file (what Mutka loads).

## Usage

```bash
npm create @mutka-explorer@latest my-module
# or
npx @mutka-explorer/create my-module
```

It prompts for the module id (`author.name`), display name, GitHub username, and
permissions, then generates:

```text
my-module/
  src/index.ts          ← typed skeleton with a working command
  package.json          ← pins @mutka-explorer/module + a tsup build
  tsconfig.json
  mutka.config.json     ← points GitHub discovery at dist/index.js
  scripts/dev-install.mjs
  README.md
```

### Non-interactive

```bash
npm create @mutka-explorer@latest my-module -- \
  --yes --author you --name "My Module" --permissions "fs:read,ui" --no-install
```

Flags: `--id`, `--name`, `--description`, `--author`, `--permissions` (comma-separated),
`--yes` (accept defaults), `--no-install`, `--pm <npm|pnpm|yarn>`.

## After scaffolding

```bash
cd my-module
npm install
npm run install:local   # build + copy into ~/.mutka/modules/<id>/, then reload Mutka
```

Edit `src/index.ts` — `host` is fully typed. The module runs isolated in a Web
Worker (no DOM, no native network; use `host.net`). See the
[developer guide](https://github.com/ilianAZZ/mutka/blob/main/COMMUNITY_MODULES.md).
