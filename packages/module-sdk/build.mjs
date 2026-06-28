// Generates the single, self-contained index.d.ts for @mutka-explorer/module by
// bundling the author-facing types straight from the Mutka app source (the
// source of truth in ../../src). Run via `npm run build`.
//
// Version is lockstep with the app: CI passes MUTKA_VERSION (derived from the
// vX.Y.Z git tag); locally we fall back to the root package.json version.
import { generateDtsBundle } from "dts-bundle-generator";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "src", "index.ts");
const tsconfig = join(here, "tsconfig.json");
const pkgPath = join(here, "package.json");
const rootPkgPath = join(here, "..", "..", "package.json");

const rootVersion = JSON.parse(readFileSync(rootPkgPath, "utf8")).version;
const version = (process.env.MUTKA_VERSION ?? rootVersion).replace(/^v/, "");

// Stamp the resolved version so the published package matches the app release.
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

const [bundle] = generateDtsBundle(
  [{ filePath: entry, output: { noBanner: true, exportReferencedTypes: false } }],
  { preferredConfigPath: tsconfig }
);

const banner =
  `// Type definitions for @mutka-explorer/module v${version}\n` +
  `// Mutka module SDK — author-facing types only (no runtime code).\n` +
  `// Generated from the Mutka app source; do not edit by hand.\n\n`;

writeFileSync(join(here, "index.d.ts"), banner + bundle);
console.log(`wrote index.d.ts (@mutka-explorer/module@${version})`);
