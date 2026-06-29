// The files a scaffolded module project is made of. Each function takes the
// resolved config and returns file contents as a string. Kept here so `main`/
// `scaffold` stay about orchestration, not text.

/** Every permission a module may declare (mirrors ModulePermission in the app). */
export const PERMISSIONS = [
  "fs:read", "fs:write", "fs:temp",
  "clipboard:read", "clipboard:write",
  "navigation", "view", "dialog",
  "network:public", "network:local",
  "storage", "secrets", "ui", "discovery", "shell",
];

const permsLiteral = (perms) => perms.map((p) => `"${p}"`).join(", ");

// The `author` object literal for the generated module. Source-agnostic: `link`
// is where clicking the name goes (any http(s) URL — here defaulted to a GitHub
// profile, but a personal site works too); add an `avatar` (http(s) or
// data:image URI) for a picture.
function authorLiteral(cfg) {
  const parts = [`name: "${cfg.authorName}"`];
  if (cfg.authorLink) parts.push(`link: "${cfg.authorLink}"`);
  return `{ ${parts.join(", ")} }`;
}

export function indexTs(cfg) {
  return `import { defineModule } from "@mutka-explorer/module";

// A Mutka module is a single self-contained ESM file. It reaches the system only
// through \`host\`, and every host call is checked against the permissions declared
// below. \`defineModule\` is an identity function: it adds no runtime weight (the
// bundler inlines it) but lets TypeScript infer your command ids — so
// \`host.onCommand\` only accepts an id you declared in \`commands\`, and a typo is a
// compile error.
export default defineModule({
  id: "${cfg.id}",
  name: "${cfg.name}",
  version: "0.1.0",
  description: "${cfg.description}",
  // Clicking your name in the Modules UI opens \`link\` (any http(s) URL — a
  // personal site or a profile). Add \`avatar\` (an http(s) or data:image URI) for
  // a picture.
  author: ${authorLiteral(cfg)},
  tags: [],
  permissions: [${permsLiteral(cfg.permissions)}],
  commands: [
    {
      id: "${cfg.id}.hello",
      label: "${cfg.name}: count items here",
      contextMenu: true,
      contextMenuCategory: "View",
      when: { selection: "any" },
    },
  ],
  setup(host) {
    // "${cfg.id}.hello" is autocompleted + checked against commands[] above.
    host.onCommand("${cfg.id}.hello", async (snap) => {
      // host is fully typed — readDir resolves to FileItem[], no cast needed.
      const items = await host.fs.readDir(snap.currentDirectory);
      const dirs = items.filter((i) => i.isDir).length;
      host.log(
        \`\${snap.currentDirectory} → \${items.length} items (\${dirs} folders, \${items.length - dirs} files)\`,
      );
    });
  },
});
`;
}

export function packageJson(cfg) {
  return JSON.stringify(
    {
      name: cfg.pkgName,
      version: "0.1.0",
      description: cfg.description,
      type: "module",
      private: true,
      // Read by scripts/dev-install.mjs to place the built file under ~/.mutka.
      mutka: { id: cfg.id },
      scripts: {
        build: "tsup src/index.ts --format esm",
        dev: "tsup src/index.ts --format esm --watch",
        "install:local": "npm run build && node scripts/dev-install.mjs",
      },
      devDependencies: {
        "@mutka-explorer/module": cfg.typesVersion,
        tsup: "^8.0.0",
        typescript: "^5.5.0",
      },
    },
    null,
    2,
  ) + "\n";
}

export function tsconfigJson() {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        moduleResolution: "bundler",
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        types: [],
      },
      include: ["src"],
    },
    null,
    2,
  ) + "\n";
}

// GitHub discovery installs a repo named `mutka-module-*` by reading either a
// bare index.js at the root OR this file listing the built entry path(s).
export function mutkaConfigJson() {
  return JSON.stringify({ projects: ["dist/index.js"] }, null, 2) + "\n";
}

export function gitignore() {
  return ["node_modules/", "*.log", ".DS_Store", ""].join("\n");
}

// Builds, then copies the single bundled file into ~/.mutka/modules/<id>/ so the
// running app picks it up on reload — the fast local dev loop.
export function devInstallMjs() {
  return `import { readFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const id = pkg.mutka?.id;
if (!id) throw new Error("package.json is missing \\"mutka.id\\"");
if (!existsSync("dist/index.js")) throw new Error("dist/index.js not found — run \\"npm run build\\" first");

const dest = join(homedir(), ".mutka", "modules", id);
mkdirSync(dest, { recursive: true });
copyFileSync("dist/index.js", join(dest, "index.js"));
console.log(\`installed → \${join(dest, "index.js")}\\nReload Mutka (or toggle the module) to load it.\`);
`;
}

// A GitHub Action the module repo ships: on every push to the default branch it
// builds and commits dist/index.js, so Mutka's GitHub discovery — which reads the
// repo's default branch — always finds a fresh build. Authors push only TypeScript.
// `paths-ignore: dist/**` plus `[skip ci]` stop the bot's commit from re-triggering.
export function buildWorkflowYml() {
  return `name: build

# Builds the module and commits dist/index.js so Mutka's GitHub discovery (which
# reads this repo's default branch) always finds a fresh build — you push only
# TypeScript. Needs Settings → Actions → General → Workflow permissions set to
# "Read and write permissions" so the job can commit dist back.
on:
  push:
    branches: [main]
    paths-ignore:
      - "dist/**" # the commit this workflow makes must not re-trigger it

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install --no-audit --no-fund
      - run: npm run build
      - name: Commit dist/index.js
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add -f dist/index.js   # -f so it commits even if dist/ is gitignored
          git diff --staged --quiet && { echo "dist unchanged"; exit 0; }
          git commit -m "build: dist/index.js [skip ci]"
          git push origin HEAD:main
`;
}

export function readme(cfg) {
  return `# ${cfg.name}

A [Mutka](https://github.com/ilianAZZ/mutka) module (\`${cfg.id}\`), written in
TypeScript against [\`@mutka-explorer/module\`](https://www.npmjs.com/package/@mutka-explorer/module).

## Develop

\`\`\`bash
npm install
npm run dev          # rebuild dist/index.js on change
npm run install:local # build + copy into ~/.mutka/modules/${cfg.id}/ then reload Mutka
\`\`\`

Your module logic lives in \`src/index.ts\`. It runs ISOLATED in a Web Worker:
**no DOM, no native network** (\`fetch\`/\`XMLHttpRequest\`/\`WebSocket\` are blocked —
use \`host.net\`). Pure-logic npm libraries bundle fine; DOM/network ones do not.

## Build & publish

\`\`\`bash
npm run build        # bundles src/index.ts → dist/index.js (one self-contained file)
\`\`\`

To distribute via Mutka's GitHub discovery, push this project to a repo named
\`mutka-module-*\`. Discovery reads the repo's **default branch**, so the built
\`dist/index.js\` must live there (\`mutka.config.json\` points the catalog at it).

You don't have to build by hand: this project ships
\`.github/workflows/build.yml\`, which on every push to \`main\` rebuilds and commits
\`dist/index.js\` for you — so you push only TypeScript and discovery always sees a
fresh build. **One-time setup:** in the repo's Settings → Actions → General →
Workflow permissions, choose **"Read and write permissions"** so the job can commit
\`dist\` back. (Prefer to manage \`dist\` yourself? Delete the workflow and commit
\`dist/index.js\` after \`npm run build\`.)
`;
}
