// Moved to core/sandbox/probeManifest.ts (it now backs both the install pipeline
// and the `modules.probe` capability a discovery module uses). Re-exported here
// so existing importers (descriptors.ts, …) keep working.
export { probeManifest } from "../core/sandbox/probeManifest";
