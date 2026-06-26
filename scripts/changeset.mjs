#!/usr/bin/env node
// Interactively create a changeset file in `.changeset/`.
//
// Asks for the bump level (major/minor/patch) and a one-line summary, then
// writes `.changeset/<slug>.md`. This is the human entry point; an AI agent can
// instead follow the `add-changeset` skill to write the same file from a diff.
//
// Usage: pnpm changeset   (alias for: node scripts/changeset.mjs)

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHANGESET_DIR = join(ROOT, ".changeset");

const WORDS = ["amber", "basil", "cedar", "delta", "ember", "fjord", "grove", "hazel", "indigo", "jade"];

function slug(summary) {
  const base = summary
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  // A stable-ish suffix derived from the summary, so two changesets in one
  // session don't collide. (Math.random is fine in a real Node CLI.)
  const suffix = WORDS[Math.floor(Math.random() * WORDS.length)];
  return `${base || "change"}-${suffix}`;
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  console.log("Create a changeset (describes one set of changes for the changelog).\n");

  let bump = (await rl.question("Bump  [1] patch  [2] minor  [3] major  (default 1): ")).trim();
  bump = { "": "patch", "1": "patch", "2": "minor", "3": "major", patch: "patch", minor: "minor", major: "major" }[bump];
  if (!bump) {
    console.error("Invalid bump. Choose 1, 2, or 3.");
    rl.close();
    process.exit(1);
  }

  const summary = (await rl.question("Summary (one line, shown in changelog): ")).trim();
  rl.close();
  if (!summary) {
    console.error("A summary is required.");
    process.exit(1);
  }

  mkdirSync(CHANGESET_DIR, { recursive: true });
  const file = join(CHANGESET_DIR, `${slug(summary)}.md`);
  writeFileSync(file, `---\nbump: ${bump}\n---\n\n${summary}\n`);
  console.log(`\nWrote ${file.replace(ROOT + "/", "")}  (${bump})`);
  console.log("Commit it alongside your changes.");
}

main();
