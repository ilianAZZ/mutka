// Writes the project files to disk and (optionally) installs dependencies.
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";
import {
  indexTs, packageJson, tsconfigJson, mutkaConfigJson, gitignore, devInstallMjs, readme,
} from "./templates.mjs";

/** Detect the package manager that invoked us (npm create / yarn create / pnpm). */
export function detectPackageManager() {
  const ua = process.env.npm_config_user_agent ?? "";
  if (ua.startsWith("pnpm")) return "pnpm";
  if (ua.startsWith("yarn")) return "yarn";
  return "npm";
}

function writeFileEnsuring(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

/** Create the project directory tree. Throws if the target exists and is non-empty. */
export function writeProject(dir, cfg) {
  if (existsSync(dir) && readdirSync(dir).length > 0) {
    throw new Error(`target directory "${dir}" already exists and is not empty`);
  }
  const files = {
    "package.json": packageJson(cfg),
    "tsconfig.json": tsconfigJson(),
    "mutka.config.json": mutkaConfigJson(),
    ".gitignore": gitignore(),
    "README.md": readme(cfg),
    "src/index.ts": indexTs(cfg),
    "scripts/dev-install.mjs": devInstallMjs(),
  };
  for (const [rel, contents] of Object.entries(files)) {
    writeFileEnsuring(join(dir, rel), contents);
  }
}

/** Install dependencies in `dir` with the given package manager. Best-effort. */
export function installDeps(dir, pm) {
  execSync(`${pm} install`, { cwd: dir, stdio: "inherit" });
}
