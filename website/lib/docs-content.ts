// Reads the raw documentation markdown straight off disk so the /llms.txt and
// /llms-full.txt routes can serve plain-text docs to AI crawlers. Both routes
// are statically generated, so this runs at BUILD time (where content/docs is
// always present) and the result is baked into the output — no filesystem
// access at request time, which keeps it safe under `output: "standalone"`.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const CONTENT_DIR = join(process.cwd(), "content", "docs");

export interface DocEntry {
  /** Site-relative url, e.g. "/docs/architecture". */
  url: string;
  title: string;
  description: string;
  /** Markdown body with the frontmatter block stripped. */
  body: string;
  /** True for the auto-generated TypeDoc API reference pages. */
  isApi: boolean;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.mdx?$/.test(name)) out.push(full);
  }
  return out;
}

/** Minimal frontmatter parser — the docs only use flat string keys (title, description). */
function parseFrontmatter(raw: string): {
  data: Record<string, string>;
  body: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const value = line
      .slice(sep + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key) data[key] = value;
  }
  return { data, body: raw.slice(match[0].length) };
}

/** Mirror Fumadocs' default file → route mapping (index → folder, drop extension). */
function toUrl(file: string): string {
  const rel = relative(CONTENT_DIR, file)
    .split(sep)
    .join("/")
    .replace(/\.mdx?$/, "")
    .replace(/\/index$/, "")
    .replace(/^index$/, "");
  return rel ? `/docs/${rel}` : "/docs";
}

/** Every documentation page, sorted by url, read fresh from disk. */
export function getDocEntries(): DocEntry[] {
  return walk(CONTENT_DIR)
    .map((file) => {
      const { data, body } = parseFrontmatter(readFileSync(file, "utf8"));
      const url = toUrl(file);
      return {
        url,
        title: data.title ?? url,
        description: data.description ?? "",
        body: body.trim(),
        isApi: url.startsWith("/docs/api"),
      };
    })
    .sort((a, b) => a.url.localeCompare(b.url));
}
