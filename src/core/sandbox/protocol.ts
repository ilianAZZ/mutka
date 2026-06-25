// =============================================================================
// SANDBOX PROTOCOL — the only contract crossing the host ↔ worker boundary.
//
// A community module runs in a Web Worker (no DOM, no invoke, no core imports).
// Its single window on the world is postMessage. Everything below is what may
// legally cross that wire — all of it must be structured-clone serializable.
// A built-in module uses the same shapes via LocalHost (no wire, direct calls).
// =============================================================================

import type { ModulePermission, SidebarItem } from "../module-registry/module-registry.types";
import type { FileItem, ClipboardState } from "../types";
import type { MenuZone } from "../menu/menuZone";

// ─── Declarative "when" clause (predicates can't cross the worker boundary) ──
// VS Code uses string when-clauses for exactly this reason: a function can't be
// serialized, so visibility is described as data and evaluated host-side.

export type WhenSelection =
  | "any"        // always
  | "none"       // nothing selected
  | "some"       // one or more selected
  | "single"     // exactly one item
  | "multiple"   // two or more
  | "singleDir"  // exactly one, a directory
  | "singleFile" // exactly one, a file
  | "files"      // one+ and all are files
  | "dirs";      // one+ and all are directories

export interface WhenClause {
  selection?: WhenSelection;
  /** Gate on clipboard contents (for a Paste command). */
  clipboard?: "hasItems";
}

// ─── A command contributed by a module ───────────────────────────────────────

export interface SandboxCommand {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  contextMenu?: boolean;
  contextMenuCategory?: string;
  /**
   * Which UI regions this command appears in when right-clicked. Omit to use the
   * default (file rows + empty file-list background). Use e.g. ["breadcrumb"] to
   * target the path bar, or ["sidebar"] for a panel. See core/menu/menuZone.ts.
   */
  contextMenuZones?: MenuZone[];
  when?: WhenClause;
}

// ─── An open handler (double-click behavior) contributed by a module ─────────
// `match` is the serializable predicate the host evaluates; `handler` is the id
// the module registered via host.onOpen() to run when an item matches.

export interface SandboxOpenMatch {
  isDir?: boolean;
  extensions?: string[];
  /** Match macOS packages/bundles (.app, …). Use `false` to exclude them. */
  isPackage?: boolean;
}

export interface SandboxOpenHandler {
  id: string;
  priority?: number;
  match: SandboxOpenMatch;
  handler: string;
}

// ─── A file-type icon contributed by a module ────────────────────────────────
// Lets a module ship its own logo for a set of extensions, overriding the native
// macOS icon. `image` is a base64 data-URI (data:image/...;base64,...) so it
// crosses the worker boundary as plain data and renders via <img src> only —
// never innerHTML — which makes it injection-safe even for SVG images.

export interface FileIconContribution {
  /** Extensions (without dot, case-insensitive) this icon applies to, e.g. ["pdf"]. */
  extensions: string[];
  /** The icon image as a data:image/...;base64,... URI. */
  image: string;
}

// ─── What a module reports about itself after loading ────────────────────────

export interface SandboxManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  permissions: ModulePermission[];
  commands: SandboxCommand[];
  openHandlers: SandboxOpenHandler[];
  /** Declarative left-sidebar entries. */
  sidebarItems: SidebarItem[];
  /** URI schemes this module provides a virtual file system for (LocalHost only). */
  fileSystemProviders: string[];
  /** File-type icon overrides (by extension) this module contributes. */
  fileIcons: FileIconContribution[];
}

/** Serializable snapshot of app state handed to a command when it runs. */
export interface HostSnapshot {
  selectedItems: FileItem[];
  /** The current directory's visible items, in display order (sorted/filtered). */
  orderedItems: FileItem[];
  currentDirectory: string;
  clipboard: ClipboardState;
}

// ─── Wire messages ───────────────────────────────────────────────────────────

export type WorkerToHost =
  | { t: "ready"; manifest: SandboxManifest }
  | { t: "host-call"; id: number; cap: string; method: string; args: unknown[] }
  | { t: "subscribe"; event: string }
  | { t: "sidebar"; items: SidebarItem[] }
  | { t: "log"; level: "log" | "warn" | "error"; args: unknown[] }
  | { t: "fatal"; message: string };

export type HostToWorker =
  | { t: "load"; source: string }
  | { t: "host-result"; id: number; ok: true; value: unknown }
  | { t: "host-result"; id: number; ok: false; error: string }
  | { t: "run"; commandId: string; snapshot: HostSnapshot }
  | { t: "open"; handlerId: string; item: FileItem }
  | { t: "event"; event: string; payload: unknown };
