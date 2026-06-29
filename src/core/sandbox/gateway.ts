import { createCapabilityTable } from "./capabilities";
import type { CapabilityDef } from "./capabilities";
import type { SandboxManifest } from "./protocol";

const capabilities = createCapabilityTable();

/**
 * THE PERMISSION BARRIER — shared by every runtime (worker and local).
 *
 * A module asks for a capability; this checks the requested capability exists
 * and that the module DECLARED the permission it requires, then runs it. No
 * declaration → it throws and the operation never happens. Built-in and
 * community modules are gated identically; only how they call this differs.
 *
 * `cap` and `method` are `string` because SandboxHost receives them from the
 * wire (postMessage). The runtime check below validates they exist in the
 * table. Compile-time safety lives in `hostProxy.ts`, where `call()` is typed
 * against `CapabilityMethodMap`.
 */
export async function dispatchCapability(
  manifest: SandboxManifest,
  cap: string,
  method: string,
  args: unknown[]
): Promise<unknown> {
  const group = (capabilities as Record<string, Record<string, CapabilityDef>>)[cap];
  const def = group?.[method];
  if (!def) {
    throw new Error(`Unknown capability "${cap}.${method}"`);
  }
  // A capability requires one permission, or — when it lists an array — ANY one of
  // them (e.g. net.request accepts network:public OR network:local; which the
  // module holds then bounds what the operation may do, enforced downstream).
  const required = Array.isArray(def.permission) ? def.permission : [def.permission];
  if (!required.some((p) => manifest.permissions.includes(p))) {
    throw new Error(
      `Permission denied: "${cap}.${method}" requires ${required.map((p) => `"${p}"`).join(" or ")}, ` +
      `which "${manifest.id}" did not declare.`
    );
  }
  return def.run(args, manifest.id, manifest.permissions);
}
