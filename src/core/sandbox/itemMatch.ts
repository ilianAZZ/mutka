import type { SandboxOpenMatch } from "./protocol";
import type { FileItem } from "../types";

/**
 * Evaluate a serializable item-match against a FileItem, host-side. Shared by
 * open handlers (double-click resolution) and custom columns (per-cell gating),
 * so a module never hands a predicate across the worker boundary. All present
 * keys AND together; an absent key does not constrain.
 */
export function matchesItem(match: SandboxOpenMatch, item: FileItem): boolean {
  if (match.isDir !== undefined && item.isDir !== match.isDir) return false;
  if (match.isPackage !== undefined && item.isPackage !== match.isPackage) return false;
  if (match.extensions && !match.extensions.includes((item.extension ?? "").toLowerCase())) return false;
  return true;
}
