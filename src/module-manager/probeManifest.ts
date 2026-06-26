import type { SandboxManifest, WorkerToHost } from "../core/sandbox/protocol";

// =============================================================================
// PROBE MANIFEST — load a module's source in a THROWAWAY worker and return its
// manifest, or throw if it fails to load. This is how the manager validates a
// download ("is index.js working?") and how it reads metadata for a DISABLED
// module without running it live. The worker is terminated either way: nothing
// it does reaches the system (same isolation as SandboxHost, no register()).
// =============================================================================

const PROBE_TIMEOUT_MS = 5000;

/**
 * Spin up an isolated worker, load `source`, and resolve with the manifest it
 * reports (posted BEFORE setup runs, so a slow/throwing setup still validates
 * the module's shape). Rejects on a fatal load error or timeout.
 */
export function probeManifest(source: string): Promise<SandboxManifest> {
  return new Promise<SandboxManifest>((resolve, reject) => {
    const worker = new Worker(new URL("../core/sandbox/sandbox.worker.ts", import.meta.url), {
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
