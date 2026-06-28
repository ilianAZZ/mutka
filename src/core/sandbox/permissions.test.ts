import { describe, it, expect, beforeEach, vi } from "vitest";

// The gateway/capabilities graph reaches a couple of native modules at import
// time; stub them so the table builds in jsdom. `invoke` is the Tauri IPC bridge —
// we record its calls to prove a capability actually ran (i.e. passed the gate).
const invoke = vi.fn(async (cmd: string, _args?: unknown): Promise<unknown> => {
  if (cmd === "http_request") return { status: 200, headers: {}, bodyBase64: "" };
  if (cmd === "read_dir") return [];
  return null;
});
vi.mock("@tauri-apps/api/core", () => ({ invoke: (cmd: string, args?: unknown) => invoke(cmd, args) }));
vi.mock("@crabnebula/tauri-plugin-drag", () => ({ startDrag: vi.fn() }));

import { dispatchCapability } from "./gateway";
import { ModulesStore } from "../stores/ModulesStore";
import type { SandboxManifest } from "./protocol";
import type { ModulePermission } from "../module-registry/module-registry.types";

/** A minimal manifest declaring exactly `permissions` (id defaults, overridable). */
function manifest(permissions: ModulePermission[], id = "test.module"): SandboxManifest {
  return {
    id,
    name: id,
    version: "1.0.0",
    permissions,
    commands: [],
    openHandlers: [],
    sidebarItems: [],
    fileSystemProviders: [],
    fileIcons: [],
    columns: [],
    panels: [],
    settingsSections: [],
    discoverySources: [],
    moduleManagerButtons: [],
  };
}

/** The last `req` object passed to invoke("http_request", { req }). */
function lastHttpReq(): { allowPublic?: boolean; allowLocal?: boolean } {
  const call = [...invoke.mock.calls].reverse().find((c) => c[0] === "http_request");
  const args = call?.[1] as { req: { allowPublic?: boolean; allowLocal?: boolean } } | undefined;
  return args?.req ?? {};
}

beforeEach(() => {
  invoke.mockClear();
  localStorage.clear();
});

// ─── Filesystem read/write are gated by fs:read / fs:write ────────────────────
describe("fs permissions", () => {
  it("denies fs.readDir without fs:read", async () => {
    await expect(dispatchCapability(manifest([]), "fs", "readDir", ["/tmp"])).rejects.toThrow(
      /Permission denied/
    );
    expect(invoke).not.toHaveBeenCalled();
  });

  it("allows fs.readDir with fs:read (reaches the read_dir command)", async () => {
    await dispatchCapability(manifest(["fs:read"]), "fs", "readDir", ["/tmp"]);
    expect(invoke).toHaveBeenCalledWith("read_dir", expect.objectContaining({ path: "/tmp" }));
  });

  it("denies fs.deleteItem without fs:write (even with fs:read)", async () => {
    await expect(
      dispatchCapability(manifest(["fs:read"]), "fs", "deleteItem", ["/tmp/x"])
    ).rejects.toThrow(/Permission denied/);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("allows fs.deleteItem with fs:write", async () => {
    await dispatchCapability(manifest(["fs:write"]), "fs", "deleteItem", ["/tmp/x"]);
    expect(invoke).toHaveBeenCalledWith("delete_item", expect.objectContaining({ path: "/tmp/x" }));
  });
});

// ─── Network is gated by network:public / network:local, with tier flags ──────
describe("network permissions", () => {
  it("denies net.request without any network permission", async () => {
    await expect(
      dispatchCapability(manifest([]), "net", "request", [{ url: "https://example.com" }])
    ).rejects.toThrow(/Permission denied/);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("network:public passes allowPublic=true, allowLocal=false to Rust", async () => {
    await dispatchCapability(manifest(["network:public"]), "net", "request", [
      { url: "https://example.com" },
    ]);
    expect(lastHttpReq()).toMatchObject({ allowPublic: true, allowLocal: false });
  });

  it("network:local passes allowLocal=true, allowPublic=false to Rust", async () => {
    await dispatchCapability(manifest(["network:local"]), "net", "request", [
      { url: "http://127.0.0.1:8080" },
    ]);
    expect(lastHttpReq()).toMatchObject({ allowPublic: false, allowLocal: true });
  });

  it("declaring both tiers passes both flags", async () => {
    await dispatchCapability(manifest(["network:public", "network:local"]), "net", "request", [
      { url: "https://example.com" },
    ]);
    expect(lastHttpReq()).toMatchObject({ allowPublic: true, allowLocal: true });
  });
});

// ─── dialog.pickFile is gated by the dialog permission ───────────────────────
describe("dialog.pickFile permission", () => {
  it("denies dialog.pickFile without the dialog permission", async () => {
    await expect(
      dispatchCapability(manifest([]), "dialog", "pickFile", [{ fileNames: ["index.js"] }])
    ).rejects.toThrow(/Permission denied/);
  });

  it("allows it with the dialog permission (resolves via the AppBridge stub)", async () => {
    // No App connected in the test → AppBridge's empty provider resolves null.
    const result = await dispatchCapability(manifest(["dialog"]), "dialog", "pickFile", [{}]);
    expect(result).toBeNull();
  });
});

// ─── modules.install is gated by discovery, and routes to the review flow ─────
describe("modules.install permission", () => {
  it("denies modules.install without discovery", async () => {
    await expect(
      dispatchCapability(manifest([]), "modules", "install", ["export default {}"])
    ).rejects.toThrow(/Permission denied/);
  });

  it("allows it with discovery and queues the source for the review dialog", async () => {
    await dispatchCapability(manifest(["discovery"]), "modules", "install", ["export default {id:'x'}"]);
    expect(ModulesStore.takePendingInstall()).toBe("export default {id:'x'}");
  });
});

// ─── Per-module config namespacing (the dot-collision fix) ────────────────────
describe("config namespacing", () => {
  it("denies config.set without storage", async () => {
    await expect(
      dispatchCapability(manifest([]), "config", "set", ["k", "v"])
    ).rejects.toThrow(/Permission denied/);
  });

  it("isolates two modules whose id+key would collide under a '.' delimiter", async () => {
    // Under the old "mutka.modcfg.<id>.<key>" scheme these two would map to the
    // SAME localStorage key; with the ":" delimiter they must not.
    await dispatchCapability(manifest(["storage"], "com"), "config", "set", ["acme.vault.x", "A"]);
    await dispatchCapability(manifest(["storage"], "com.acme.vault"), "config", "set", ["x", "B"]);

    const a = await dispatchCapability(manifest(["storage"], "com"), "config", "get", ["acme.vault.x"]);
    const b = await dispatchCapability(
      manifest(["storage"], "com.acme.vault"),
      "config",
      "get",
      ["x"]
    );
    expect(a).toBe("A");
    expect(b).toBe("B"); // would be "A" (collision) under the old delimiter
  });
});
