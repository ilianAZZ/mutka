import type { BaseContext } from "../types";
import type { WhenClause, ColumnDirMatch } from "./protocol";

/**
 * Evaluate a serializable when-clause against current app state, host-side.
 * Modules declare visibility as data (WhenClause); the host owns the predicate
 * logic so no function ever crosses the worker boundary. Multiple keys AND together.
 */
export function evaluateWhen(when: WhenClause, ctx: BaseContext): boolean {
  if (when.selection && !matchSelection(when.selection, ctx)) return false;
  if (when.clipboard === "hasItems" && ctx.clipboard.items.length === 0) return false;
  return true;
}

/** Expand a leading "~" in a path to the user's home directory. */
export function expandHome(path: string, homeDir: string): string {
  if (path === "~") return homeDir;
  if (path.startsWith("~/")) return `${homeDir}${path.slice(1)}`;
  return path;
}

/**
 * Evaluate a column's directory-level gate against the current directory,
 * host-side. Omitting both fields means "show in every directory"; otherwise
 * the directory must satisfy at least one declared constraint.
 */
export function dirMatches(m: ColumnDirMatch | undefined, dir: string, homeDir: string): boolean {
  if (!m || (!m.pathPrefixes && !m.pathContains)) return true;
  if (m.pathPrefixes?.some((p) => dir.startsWith(expandHome(p, homeDir)))) return true;
  if (m.pathContains?.some((s) => dir.includes(s))) return true;
  return false;
}

function matchSelection(sel: NonNullable<WhenClause["selection"]>, ctx: BaseContext): boolean {
  const items = ctx.selectedItems;
  const n = items.length;
  switch (sel) {
    case "any":        return true;
    case "none":       return n === 0;
    case "some":       return n > 0;
    case "single":     return n === 1;
    case "multiple":   return n > 1;
    case "singleDir":  return n === 1 && items[0].isDir;
    case "singleFile": return n === 1 && !items[0].isDir;
    case "files":      return n > 0 && items.every((i) => !i.isDir);
    case "dirs":       return n > 0 && items.every((i) => i.isDir);
    default:           return true;
  }
}
