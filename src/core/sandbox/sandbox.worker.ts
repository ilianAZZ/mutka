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

import { createHostProxy, type CommandHandler, type OpenHandler, type EventHandler } from "./hostProxy";
import type { HostToWorker, WorkerToHost, SandboxManifest } from "./protocol";

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (m: WorkerToHost): void => ctx.postMessage(m);

const commands = new Map<string, CommandHandler>();
const opens = new Map<string, OpenHandler>();
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
  permissions?: SandboxManifest["permissions"];
  commands?: SandboxManifest["commands"];
  openHandlers?: SandboxManifest["openHandlers"];
  sidebarItems?: SandboxManifest["sidebarItems"];
  fileSystemProviders?: SandboxManifest["fileSystemProviders"];
  fileIcons?: SandboxManifest["fileIcons"];
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
      permissions: def.permissions ?? [],
      commands: def.commands ?? [],
      openHandlers: def.openHandlers ?? [],
      sidebarItems: def.sidebarItems ?? [],
      fileSystemProviders: def.fileSystemProviders ?? [],
      fileIcons: def.fileIcons ?? [],
    };
    // Report BEFORE setup runs, so the host knows this module's permissions
    // before any host-call can be served.
    post({ t: "ready", manifest });

    const host = createHostProxy({
      callHost,
      registerCommand: (id, fn) => commands.set(id, fn),
      registerOpen: (id, fn) => opens.set(id, fn),
      registerProvider: (scheme) => post({ t: "log", level: "warn", args: [`file system providers are not supported in sandboxed modules: "${scheme}"`] }),
      setSidebarItems: (items) => post({ t: "sidebar", items }),
      subscribe: (event, fn) => { events.set(event, fn); post({ t: "subscribe", event }); },
      post,
    });
    if (typeof def.setup === "function") await def.setup(host);
  } catch (err) {
    post({ t: "fatal", message: String(err) });
  }
}
