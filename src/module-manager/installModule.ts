import { invoke } from "@tauri-apps/api/core";
import type { InstalledMeta, ResolvedModule } from "./types";

// =============================================================================
// INSTALL — persist a validated, already-downloaded module to disk and return
// its install metadata. The source was fetched by a discovery source and
// validated in a throwaway worker; here we only write the bytes via the Rust
// install_module command, which sandboxes writes to ~/.mutka/modules/<id>/.
// =============================================================================

/** Write a resolved module to ~/.mutka/modules/<id>/index.js. Returns its provenance. */
export async function writeModule(resolved: ResolvedModule): Promise<InstalledMeta> {
  await invoke("install_module", { id: resolved.manifest.id, source: resolved.source });
  return {
    sourceId: resolved.listing.sourceId,
    ref: resolved.listing.ref,
    // The source supplies display provenance (e.g. "owner/repo"); the generic
    // install layer never parses a source-specific URL. Fall back to homepageUrl.
    origin: resolved.listing.provenance ?? resolved.listing.homepageUrl,
    installedAt: new Date().toISOString(),
  };
}
