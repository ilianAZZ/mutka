// =============================================================================
// SANDBOX PROTOCOL — the only contract crossing the host ↔ worker boundary.
//
// A community module runs in a Web Worker (no DOM, no invoke, no core imports).
// Its single window on the world is postMessage. Everything below is what may
// legally cross that wire — all of it must be structured-clone serializable.
// A built-in module uses the same shapes via LocalHost (no wire, direct calls).
// =============================================================================

import type { ModulePermission, SidebarItem } from "../module-registry/public-types";
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
  /** Only when EVERY selected item's file name is one of these (e.g. ["index.js"]
   *  to show an action only on module files). Case-sensitive. */
  fileNames?: string[];
  /** Only when EVERY selected item's extension is one of these (lowercased, no dot,
   *  e.g. ["js"]). */
  extensions?: string[];
}

// ─── A command contributed by a module ───────────────────────────────────────

export interface SandboxCommand<Id extends string = string> {
  id: Id;
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

// ─── A custom list-view column contributed by a module ───────────────────────
// Two-level, fully declarative applicability (no predicate crosses the wire):
//   • dirMatch  — whether the WHOLE column appears in a given directory.
//   • cellMatch — which items get a computed value (reuses the open-handler
//                 match shape). When it fails, the cell is empty and the
//                 module's value provider is NEVER invoked for that item — so a
//                 module never tries to decode a file that makes no sense to it.
// The value itself is produced by host.onColumn(id, item → ColumnCell), run in
// the module's runtime and returned over the `column` round-trip below.

/** Gate a column on the current directory. Omit a field to not constrain it. */
export interface ColumnDirMatch {
  /** Show only under these path prefixes (a leading "~" is expanded host-side). */
  pathPrefixes?: string[];
  /** …or when the directory path contains one of these substrings. */
  pathContains?: string[];
}

/** What a single cell renders — plain data, shown via text / <img src> only. */
export interface ColumnCell {
  /** Primary text of the cell. */
  text?: string;
  /** A data:image/...;base64 icon (injection-safe, rendered via <img src>). */
  icon?: string;
  /** Text colour — MUST be a `var(--...)` token; anything else is dropped. */
  tint?: string;
  /** A short pill (e.g. "⤓", "3"). */
  badge?: string;
}

export interface ColumnContribution {
  /** Unique column id, e.g. "com.exif.dimensions". */
  id: string;
  /** Header label. */
  label: string;
  /** Default width in px (defaults to 100). */
  width?: number;
  /** Cell alignment. */
  align?: "start" | "end";
  /** Directory-level gate. Omit to show in every directory. */
  dirMatch?: ColumnDirMatch;
  /** Item-level gate. Omit to compute a value for every item. */
  cellMatch?: SandboxOpenMatch;
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

// ─── Declarative UI (a serializable view tree) ───────────────────────────────
// A sandboxed module cannot hand a React component across postMessage, so its UI
// is described as DATA — a tree of UINodes — and the host renders it with native
// Liquid Glass components. The same tree fills a right-pane panel, a popup, a
// settings section, or a status-bar popover. Interactions reference an `action`
// id the module registered with host.onUIEvent(id, …); the host posts the event
// back to the module's runtime. Everything here is structured-clone safe.

/** Text emphasis for a `text` node. */
export type UITextWeight = "normal" | "medium" | "bold";
/** Relative text size for a `text` node. */
export type UITextSize = "sm" | "md" | "lg";
/** Visual intent for a `button` node. */
export type UIButtonVariant = "default" | "primary" | "danger";

/** One row in a `list` node — clicking it fires `action` with `value` (or `id`). */
export interface UIListItem {
  id: string;
  label: string;
  detail?: string;
  /** Icon registry key or emoji. */
  icon?: string;
  /** Text colour — MUST be a `var(--…)` token; anything else is dropped. */
  tint?: string;
  /** UI-event handler id fired on click (registered via host.onUIEvent). */
  action?: string;
  /** Payload passed to the handler; defaults to the item's `id`. */
  value?: unknown;
}

/** A single declarative UI node. Rendered host-side, never as innerHTML. */
export type UINode =
  | { type: "vstack"; gap?: number; children: UINode[] }
  | { type: "hstack"; gap?: number; align?: "start" | "center" | "end"; children: UINode[] }
  | { type: "text"; text: string; tint?: string; weight?: UITextWeight; size?: UITextSize; muted?: boolean }
  | { type: "row"; label: string; value?: string; icon?: string }
  | { type: "button"; label: string; action: string; icon?: string; variant?: UIButtonVariant; value?: unknown }
  | { type: "list"; items: UIListItem[] }
  | { type: "badge"; text: string; tint?: string }
  | { type: "icon"; name: string }
  | { type: "divider" }
  | { type: "spacer"; size?: number }
  /** An image — `src` MUST be a data:image/… URI (rendered via <img src> only). */
  | { type: "image"; src: string; alt?: string }
  /** A form built from a JSON-Schema subset; submitting fires `action` with the values object. */
  | { type: "form"; schema: FormSchema; action: string; submitLabel?: string };

// ─── Form schema (a JSON-Schema Draft-7 subset) ──────────────────────────────
// The standard, serializable wire format for module forms. Module authors may
// generate it from zod (zod v4 `z.toJSONSchema()` or `zod-to-json-schema`) — the
// host never imports zod, it only renders this shape. On submit the host returns
// the collected values to the module, which can re-validate with its own schema.

/** Renders as: text input, number input, checkbox, or (with `enum`) a select. */
export interface FormProperty {
  type: "string" | "number" | "integer" | "boolean";
  title?: string;
  description?: string;
  default?: string | number | boolean;
  /** Allowed values → rendered as a select. */
  enum?: string[];
  /** Optional labels parallel to `enum` (falls back to the value). */
  enumLabels?: string[];
  /** String rendering hint. `textarea` → multiline, `password` → masked. */
  format?: "password" | "textarea" | "email" | "path";
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

export interface FormSchema {
  type: "object";
  properties: Record<string, FormProperty>;
  /** Keys that must be non-empty before the form can submit. */
  required?: string[];
}

// ─── A right/left-pane panel a module contributes (filled with a UINode) ──────

export interface PanelContribution {
  /** Surface id — render into it via host.ui.render(id, node). */
  id: string;
  /** Tab tooltip / accessible label. */
  title: string;
  /** Icon registry key or emoji shown in the sidebar tab strip. */
  icon: string;
  /** Preferred edge. Defaults to "right". */
  side?: "left" | "right";
  /** Default panel width in px (clamped 180–480). */
  defaultWidth?: number;
}

// ─── A settings section a module contributes (filled with a UINode) ───────────

export interface SettingsSectionContribution {
  /** Surface id — render into it via host.ui.render(id, node). */
  id: string;
  /** Section header shown in the Settings panel. */
  title: string;
}

// ─── A bottom status-bar item a module contributes (dynamic, via capability) ──

/** What happens when a status-bar item is clicked. */
export type StatusBarAction =
  | { command: string }   // run a registered command id
  | { popover: string };  // open a popover rendering the UINode at this surface id

export interface StatusBarItem {
  /** Unique within the owning module. */
  id: string;
  text?: string;
  /** Icon registry key or emoji. */
  icon?: string;
  /** Text/icon colour — MUST be a `var(--…)` token; anything else is dropped. */
  tint?: string;
  /** A short pill (e.g. "↑2", "3"). */
  badge?: string;
  tooltip?: string;
  /** Which end of the bar. Defaults to "right". */
  side?: "left" | "right";
  onClick?: StatusBarAction;
}

// ─── What a module reports about itself after loading ────────────────────────

/** Who made a module, for display in the Modules UI. All fields optional and
 *  source-agnostic — no field is specific to GitHub or any other host. */
export interface ModuleAuthor {
  /** Display name shown on the card. Clicking it opens `link`. */
  name?: string;
  /** Where clicking the name goes — any http(s) URL: a personal site, a profile
   *  page (GitHub/GitLab/Mastodon/…), anything. Non-http(s) values are ignored. */
  link?: string;
  /** Avatar image: an http(s) URL OR a `data:image/...` URI (base64 or
   *  URL-encoded). Rendered via <img src> only; any other value is ignored. */
  avatar?: string;
}

export interface SandboxManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  /** Card image: an http(s) URL OR a `data:image/...` URI (base64 or
   *  URL-encoded). Rendered via <img src> only and scheme-checked, so it is
   *  injection-safe; any other value is ignored. */
  icon?: string;
  /** Author shown in the Modules UI (avatar + profile link). */
  author?: ModuleAuthor;
  /** Free-form tags for discovery filtering (e.g. ["files", "git"]). */
  tags?: string[];
  permissions: ModulePermission[];
  commands: SandboxCommand[];
  openHandlers: SandboxOpenHandler[];
  /** Declarative left-sidebar entries. */
  sidebarItems: SidebarItem[];
  /** URI schemes this module provides a virtual file system for. */
  fileSystemProviders: string[];
  /** File-type icon overrides (by extension) this module contributes. */
  fileIcons: FileIconContribution[];
  /** Custom list-view columns this module contributes. */
  columns: ColumnContribution[];
  /** Declarative side-pane panels this module contributes. */
  panels: PanelContribution[];
  /** Declarative settings sections this module contributes. */
  settingsSections: SettingsSectionContribution[];
  /** Module-discovery sources this module contributes (served over host RPC). */
  discoverySources: DiscoverySourceDecl[];
  /** Buttons this module adds to the Modules overlay (Browse tab). */
  moduleManagerButtons: ModuleManagerButton[];
}

/** A button a module contributes to the Modules overlay. Clicking it runs the
 *  module's host.onUIEvent(id, …) handler (no payload). */
export interface ModuleManagerButton {
  id: string;
  label: string;
  /** Optional icon key from the icon registry (unknown keys render as nothing). */
  icon?: string;
}

/** A discovery source a module declares (and serves via host.onDiscover/onFetchSource). */
export interface DiscoverySourceDecl {
  id: string;
  label: string;
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
  | { t: "column-result"; id: number; ok: true; value: ColumnCell | null }
  | { t: "column-result"; id: number; ok: false; error: string }
  | { t: "column-batch-result"; id: number; ok: true; values: (ColumnCell | null)[] }
  | { t: "column-batch-result"; id: number; ok: false; error: string }
  | { t: "provider-result"; id: number; ok: true; value: unknown }
  | { t: "provider-result"; id: number; ok: false; error: string }
  | { t: "discovery-result"; id: number; ok: true; value: unknown }
  | { t: "discovery-result"; id: number; ok: false; error: string }
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
  | { t: "column"; id: number; columnId: string; item: FileItem }
  | { t: "column-batch"; id: number; columnId: string; items: FileItem[] }
  /** Run a UI-event handler the module registered with host.onUIEvent. */
  | { t: "ui-event"; handler: string; value: unknown }
  /** Ask the module's file-system provider to handle one operation. */
  | { t: "provider"; id: number; scheme: string; method: ProviderMethod; args: unknown[] }
  /** Ask the module's discovery source to discover/fetchSource. */
  | { t: "discovery"; id: number; sourceId: string; method: DiscoveryMethod; args: unknown[] }
  | { t: "event"; event: string; payload: unknown };

// ─── Host-proxied HTTP types (shared by hostProxy + capabilities) ────────────

/** Options for host.net.request — a host-proxied HTTP call (bypasses CORS). */
export interface NetRequestOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  /** Text (UTF-8) or raw bytes (e.g. from host.fs.readBytes for an upload). */
  body?: string | Uint8Array;
}

/** What host.net.request resolves to. */
export interface NetResponse {
  status: number;
  headers: Record<string, string>;
  /** Body decoded as UTF-8 text (JSON/XML/text APIs). */
  body: string;
  /** Body as raw bytes (binary downloads). */
  bytes: Uint8Array;
}

// ─── Method-name unions for wire messages ────────────────────────────────────

/** The file-system provider operations a module may implement (mirrors hostProxy). */
export type ProviderMethod =
  | "list" | "openFile" | "createFolder" | "createFile" | "deleteItem" | "renameItem" | "copyFiles" | "moveFiles";

/** The discovery operations a module may implement (mirrors hostProxy). */
export type DiscoveryMethod = "discover" | "fetchSource";
