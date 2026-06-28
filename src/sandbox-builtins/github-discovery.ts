import { defineModule } from "../core/sandbox/defineModule";
import type { ModuleListing, DiscoveryResult } from "../core/discovery/types";

// =============================================================================
// GITHUB DISCOVERY — the built-in module-discovery source, shipped AS A MODULE.
//
// It reaches the system only through `host` (network + modules.probe), exactly
// like a community module would: nothing here is privileged core code. Adding a
// GitLab / local-folder / private-registry source means writing another module
// like this one — no edits to the app. It searches repos named `mutka-module-*`,
// reads each one's manifest to build rich listings, and returns the source bytes
// on install. A repo's mutka.config.json `projects` may list several modules.
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

/** What host.modules.probe gives back (the relevant manifest subset). */
interface ProbedManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  author?: { name?: string; github?: string };
  permissions: ModuleListing["permissions"];
  tags?: string[];
}

/** Source locator we encode into a listing's opaque `ref`. */
interface GitHubRef {
  repo: string;
  branch: string;
  path: string;
}

const rawUrl = (repo: string, branch: string, path: string): string => `${RAW}/${repo}/${branch}/${path}`;

function decodeRef(ref: string): GitHubRef {
  const parsed: unknown = JSON.parse(ref);
  if (parsed && typeof parsed === "object" && "repo" in parsed && "branch" in parsed && "path" in parsed) {
    const r = parsed as Record<string, unknown>;
    if (typeof r.repo === "string" && typeof r.branch === "string" && typeof r.path === "string") {
      return { repo: r.repo, branch: r.branch, path: r.path };
    }
  }
  throw new Error("Malformed GitHub module reference.");
}

/** Author with avatar/profile derived from the login (defaults to the repo owner). */
function authorFor(author: ProbedManifest["author"], ownerFallback: string): ModuleListing["author"] {
  const github = author?.github ?? ownerFallback;
  if (!github && !author?.name) return null;
  if (!github) return { name: author?.name };
  return {
    name: author?.name,
    github,
    avatarUrl: `https://github.com/${github}.png?size=80`,
    profileUrl: `https://github.com/${github}`,
  };
}

export default defineModule({
  id: "core.github-discovery",
  name: "GitHub Discovery",
  version: "1.0.0",
  description: "Discover and install modules from GitHub (mutka-module-* repos).",
  author: { name: "Mutka", github: "ilianAZZ" },
  permissions: ["network:public", "discovery"],
  discoverySources: [{ id: "github", label: "GitHub" }],

  setup(host) {
    // Cache fetched index.js bytes (keyed by ref) so install is a cache hit.
    const sourceCache = new Map<string, string>();

    const get = (url: string): Promise<HttpResponse> =>
      host.net.request({ url, headers: HEADERS }) as Promise<HttpResponse>;

    const fetchRaw = async (ref: GitHubRef): Promise<string> => {
      const res = await get(rawUrl(ref.repo, ref.branch, ref.path));
      if (res.status !== 200) throw new Error(`Cannot download ${ref.path} (HTTP ${res.status}).`);
      return res.body;
    };

    const entryPaths = async (repo: string, branch: string): Promise<string[]> => {
      const res = await get(rawUrl(repo, branch, "mutka.config.json"));
      if (res.status === 200) {
        const cfg = JSON.parse(res.body) as MutkaRepoConfig;
        const fromProjects = cfg.projects ?? [];
        const fromModules = (cfg.modules ?? []).map((m) => (typeof m === "string" ? m : m.entry ?? m.path));
        const paths = [...fromProjects, ...fromModules].filter(
          (p): p is string => typeof p === "string" && p.length > 0
        );
        if (paths.length) return paths;
      }
      // No mutka.config.json: try a bare index.js at the root, then dist/index.js
      // (where a TypeScript module's build lands). A repo with both is de-duped by
      // module id below, and a missing candidate just 404s and is skipped.
      return ["index.js", "dist/index.js"];
    };

    const repoToListings = async (repo: GitHubRepo): Promise<ModuleListing[]> => {
      const branch = repo.default_branch;
      const paths = await entryPaths(repo.full_name, branch);
      const listings: ModuleListing[] = [];
      const seenIds = new Set<string>();
      for (const path of paths) {
        try {
          const ref: GitHubRef = { repo: repo.full_name, branch, path };
          const source = await fetchRaw(ref);
          const manifest = (await host.modules.probe(source)) as ProbedManifest;
          // Same module reached via two candidate paths (e.g. index.js + dist/index.js).
          if (seenIds.has(manifest.id)) continue;
          seenIds.add(manifest.id);
          const refStr = JSON.stringify(ref);
          sourceCache.set(refStr, source);
          listings.push({
            sourceId: "github",
            ref: refStr,
            id: manifest.id,
            name: manifest.name,
            version: manifest.version,
            description: manifest.description,
            icon: manifest.icon,
            author: authorFor(manifest.author, repo.owner.login),
            permissions: manifest.permissions,
            tags: manifest.tags,
            homepageUrl: repo.html_url,
          });
        } catch {
          // One bad entry shouldn't drop the rest of the repo's modules.
        }
      }
      return listings;
    };

    host.onDiscover("github", async (query): Promise<DiscoveryResult> => {
      const perPage = query.perPage ?? DEFAULT_PER_PAGE;
      const page = query.page ?? 1;
      const q = `${SEARCH_PREFIX} in:name ${query.text ?? ""}`.trim();
      const res = await get(`${API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&per_page=${perPage}&page=${page}`);
      if (res.status === 403) throw new Error("GitHub rate limit reached — try again in a few minutes.");
      if (res.status !== 200) throw new Error(`GitHub search failed (HTTP ${res.status}).`);

      const data = JSON.parse(res.body) as { total_count?: number; items?: GitHubRepo[] };
      const repos = (data.items ?? []).filter((r) => r.name.toLowerCase().startsWith(SEARCH_PREFIX));
      const settled = await Promise.allSettled(repos.map(repoToListings));
      const listings = settled
        .filter((s): s is PromiseFulfilledResult<ModuleListing[]> => s.status === "fulfilled")
        .flatMap((s) => s.value);

      const total = data.total_count ?? repos.length;
      const nextPage = page * perPage < total && repos.length > 0 ? page + 1 : undefined;
      return { listings, nextPage };
    });

    host.onFetchSource("github", async (ref): Promise<string> => {
      const cached = sourceCache.get(ref);
      if (cached) return cached;
      return fetchRaw(decodeRef(ref));
    });
  },
});
