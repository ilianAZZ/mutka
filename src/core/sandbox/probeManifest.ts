import type { SandboxManifest, WorkerToHost } from "./protocol";

// =============================================================================
// PROBE MANIFEST — load a module's source in a THROWAWAY worker and return its
// manifest, or throw if it fails to load. This validates a download ("is this a
// real module?") and reads metadata without running the module live. The worker
// is terminated either way: nothing it does reaches the system (same isolation
// as SandboxHost, no register()).
//
// Lives in core so it can back both the install pipeline AND the `modules.probe`
// capability a discovery module uses to read listings' metadata.
// =============================================================================

const PROBE_TIMEOUT_MS = 5000;

/** Upper bound on a module source we'll load into a probe worker. A module is one
 *  ESM file; this stops an oversized/hostile source from bloating the worker. Keep
 *  in sync with `MAX_MODULE_SOURCE_BYTES` in `src-tauri/src/modules.rs`. */
const MAX_MODULE_SOURCE_BYTES = 5 * 1024 * 1024;

export function probeManifest(source: string): Promise<SandboxManifest> {
  if (source.length > MAX_MODULE_SOURCE_BYTES) {
    return Promise.reject(new Error(`Module source too large (> ${MAX_MODULE_SOURCE_BYTES} bytes)`));
  }
  return new Promise<SandboxManifest>((resolve, reject) => {
    const worker = new Worker(new URL("./sandbox.worker.ts", import.meta.url), {
      type: "module",
    });

    const done = (fn: () => void): void => {
      clearTimeout(timer);
      worker.terminate();
      fn();
    };

    const timer = setTimeout(
      () => done(() => reject(new Error("Module did not load within 5s"))),
      PROBE_TIMEOUT_MS
    );

    worker.onmessage = (e: MessageEvent<WorkerToHost>): void => {
      const msg = e.data;
      if (msg.t === "ready") done(() => resolve(msg.manifest));
      else if (msg.t === "fatal") done(() => reject(new Error(msg.message)));
    };
    worker.onerror = (e): void => done(() => reject(new Error(e.message || "Worker error")));

    worker.postMessage({ t: "load", source });
  });
}
