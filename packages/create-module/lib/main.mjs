// Orchestrates the scaffolder: parse args, fill gaps interactively, validate,
// then write the project and install. Kept dependency-free.
import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { resolve, basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ask, confirm } from "./prompt.mjs";
import { PERMISSIONS } from "./templates.mjs";
import { writeProject, installDeps, detectPackageManager } from "./scaffold.mjs";

const ID_RE = /^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** This CLI's own version → the @mutka-explorer/module version we pin (lockstep). */
function typesVersion() {
  const here = dirname(fileURLToPath(import.meta.url));
  const v = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")).version;
  return !v || v === "0.0.0" ? "latest" : `^${v}`;
}

export async function main(argv) {
  // `--no-install` isn't native to parseArgs; pull it out before parsing.
  const skipInstall = argv.includes("--no-install");
  const args = argv.filter((a) => a !== "--no-install");

  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      id: { type: "string" },
      name: { type: "string" },
      description: { type: "string" },
      author: { type: "string" },
      permissions: { type: "string" },
      yes: { type: "boolean", short: "y", default: false },
      pm: { type: "string" },
    },
  });
  const auto = values.yes;

  console.log("\n🧩  create-mutka-module\n");

  // Target directory (positional, or asked, defaulting to a name-derived slug).
  let dir = positionals[0];
  if (!dir && !auto) dir = await ask("Project directory", "my-mutka-module");
  dir = dir || "my-mutka-module";
  const dirName = basename(resolve(dir));

  const defaultName = values.name ?? (auto ? dirName : await ask("Display name", dirName));
  const authorGithub =
    values.author ?? (auto ? "" : await ask("Your GitHub username", ""));
  const defaultId =
    values.id ?? `${slug(authorGithub) || "you"}.${slug(defaultName) || dirName}`;
  const id = auto ? defaultId : await ask("Module id (author.name)", defaultId);
  if (!ID_RE.test(id)) {
    throw new Error(`invalid module id "${id}" — use the form author.name (lowercase, e.g. you.my-module)`);
  }

  const description =
    values.description ?? (auto ? "A Mutka module." : await ask("Description", "A Mutka module."));

  let permissions;
  if (values.permissions !== undefined) {
    permissions = values.permissions.split(",").map((p) => p.trim()).filter(Boolean);
  } else if (auto) {
    permissions = ["fs:read"];
  } else {
    console.log(`\n   Available permissions: ${PERMISSIONS.join(", ")}`);
    const raw = await ask("Permissions (comma-separated)", "fs:read");
    permissions = raw.split(",").map((p) => p.trim()).filter(Boolean);
  }
  const unknown = permissions.filter((p) => !PERMISSIONS.includes(p));
  if (unknown.length) throw new Error(`unknown permission(s): ${unknown.join(", ")}`);

  const cfg = {
    id,
    name: defaultName,
    description,
    authorName: authorGithub || "",
    authorGithub,
    authorLink: authorGithub ? `https://github.com/${authorGithub}` : "",
    permissions,
    pkgName: slug(dirName) || "mutka-module",
    typesVersion: typesVersion(),
  };

  const target = resolve(dir);
  writeProject(target, cfg);
  console.log(`\n✓ created ${dir}/  (id: ${id}, permissions: ${permissions.join(", ")})`);

  const doInstall = skipInstall ? false : auto ? true : await confirm("Install dependencies now?", true);
  if (doInstall) {
    const pm = values.pm ?? detectPackageManager();
    console.log(`\nInstalling with ${pm}…\n`);
    try {
      installDeps(target, pm);
    } catch {
      console.log(`\n⚠ install failed — run it yourself: cd ${dir} && ${pm} install`);
    }
  }

  console.log(`
Next steps:
  cd ${dir}${doInstall ? "" : "\n  npm install"}
  npm run install:local   # build + load into Mutka, then reload the app
  # edit src/index.ts — host is fully typed

Docs: https://mutka.app/docs/modules/writing-a-module
`);
}
