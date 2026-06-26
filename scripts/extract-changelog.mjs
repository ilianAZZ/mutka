// Print the CHANGELOG.md section body for a given version, for use as GitHub
// Release notes. Usage: node scripts/extract-changelog.mjs 0.2.0
// Prints everything under the "## <version> — <date>" heading up to the next
// "## " heading (without the version heading itself — GitHub shows it as the
// release title). Exits non-zero if the version has no section.
import { readFileSync } from "node:fs";

const version = process.argv[2];
if (!version) {
  console.error("usage: node scripts/extract-changelog.mjs <version>");
  process.exit(1);
}

const url = new URL("../CHANGELOG.md", import.meta.url);
const lines = readFileSync(url, "utf8").split("\n");

const start = lines.findIndex(
  (l) => l === `## ${version}` || l.startsWith(`## ${version} `)
);
if (start === -1) {
  console.error(`no changelog section for ${version}`);
  process.exit(1);
}

const body = [];
for (let i = start + 1; i < lines.length; i++) {
  if (lines[i].startsWith("## ")) break;
  body.push(lines[i]);
}

console.log(body.join("\n").trim());
