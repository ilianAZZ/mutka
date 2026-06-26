import type { ModuleAuthor } from "../core/sandbox/protocol";
import type { CatalogAuthor } from "./types";

// =============================================================================
// AUTHOR INFO — turn a module's manifest `author` into concrete avatar/profile
// URLs for the Modules UI. The GitHub login drives the avatar; when the module
// declares no login but was installed from a GitHub repo, the caller passes the
// repo owner as a fallback so credit still shows. Returns null when there's
// nothing to display.
// =============================================================================

/** Resolve a manifest author (+ optional repo-owner fallback) into display URLs. */
export function resolveAuthor(
  author: ModuleAuthor | undefined,
  ownerFallback?: string
): CatalogAuthor | null {
  const github = author?.github ?? ownerFallback;
  const name = author?.name;
  if (!github && !name) return null;
  if (!github) return { name };
  return {
    name,
    github,
    avatarUrl: `https://github.com/${github}.png?size=80`,
    profileUrl: `https://github.com/${github}`,
  };
}
