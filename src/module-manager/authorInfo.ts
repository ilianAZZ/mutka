import type { ModuleAuthor } from "../core/sandbox/protocol";
import type { CatalogAuthor } from "./types";
import { safeImageSrc, safeHttpUrl } from "./imageSrc";

// =============================================================================
// AUTHOR INFO — turn a module's manifest `author` into the resolved render shape
// for the Modules UI. Source-agnostic: the name links to `author.link` (any
// http(s) URL — a personal site or profile page) and the avatar is sanitized
// from `author.avatar` (http(s) or data:image). No GitHub-specific derivation.
// Returns null when there's nothing to display.
// =============================================================================

/** Resolve a manifest author into the render shape. */
export function resolveAuthor(author: ModuleAuthor | undefined): CatalogAuthor | null {
  const name = author?.name;
  const link = safeHttpUrl(author?.link);
  const avatarUrl = safeImageSrc(author?.avatar);
  if (!name && !link && !avatarUrl) return null;
  return { name, link, avatarUrl };
}
