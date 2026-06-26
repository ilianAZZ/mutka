import { invoke } from "@tauri-apps/api/core";
import type { CatalogEntry, InstalledMeta, ResolvedModule } from "./types";

// =============================================================================
// INSTALL — persist a validated, already-downloaded module to disk and return
// its install metadata. The source was downloaded + validated by the catalog
// (loaded in a throwaway worker); here we only write the bytes via the Rust
// install_module command, which sandboxes writes to ~/.mutka/modules/<id>/.
// =============================================================================

/** Write a resolved module to ~/.mutka/modules/<id>/index.js. Returns its provenance. */
export async function writeModule(
  resolved: ResolvedModule,
  entry: CatalogEntry
): Promise<InstalledMeta> {
  await invoke("install_module", { id: resolved.id, source: resolved.source });
  return {
    repo: entry.repo,
    ref: entry.defaultBranch,
    entry: resolved.entry,
    installedAt: new Date().toISOString(),
  };
}
