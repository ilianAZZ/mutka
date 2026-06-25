import { createCapabilityTable } from "./capabilities";
import type { SandboxManifest } from "./protocol";

const capabilities = createCapabilityTable();

/**
 * THE PERMISSION BARRIER — shared by every runtime (worker and local).
 *
 * A module asks for a capability; this checks the requested capability exists
 * and that the module DECLARED the permission it requires, then runs it. No
 * declaration → it throws and the operation never happens. Built-in and
 * community modules are gated identically; only how they call this differs.
 */
export async function dispatchCapability(
  manifest: SandboxManifest,
  cap: string,
  method: string,
  args: unknown[]
): Promise<unknown> {
  const def = capabilities[cap]?.[method];
  if (!def) {
    throw new Error(`Unknown capability "${cap}.${method}"`);
  }
  if (!manifest.permissions.includes(def.permission)) {
    throw new Error(
      `Permission denied: "${cap}.${method}" requires "${def.permission}", ` +
      `which "${manifest.id}" did not declare.`
    );
  }
  return def.run(args, manifest.id);
}
