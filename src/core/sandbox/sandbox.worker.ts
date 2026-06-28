/// <reference lib="webworker" />
// =============================================================================
// SANDBOX WORKER — the isolated realm where a community module's code runs.
//
// It has NO DOM, NO `invoke`, NO reference to the core. It receives the module
// source as a string, imports it from a blob URL, reports the manifest, runs
// setup() with an RPC-only host, and forwards command runs, open handlers and
// whitelisted events. Nothing the module does reaches the system except by
// asking the host (which checks permissions).
// =============================================================================

import { createHostProxy, type CommandHandler, type OpenHandler, type EventHandler, type ColumnProvider, type UIEventHandler, type ProviderHandler, type DiscoverHandler, type FetchSourceHandler } from "./hostProxy";
import type { HostToWorker, WorkerToHost, SandboxManifest } from "./protocol";

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (m: WorkerToHost): void => ctx.postMessage(m);

// =============================================================================
// NO NATIVE NETWORK FROM A MODULE.
//
// A community module must NEVER make its own network calls — not `fetch`,
// `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`, WebRTC,
// a nested `Worker`, nor a remote dynamic `import()`. CORS does NOT make these
// safe: it blocks READING a cross-origin reply, not SENDING the request, so they
// would be an ungated exfiltration channel that defeats the `network` permission.
//
// The ONLY sanctioned egress is `host.net.*`, which the gateway checks against the
// `network` permission and which runs in Rust (see capabilities.ts → http.rs).
//
// This is NOT enforced here by deleting globals (a denylist of API names is
// fragile — easy to miss one, and it grows as the platform adds APIs). It is
// enforced at the engine level by the app Content-Security-Policy: `connect-src`
// is restricted to the Tauri IPC bridge (so no other host is reachable) and
// `script-src` forbids remote origins (so remote `import()` can't load code).
// WebKit applies that policy below JavaScript, in the worker realm too, so no
// string trick / `eval` / `Function` can get around it. See
// src-tauri/tauri.conf.json (`app.security.csp`) and docs/safety.md.
// =============================================================================

const commands = new Map<string, CommandHandler>();
const opens = new Map<string, OpenHandler>();
const columns = new Map<string, ColumnProvider>();
const uiEvents = new Map<string, UIEventHandler>();
const providers = new Map<string, ProviderHandler>(); // `${scheme}:${method}` → handler
const discoveries = new Map<string, DiscoverHandler | FetchSourceHandler>(); // `${sourceId}:${method}` → handler
const events = new Map<string, EventHandler>();
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();
let callSeq = 0;

function callHost(cap: string, method: string, args: unknown[]): Promise<unknown> {
  const id = ++callSeq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    post({ t: "host-call", id, cap, method, args });
  });
}

ctx.onmessage = async (e: MessageEvent<HostToWorker>): Promise<void> => {
  const msg = e.data;
  switch (msg.t) {
    case "load":
      await loadModule(msg.source);
      break;
    case "host-result": {
      const r = pending.get(msg.id);
      if (!r) return;
      pending.delete(msg.id);
      if (msg.ok) r.resolve(msg.value);
      else r.reject(new Error(msg.error));
      break;
    }
    case "run":
      await safeRun(commands.get(msg.commandId), msg.snapshot, `command "${msg.commandId}"`);
      break;
    case "open":
      await safeRun(opens.get(msg.handlerId), msg.item, `open handler "${msg.handlerId}"`);
      break;
    case "column": {
      const provider = columns.get(msg.columnId);
      try {
        const value = provider ? (await provider(msg.item)) ?? null : null;
        post({ t: "column-result", id: msg.id, ok: true, value });
      } catch (err) {
        post({ t: "column-result", id: msg.id, ok: false, error: String(err) });
      }
      break;
    }
    case "ui-event":
      await safeRun(uiEvents.get(msg.handler), msg.value, `ui-event "${msg.handler}"`);
      break;
    case "provider": {
      const handler = providers.get(`${msg.scheme}:${msg.method}`);
      if (!handler) {
        post({ t: "provider-result", id: msg.id, ok: false, error: `provider "${msg.scheme}" has no "${msg.method}" handler` });
        break;
      }
      try {
        const value = await (handler as (...a: unknown[]) => unknown)(...msg.args);
        post({ t: "provider-result", id: msg.id, ok: true, value: value ?? null });
      } catch (err) {
        post({ t: "provider-result", id: msg.id, ok: false, error: String(err) });
      }
      break;
    }
    case "discovery": {
      const handler = discoveries.get(`${msg.sourceId}:${msg.method}`);
      if (!handler) {
        post({ t: "discovery-result", id: msg.id, ok: false, error: `discovery source "${msg.sourceId}" has no "${msg.method}" handler` });
        break;
      }
      try {
        const value = await (handler as (...a: unknown[]) => unknown)(...msg.args);
        post({ t: "discovery-result", id: msg.id, ok: true, value });
      } catch (err) {
        post({ t: "discovery-result", id: msg.id, ok: false, error: String(err) });
      }
      break;
    }
    case "event": {
      const handler = events.get(msg.event);
      if (handler) handler(msg.payload);
      break;
    }
  }
};

