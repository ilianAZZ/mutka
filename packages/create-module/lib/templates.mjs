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

export function indexTs(cfg) {
  return `import type { SandboxModuleDef } from "@mutka-explorer/module";

// A Mutka module is a single self-contained ESM file. It imports NOTHING at
// runtime — it reaches the system only through \`host\`, and every host call is
// checked against the permissions declared below. \`import type\` above is erased
// at compile time, so the built file stays self-contained.
const mod: SandboxModuleDef = {
  id: "${cfg.id}",
  name: "${cfg.name}",
  version: "0.1.0",
  description: "${cfg.description}",
  author: { name: "${cfg.authorName}", github: "${cfg.authorGithub}" },
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
    host.onCommand("${cfg.id}.hello", async (snap) => {
      // host is fully typed — readDir resolves to FileItem[], no cast needed.
      const items = await host.fs.readDir(snap.currentDirectory);
      const dirs = items.filter((i) => i.isDir).length;
      host.log(
        \`\${snap.currentDirectory} → \${items.length} items (\${dirs} folders, \${items.length - dirs} files)\`,
      );
    });
  },
};

export default mod;
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
\`mutka-module-*\` with \`dist/index.js\` committed; \`mutka.config.json\` points the
catalog at it. Users then find and install it from the Modules overlay.
`;
}
