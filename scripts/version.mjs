#!/usr/bin/env node
// Consume pending changesets → compute the next version → bump all manifests,
// write CHANGELOG.md, and delete the consumed changesets.
//
// A changeset is a markdown file in `.changeset/` (not README.md) shaped like:
//
//   ---
//   bump: minor          # major | minor | patch
//   ---
//   One-line summary that lands in the changelog.
//   (optional extra lines, also kept)
//
// The release version is DEDUCED, never set by hand: the highest bump across
// all pending changesets wins (major > minor > patch) and is applied to the
// current version. Run `node scripts/version.mjs` to preview + write files,
// or `node scripts/version.mjs --tag` to also git-commit and tag the release.
//
// Usage:
//   node scripts/version.mjs            # bump files + changelog, consume changesets
//   node scripts/version.mjs --tag      # the above, then git commit + tag vX.Y.Z

import { readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHANGESET_DIR = join(ROOT, ".changeset");
const PKG = join(ROOT, "package.json");
const TAURI_CONF = join(ROOT, "src-tauri", "tauri.conf.json");
const CARGO = join(ROOT, "src-tauri", "Cargo.toml");
const CHANGELOG = join(ROOT, "CHANGELOG.md");

const BUMP_RANK = { patch: 0, minor: 1, major: 2 };
const BUMP_LABEL = { major: "Major", minor: "Minor", patch: "Patch" };

/** Parse a changeset file into { bump, summary }. Throws on a bad bump value. */
function parseChangeset(path, raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) throw new Error(`${path}: missing "---" frontmatter block`);
  const bumpLine = match[1].match(/^\s*bump\s*:\s*(\w+)\s*$/m);
  if (!bumpLine) throw new Error(`${path}: frontmatter must set "bump: major|minor|patch"`);
  const bump = bumpLine[1].toLowerCase();
  if (!(bump in BUMP_RANK)) throw new Error(`${path}: invalid bump "${bump}"`);
  const summary = match[2].trim();
  if (!summary) throw new Error(`${path}: needs a summary line under the frontmatter`);
  return { bump, summary };
}

/** Read every changeset (excluding README.md) → [{ file, bump, summary }]. */
function readChangesets() {
  if (!existsSync(CHANGESET_DIR)) return [];
  return readdirSync(CHANGESET_DIR)
    .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
    .map((f) => {
      const path = join(CHANGESET_DIR, f);
      return { file: path, ...parseChangeset(f, readFileSync(path, "utf8")) };
    });
}

/** Highest bump wins. major→x+1.0.0, minor→x.y+1.0, patch→x.y.z+1. */
function nextVersion(current, bump) {
  const [maj, min, pat] = current.split(".").map((n) => parseInt(n, 10));
  if ([maj, min, pat].some(Number.isNaN)) throw new Error(`Unparseable version: ${current}`);
  if (bump === "major") return `${maj + 1}.0.0`;
  if (bump === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

/** Bump the version line only inside Cargo.toml's [package] section. */
function bumpCargo(version) {
  const lines = readFileSync(CARGO, "utf8").split("\n");
  let inPackage = false;
  const out = lines.map((line) => {
    if (/^\[package\]/.test(line)) inPackage = true;
    else if (/^\[/.test(line)) inPackage = false;
    if (inPackage && /^version\s*=/.test(line)) return `version = "${version}"`;
    return line;
  });
  writeFileSync(CARGO, out.join("\n"));
}

function bumpJson(path, version) {
  const json = JSON.parse(readFileSync(path, "utf8"));
  json.version = version;
  writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
}

function isoDate() {
  // Local YYYY-MM-DD without pulling in a date lib.
  return new Date().toISOString().slice(0, 10);
}

function prependChangelog(version, changesets) {
  const groups = { major: [], minor: [], patch: [] };
  for (const c of changesets) groups[c.bump].push(c.summary);

  let section = `## ${version} — ${isoDate()}\n\n`;
  for (const bump of ["major", "minor", "patch"]) {
    if (!groups[bump].length) continue;
    section += `### ${BUMP_LABEL[bump]}\n\n`;
    for (const s of groups[bump]) section += `- ${s.replace(/\n/g, "\n  ")}\n`;
    section += "\n";
  }

  const header = "# Changelog\n\n";
  const existing = existsSync(CHANGELOG)
    ? readFileSync(CHANGELOG, "utf8").replace(/^# Changelog\s*\n+/, "")
    : "";
  writeFileSync(CHANGELOG, header + section + existing);
}

function main() {
  const tag = process.argv.includes("--tag");
  const changesets = readChangesets();
  if (changesets.length === 0) {
    console.log("No changesets in .changeset/ — nothing to release.");
    console.log("Create one with: pnpm changeset");
    process.exit(0);
  }

  const highest = changesets.reduce(
    (acc, c) => (BUMP_RANK[c.bump] > BUMP_RANK[acc] ? c.bump : acc),
    "patch"
  );
  const current = JSON.parse(readFileSync(PKG, "utf8")).version;
  const version = nextVersion(current, highest);

  console.log(`${changesets.length} changeset(s), highest bump: ${highest}`);
  console.log(`Version: ${current} → ${version}\n`);

  bumpJson(PKG, version);
  bumpJson(TAURI_CONF, version);
  bumpCargo(version);
  prependChangelog(version, changesets);
  for (const c of changesets) rmSync(c.file);

  console.log("Updated package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml, CHANGELOG.md");
  console.log("Consumed changesets removed.");

  if (tag) {
    execSync("git add -A", { cwd: ROOT, stdio: "inherit" });
    // The release commit bumps the manifests but intentionally carries no
    // changeset (they were just consumed), so bypass the changeset pre-commit hook.
    execSync(`git commit -m "release: v${version}"`, {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, SKIP_CHANGESET: "1" },
    });
    // Annotated tag (not lightweight) so `git push --follow-tags` pushes it.
    execSync(`git tag -a v${version} -m "release: v${version}"`, { cwd: ROOT, stdio: "inherit" });
    console.log(`\nTagged v${version}. Push with:  git push --follow-tags`);
  } else {
    console.log(`\nReview the diff, then:  git commit -am "release: v${version}" && git tag v${version} && git push --follow-tags`);
  }
}

main();
