#!/usr/bin/env node
// Pre-commit guard: if this commit touches release-worthy source but adds no
// changeset, warn (and block) so versioning never silently falls behind.
//
// "Release-worthy" = files under src/, src-tauri/src/, or the manifests. Pure
// docs / chore / changeset-only commits are exempt. Bypass intentionally with:
//   git commit --no-verify        (or set SKIP_CHANGESET=1)
//
// Invoked from .githooks/pre-commit.

import { execSync } from "node:child_process";

if (process.env.SKIP_CHANGESET === "1") process.exit(0);

function staged() {
  const out = execSync("git diff --cached --name-only --diff-filter=ACMR", { encoding: "utf8" });
  return out.split("\n").filter(Boolean);
}

const files = staged();

// A changeset is being added → all good.
const hasChangeset = files.some((f) => f.startsWith(".changeset/") && f.endsWith(".md") && !/README\.md$/i.test(f));
if (hasChangeset) process.exit(0);

// Does this commit change anything that should ship in a release?
const SOURCE = /^(src\/|src-tauri\/src\/|src-tauri\/Cargo\.toml$|src-tauri\/tauri\.conf\.json$|package\.json$)/;
const touchesSource = files.some((f) => SOURCE.test(f));
if (!touchesSource) process.exit(0);

console.error("\n✗ This commit changes source but has no changeset.\n");
console.error("  Describe the change so the version + changelog can be deduced:");
console.error("    pnpm changeset\n");
console.error("  Or skip intentionally (no version impact):");
console.error("    git commit --no-verify    (or SKIP_CHANGESET=1 git commit ...)\n");
process.exit(1);
