import { invoke } from "@tauri-apps/api/core";
import type { InstalledMeta, ResolvedModule } from "./types";

// =============================================================================
// INSTALL — persist a validated, already-downloaded module to disk and return
// its install metadata. The source was fetched by a discovery source and
// validated in a throwaway worker; here we only write the bytes via the Rust
// install_module command, which sandboxes writes to ~/.mutka/modules/<id>/.
// =============================================================================

/** "owner/repo" for a GitHub URL, else the URL itself, for display provenance. */
function originFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const m = url.match(/github\.com\/([^/]+\/[^/]+)/);
  return m ? m[1] : url;
}

/** Write a resolved module to ~/.mutka/modules/<id>/index.js. Returns its provenance. */
export async function writeModule(resolved: ResolvedModule): Promise<InstalledMeta> {
  await invoke("install_module", { id: resolved.manifest.id, source: resolved.source });
  return {
    sourceId: resolved.listing.sourceId,
    ref: resolved.listing.ref,
    origin: originFromUrl(resolved.listing.homepageUrl),
    installedAt: new Date().toISOString(),
  };
}
