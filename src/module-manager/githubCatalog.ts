import { invoke } from "@tauri-apps/api/core";
import { probeManifest } from "./probeManifest";
import type { CatalogEntry, CatalogSource, ResolvedModule } from "./types";

// =============================================================================
// GITHUB CATALOG — the installable-module source of truth (for now). It searches
// GitHub for repositories named `mutka-*` and resolves each into one or more
// installable modules. A repo ships EITHER a bare index.js at its root, OR a
// `mutka.config.json` that lists the entry path(s) of its module(s):
//
//   { "modules": [ { "entry": "dist/index.js" }, { "entry": "second/index.js" } ] }
//
// This implements CatalogSource so a future source (a DB of GitHub links, a
// private registry) can replace it without touching the manager or the UI.
// =============================================================================

// Repos named mutka-module-* are Mutka modules by convention. The search box can
// append GitHub qualifiers (e.g. "org:my-org") to narrow it.
const SEARCH_PREFIX = "mutka-module-";
const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";
// GitHub requires a User-Agent; the API is unauthenticated (60 req/h per IP).
const HEADERS: Record<string, string> = { "User-Agent": "Mutka", Accept: "application/vnd.github+json" };

interface HttpResponse {
  status: number;
  body: string;
}

interface GitHubRepo {
  full_name: string;
  name: string;
  description: string | null;
  owner: { login: string };
  stargazers_count: number;
  default_branch: string;
  html_url: string;
}

interface MutkaRepoConfig {
  modules?: { id?: string; entry?: string; path?: string }[];
}

async function httpGet(url: string): Promise<HttpResponse> {
  return invoke<HttpResponse>("http_request", { req: { url, method: "GET", headers: HEADERS } });
}

function rawUrl(repo: string, ref: string, path: string): string {
  return `${RAW}/${repo}/${ref}/${path}`;
}

function toEntry(repo: GitHubRepo): CatalogEntry {
  return {
    repo: repo.full_name,
    name: repo.name,
    description: repo.description ?? undefined,
    owner: repo.owner.login,
    stars: repo.stargazers_count,
    defaultBranch: repo.default_branch,
    htmlUrl: repo.html_url,
  };
}

/** The entry file paths a repo ships: from mutka.config.json, else a bare index.js. */
async function entryPaths(entry: CatalogEntry): Promise<string[]> {
  const res = await httpGet(rawUrl(entry.repo, entry.defaultBranch, "mutka.config.json"));
  if (res.status === 200) {
    try {
      const cfg = JSON.parse(res.body) as MutkaRepoConfig;
      const paths = (cfg.modules ?? [])
        .map((m) => m.entry ?? m.path)
        .filter((p): p is string => typeof p === "string" && p.length > 0);
      if (paths.length) return paths;
    } catch (err) {
      throw new Error(`mutka.config.json is not valid JSON: ${String(err)}`);
    }
  }
  return ["index.js"]; // fallback: a single module at the repo root
}

export const githubCatalog: CatalogSource = {
  label: "GitHub",

  async search(query: string): Promise<CatalogEntry[]> {
    // Always constrain to mutka-* names; append the user's free-text terms.
    const q = `${SEARCH_PREFIX} in:name ${query}`.trim();
    const url = `${API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&per_page=30`;
    const res = await httpGet(url);
    if (res.status === 403) throw new Error("GitHub rate limit reached — try again in a few minutes.");
    if (res.status !== 200) throw new Error(`GitHub search failed (HTTP ${res.status}).`);
    const data = JSON.parse(res.body) as { items?: GitHubRepo[] };
    return (data.items ?? [])
      .filter((r) => r.name.toLowerCase().startsWith(SEARCH_PREFIX))
      .map(toEntry);
  },

  async resolve(entry: CatalogEntry): Promise<ResolvedModule[]> {
    const paths = await entryPaths(entry);
    const resolved: ResolvedModule[] = [];
    for (const path of paths) {
      const res = await httpGet(rawUrl(entry.repo, entry.defaultBranch, path));
      if (res.status !== 200) throw new Error(`Cannot download ${path} (HTTP ${res.status}).`);
      // Validate by loading it in a throwaway worker — throws if it doesn't load.
      const manifest = await probeManifest(res.body);
      resolved.push({ id: manifest.id, manifest, source: res.body, entry: path });
    }
    if (!resolved.length) throw new Error("Repository contains no installable module.");
    return resolved;
  },
};
