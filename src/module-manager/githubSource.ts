import { invoke } from "@tauri-apps/api/core";
import { probeManifest } from "./probeManifest";
import { resolveAuthor } from "./authorInfo";
import type {
  DiscoveryQuery,
  DiscoveryResult,
  ModuleDiscoverySource,
  ModuleListing,
} from "./types";

// =============================================================================
// GITHUB SOURCE — the built-in module-discovery source. It searches GitHub for
// repositories named `mutka-module-*` and resolves each into the module(s) it
// ships (a repo's mutka.config.json may list several under `projects`). Each
// module's display metadata comes from its own defineModule() manifest, read by
// downloading + probing the entry in a throwaway worker. `discover()` caches the
// downloaded source so `fetchSource()` is instant at install time.
//
// Implements ModuleDiscoverySource; registers with the DiscoveryRegistry. A
// future source (GitLab, local folder, …) implements the same shape.
// =============================================================================

const SEARCH_PREFIX = "mutka-module-";
const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";
const HEADERS: Record<string, string> = { "User-Agent": "Mutka", Accept: "application/vnd.github+json" };
const DEFAULT_PER_PAGE = 12;

interface HttpResponse {
  status: number;
  body: string;
}

interface GitHubRepo {
  full_name: string;
  name: string;
  description: string | null;
  owner: { login: string };
  default_branch: string;
  html_url: string;
}

interface MutkaRepoConfig {
  projects?: string[];
  modules?: (string | { id?: string; entry?: string; path?: string })[];
}

/** Provider-private ref: which repo/branch/path a listing came from. */
interface GitHubRef {
  repo: string;
  branch: string;
  path: string;
}

async function httpGet(url: string): Promise<HttpResponse> {
  return invoke<HttpResponse>("http_request", { req: { url, method: "GET", headers: HEADERS } });
}

function rawUrl(repo: string, ref: string, path: string): string {
  return `${RAW}/${repo}/${ref}/${path}`;
}

function encodeRef(ref: GitHubRef): string {
  return JSON.stringify(ref);
}

function decodeRef(ref: string): GitHubRef {
  const parsed: unknown = JSON.parse(ref);
  if (
    typeof parsed === "object" && parsed !== null &&
    "repo" in parsed && "branch" in parsed && "path" in parsed
  ) {
    const r = parsed as Record<string, unknown>;
    if (typeof r.repo === "string" && typeof r.branch === "string" && typeof r.path === "string") {
      return { repo: r.repo, branch: r.branch, path: r.path };
    }
  }
  throw new Error("Malformed GitHub module reference.");
}

/** Entry paths a repo ships: from mutka.config.json `projects`, else bare index.js. */
async function entryPaths(repo: string, branch: string): Promise<string[]> {
  const res = await httpGet(rawUrl(repo, branch, "mutka.config.json"));
  if (res.status === 200) {
    try {
      const cfg = JSON.parse(res.body) as MutkaRepoConfig;
      const fromProjects = cfg.projects ?? [];
      const fromModules = (cfg.modules ?? []).map((m) => (typeof m === "string" ? m : m.entry ?? m.path));
      const paths = [...fromProjects, ...fromModules].filter(
        (p): p is string => typeof p === "string" && p.length > 0
      );
      if (paths.length) return paths;
    } catch (err) {
      throw new Error(`mutka.config.json is not valid JSON: ${String(err)}`);
    }
  }
  return ["index.js"];
}

// Source cache: discover() downloads each entry to probe it, so keep the bytes
// keyed by ref to make fetchSource() instant. fetchSource re-downloads on a miss.
const sourceCache = new Map<string, string>();

async function fetchRaw(ref: GitHubRef): Promise<string> {
  const res = await httpGet(rawUrl(ref.repo, ref.branch, ref.path));
  if (res.status !== 200) throw new Error(`Cannot download ${ref.path} (HTTP ${res.status}).`);
  return res.body;
}

/** Resolve one repo into its module listing(s), probing each entry for metadata. */
async function repoToListings(repo: GitHubRepo): Promise<ModuleListing[]> {
  const branch = repo.default_branch;
  const paths = await entryPaths(repo.full_name, branch);
  const listings: ModuleListing[] = [];
  for (const path of paths) {
    try {
      const ref: GitHubRef = { repo: repo.full_name, branch, path };
      const source = await fetchRaw(ref);
      const manifest = await probeManifest(source); // validate + read metadata
      const refStr = encodeRef(ref);
      sourceCache.set(refStr, source);
      listings.push({
        sourceId: "github",
        ref: refStr,
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        icon: manifest.icon,
        author: resolveAuthor(manifest.author, repo.owner.login),
        permissions: manifest.permissions,
        tags: manifest.tags,
        homepageUrl: repo.html_url,
      });
    } catch {
      // A single bad entry shouldn't drop the rest of the repo's modules.
    }
  }
  return listings;
}

export const githubSource: ModuleDiscoverySource = {
  id: "github",
  label: "GitHub",

  async discover(query: DiscoveryQuery): Promise<DiscoveryResult> {
    const perPage = query.perPage ?? DEFAULT_PER_PAGE;
    const page = query.page ?? 1;
    const q = `${SEARCH_PREFIX} in:name ${query.text ?? ""}`.trim();
    const url = `${API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&per_page=${perPage}&page=${page}`;
    const res = await httpGet(url);
    if (res.status === 403) throw new Error("GitHub rate limit reached — try again in a few minutes.");
    if (res.status !== 200) throw new Error(`GitHub search failed (HTTP ${res.status}).`);

    const data = JSON.parse(res.body) as { total_count?: number; items?: GitHubRepo[] };
    const repos = (data.items ?? []).filter((r) => r.name.toLowerCase().startsWith(SEARCH_PREFIX));

    // Resolve repos into per-module listings (a repo may carry several).
    const settled = await Promise.allSettled(repos.map(repoToListings));
    const listings = settled
      .filter((s): s is PromiseFulfilledResult<ModuleListing[]> => s.status === "fulfilled")
      .flatMap((s) => s.value);

    const total = data.total_count ?? repos.length;
    const nextPage = page * perPage < total && repos.length > 0 ? page + 1 : undefined;
    return { listings, nextPage };
  },

  async fetchSource(ref: string): Promise<string> {
    const cached = sourceCache.get(ref);
    if (cached) return cached;
    const source = await fetchRaw(decodeRef(ref));
    sourceCache.set(ref, source);
    return source;
  },
};
