// =============================================================================
// @mutka-explorer/module — the author-facing type surface for Mutka modules.
//
// This file re-exports ONLY the types a module author needs: the
// `SandboxModuleDef` shape (what you `export default`), the full `host` API
// handed to setup(host), every contribution / UINode / form / permission type
// they reference, and the foundation types (FileItem, …).
//
// There is NO runtime code here. Authors write `import type { … }`, which TS
// erases at compile time — so the built single-file module stays self-contained
// and the package never appears in the shipped bundle. A dts bundler rolls all
// of the below (and their transitive types) into one self-contained index.d.ts
// straight from the app source, so the types can never drift from the host.
// =============================================================================

// ─── The module definition shape + the defineModule helper ───────────────────
// `defineModule` is the ONLY runtime export (an identity function, see index.js):
// it infers your `commands[].id`s and types `host.onCommand` to them. Everything
// else in this package is types, erased at compile time.
export { defineModule } from "../../../src/core/sandbox/defineModule";
export type { SandboxModuleDef } from "../../../src/core/sandbox/defineModule";

// ─── The host object passed to setup(host) + its handler signatures ──────────
export type {
  SandboxHostApi,
  NetRequestOptions,
  NetResponse,
  ClipboardFiles,
  CloudStatus,
  CommandHandler,
  OpenHandler,
  ColumnProvider,
  EventHandler,
  UIEventHandler,
  ListHandler,
  OpenFileHandler,
  WriteHandler,
  RenameProviderHandler,
  TransferHandler,
  ProviderHandler,
  DiscoverHandler,
  FetchSourceHandler,
} from "../../../src/core/sandbox/hostProxy";

// ─── Contributions, declarative UI, forms, snapshots ─────────────────────────
export type {
  WhenClause,
  WhenSelection,
  SandboxCommand,
  SandboxOpenHandler,
  SandboxOpenMatch,
  ColumnContribution,
  ColumnDirMatch,
  ColumnCell,
  FileIconContribution,
  UINode,
  UIListItem,
  UITextWeight,
  UITextSize,
  UIButtonVariant,
  FormSchema,
  FormProperty,
  PanelContribution,
  SettingsSectionContribution,
  StatusBarItem,
  StatusBarAction,
  ModuleAuthor,
  DiscoverySourceDecl,
  ModuleManagerButton,
  HostSnapshot,
  ProviderMethod,
  DiscoveryMethod,
} from "../../../src/core/sandbox/protocol";

// ─── Foundation types ────────────────────────────────────────────────────────
export type { FileItem, ClipboardState, AppInfo } from "../../../src/core/types";

// ─── Listing / sort types (used by host.view.*) ─────────────────────────────
export type { SortKey, SortState } from "../../../src/core/stores/listing.types";

// ─── Permissions, sidebar entries, discovery queries ─────────────────────────
export type {
  ModulePermission,
  SidebarItem,
} from "../../../src/core/module-registry/public-types";
export type { MenuZone } from "../../../src/core/menu/menuZone";
export type {
  DiscoveryQuery,
  DiscoveryResult,
  ModuleListing,
  CatalogAuthor,
} from "../../../src/core/discovery/types";