async function safeRun<A>(fn: ((arg: A) => void | Promise<void>) | undefined, arg: A, label: string): Promise<void> {
  if (!fn) return;
  try {
    await fn(arg);
  } catch (err) {
    post({ t: "log", level: "error", args: [`${label} failed:`, String(err)] });
  }
}

interface RawModule {
  id: string;
  name?: string;
  version?: string;
  description?: string;
  icon?: SandboxManifest["icon"];
  author?: SandboxManifest["author"];
  tags?: SandboxManifest["tags"];
  permissions?: SandboxManifest["permissions"];
  commands?: SandboxManifest["commands"];
  openHandlers?: SandboxManifest["openHandlers"];
  sidebarItems?: SandboxManifest["sidebarItems"];
  fileSystemProviders?: SandboxManifest["fileSystemProviders"];
  fileIcons?: SandboxManifest["fileIcons"];
  columns?: SandboxManifest["columns"];
  panels?: SandboxManifest["panels"];
  settingsSections?: SandboxManifest["settingsSections"];
  discoverySources?: SandboxManifest["discoverySources"];
  moduleManagerButtons?: SandboxManifest["moduleManagerButtons"];
  setup?: (host: ReturnType<typeof createHostProxy>) => void | Promise<void>;
}

async function loadModule(source: string): Promise<void> {
  try {
    const url = URL.createObjectURL(new Blob([source], { type: "application/javascript" }));
    const mod = (await import(/* @vite-ignore */ url)) as { default?: RawModule };
    URL.revokeObjectURL(url);

    const def = mod.default;
    if (!def || typeof def !== "object" || typeof def.id !== "string") {
      throw new Error("module must `export default` an object with a string `id`");
    }

    const manifest: SandboxManifest = {
      id: def.id,
      name: def.name ?? def.id,
      version: def.version ?? "0.0.0",
      description: def.description,
      icon: def.icon,
      author: def.author,
      tags: def.tags,
      permissions: def.permissions ?? [],
      commands: def.commands ?? [],
      openHandlers: def.openHandlers ?? [],
      sidebarItems: def.sidebarItems ?? [],
      fileSystemProviders: def.fileSystemProviders ?? [],
      fileIcons: def.fileIcons ?? [],
      columns: def.columns ?? [],
      panels: def.panels ?? [],
      settingsSections: def.settingsSections ?? [],
      discoverySources: def.discoverySources ?? [],
      moduleManagerButtons: def.moduleManagerButtons ?? [],
    };
    // Report BEFORE setup runs, so the host knows this module's permissions
    // before any host-call can be served.
    post({ t: "ready", manifest });

    const host = createHostProxy({
      callHost,
      registerCommand: (id, fn) => commands.set(id, fn),
      registerOpen: (id, fn) => opens.set(id, fn),
      registerColumn: (id, fn) => columns.set(id, fn),
      registerUIEvent: (id, fn) => uiEvents.set(id, fn),
      registerProvider: (scheme, method, fn) => providers.set(`${scheme}:${method}`, fn),
      registerDiscovery: (sourceId, method, fn) => discoveries.set(`${sourceId}:${method}`, fn),
      setSidebarItems: (items) => post({ t: "sidebar", items }),
      subscribe: (event, fn) => { events.set(event, fn); post({ t: "subscribe", event }); },
      post,
    });
    if (typeof def.setup === "function") await def.setup(host);
  } catch (err) {
    post({ t: "fatal", message: String(err) });
  }
}
