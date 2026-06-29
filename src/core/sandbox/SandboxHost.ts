import { EventBus } from "../event-bus/EventBus";
import type { EventMap } from "../event-bus/events";
import { dispatchCapability } from "./gateway";
import { registerProxyModule } from "./proxyModule";
import { ModuleRegistry } from "../module-registry/ModuleRegistry";
import { NotificationStore } from "../stores/NotificationStore";
import { isSubscribable, deliverablePayload, requiredPermissionFor } from "./eventWhitelist";
import { FileSystemRegistry } from "../file-system/FileSystemRegistry";
import { DiscoveryRegistry } from "../discovery/DiscoveryRegistry";
import type { DiscoveryResult } from "../discovery/types";
import type { WorkerToHost, HostToWorker, SandboxManifest, ColumnCell, ProviderMethod, DiscoveryMethod } from "./protocol";
import type { FileItem } from "../types";

/**
 * WORKER RUNTIME — hosts ONE untrusted community module in an isolated Web
 * Worker. The module has no DOM, no `invoke`, no core reference; it reaches the
 * system only by posting host-calls, which are gated by `dispatchCapability`.
 * Whitelisted app events are forwarded into the worker; everything else is denied.
 *
 * Its in-process twin is LocalHost: same manifest, same gateway, same proxy
 * module — only the transport differs (postMessage here vs. direct call there).
 */
export class SandboxHost {
  private worker: Worker;
  private manifestValue: SandboxManifest | null = null;
  private readonly ready: Promise<SandboxManifest>;
  private readonly eventUnsubs: Array<() => void> = [];
  // Correlated host→worker→host calls for column values (the mirror of the
  // worker's own host-call pending map).
  private columnSeq = 0;
  private readonly columnPending = new Map<number, { resolve: (v: ColumnCell | null) => void; reject: (e: Error) => void }>();
  private readonly columnBatchPending = new Map<number, { resolve: (v: (ColumnCell | null)[]) => void; reject: (e: Error) => void }>();
  // Host→worker→host calls for file-system-provider operations (list/openFile/…).
  private providerSeq = 0;
  private readonly providerPending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private readonly registeredSchemes: string[] = [];
  // Host→worker→host calls for discovery-source operations (discover/fetchSource).
  private discoverySeq = 0;
  private readonly discoveryPending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private readonly registeredSources: string[] = [];

  constructor(source: string) {
    this.worker = new Worker(new URL("./sandbox.worker.ts", import.meta.url), { type: "module" });
    this.ready = new Promise<SandboxManifest>((resolve, reject) => {
      this.worker.onmessage = (e: MessageEvent<WorkerToHost>) => this.onMessage(e.data, resolve, reject);
      this.worker.onerror = (e) => reject(new Error(e.message));
    });
    this.send({ t: "load", source });
  }

  /** The module's manifest, available after register() resolves. */
  get manifest(): SandboxManifest | null {
    return this.manifestValue;
  }

  /** Await the worker's manifest, then surface its commands to ModuleRegistry. */
  async register(): Promise<SandboxManifest> {
    const manifest = await this.ready;

    // A community module may now back a virtual file system: each provider op is
    // a host→worker→host round-trip (the worker holds the handler). The worker
    // realm lacks DOM APIs (DOMParser, etc.), so providers that need them should
    // still ship as built-ins — but pure network/JSON providers work here.
    for (const scheme of manifest.fileSystemProviders) {
      FileSystemRegistry.registerProvider(scheme, {
        list: (path) => this.runProvider(scheme, "list", [path]) as Promise<FileItem[]>,
        openFile: (path) => this.runProvider(scheme, "openFile", [path]) as Promise<void>,
        createFolder: (path) => this.runProvider(scheme, "createFolder", [path]) as Promise<void>,
        createFile: (path) => this.runProvider(scheme, "createFile", [path]) as Promise<void>,
        deleteItem: (path) => this.runProvider(scheme, "deleteItem", [path]) as Promise<void>,
        renameItem: (from, to) => this.runProvider(scheme, "renameItem", [from, to]) as Promise<void>,
        copyFiles: (paths, dest) => this.runProvider(scheme, "copyFiles", [paths, dest]) as Promise<void>,
        moveFiles: (paths, dest) => this.runProvider(scheme, "moveFiles", [paths, dest]) as Promise<void>,
      });
      this.registeredSchemes.push(scheme);
    }

    for (const decl of manifest.discoverySources) {
      DiscoveryRegistry.register({
        id: decl.id,
        label: decl.label,
        discover: (query) => this.runDiscovery(decl.id, "discover", [query]) as Promise<DiscoveryResult>,
        fetchSource: (ref) => this.runDiscovery(decl.id, "fetchSource", [ref]) as Promise<string>,
      });
      this.registeredSources.push(decl.id);
    }

    registerProxyModule(manifest, {
      run: (commandId, snapshot) => this.send({ t: "run", commandId, snapshot }),
      runOpen: (handlerId, item) => this.send({ t: "open", handlerId, item }),
      runColumn: (columnId, item) => this.runColumn(columnId, item),
      runColumnBatch: (columnId, items) => this.runColumnBatch(columnId, items),
      runUIEvent: (handler, value) => this.send({ t: "ui-event", handler, value }),
      dispose: () => this.dispose(),
    });
    return manifest;
  }

  private runColumn(columnId: string, item: FileItem): Promise<ColumnCell | null> {
    const id = ++this.columnSeq;
    return new Promise<ColumnCell | null>((resolve, reject) => {
      this.columnPending.set(id, { resolve, reject });
      this.send({ t: "column", id, columnId, item });
    });
  }

  private runColumnBatch(columnId: string, items: FileItem[]): Promise<(ColumnCell | null)[]> {
    const id = ++this.columnSeq;
    return new Promise<(ColumnCell | null)[]>((resolve, reject) => {
      this.columnBatchPending.set(id, { resolve, reject });
      this.send({ t: "column-batch", id, columnId, items });
    });
  }

  private runProvider(scheme: string, method: ProviderMethod, args: unknown[]): Promise<unknown> {
    const id = ++this.providerSeq;
    return new Promise<unknown>((resolve, reject) => {
      this.providerPending.set(id, { resolve, reject });
      this.send({ t: "provider", id, scheme, method, args });
    });
  }

  private runDiscovery(sourceId: string, method: DiscoveryMethod, args: unknown[]): Promise<unknown> {
    const id = ++this.discoverySeq;
    return new Promise<unknown>((resolve, reject) => {
      this.discoveryPending.set(id, { resolve, reject });
      this.send({ t: "discovery", id, sourceId, method, args });
    });
  }

  private dispose(): void {
    for (const unsub of this.eventUnsubs) unsub();
    for (const { reject } of this.columnPending.values()) reject(new Error("module disposed"));
    this.columnPending.clear();
    for (const { reject } of this.columnBatchPending.values()) reject(new Error("module disposed"));
    this.columnBatchPending.clear();
    for (const { reject } of this.providerPending.values()) reject(new Error("module disposed"));
    this.providerPending.clear();
    for (const { reject } of this.discoveryPending.values()) reject(new Error("module disposed"));
    this.discoveryPending.clear();
    for (const scheme of this.registeredSchemes) FileSystemRegistry.unregisterProvider(scheme);
    for (const sourceId of this.registeredSources) DiscoveryRegistry.unregister(sourceId);
    this.worker.terminate();
  }

  private send(msg: HostToWorker): void {
    this.worker.postMessage(msg);
  }

  private onMessage(
    msg: WorkerToHost,
    resolveReady: (m: SandboxManifest) => void,
    rejectReady: (e: Error) => void
  ): void {
    switch (msg.t) {
      case "ready":
        this.manifestValue = msg.manifest; // set early so host-calls during setup are gated correctly
        resolveReady(msg.manifest);
        break;
      case "subscribe":
        this.subscribe(msg.event);
        break;
      case "sidebar":
        if (this.manifest) ModuleRegistry.setDynamicSidebarItems(this.manifest.id, msg.items);
        break;
      case "log": {
        const id = this.manifest?.id ?? "?";
        console[msg.level](`[sandbox:${id}]`, ...msg.args);
        // A worker handler that throws (incl. a denied permission) is caught in
        // the worker and surfaced here as an error log — give the user a visible
        // toast, not just a console line they may never open.
        if (msg.level === "error") {
          NotificationStore.error(this.manifest?.name ?? id, msg.args.map(String).join(" "));
        }
        break;
      }
      case "fatal":
        NotificationStore.error(this.manifest?.name ?? this.manifest?.id ?? "Module", msg.message);
        rejectReady(new Error(msg.message));
        break;
      case "host-call":
        void this.handleCall(msg.id, msg.cap, msg.method, msg.args);
        break;
      case "column-result": {
        const pending = this.columnPending.get(msg.id);
        if (!pending) break;
        this.columnPending.delete(msg.id);
        if (msg.ok) pending.resolve(msg.value);
        else pending.reject(new Error(msg.error));
        break;
      }
      case "column-batch-result": {
        const pending = this.columnBatchPending.get(msg.id);
        if (!pending) break;
        this.columnBatchPending.delete(msg.id);
        if (msg.ok) pending.resolve(msg.values);
        else pending.reject(new Error(msg.error));
        break;
      }
      case "provider-result": {
        const pending = this.providerPending.get(msg.id);
        if (!pending) break;
        this.providerPending.delete(msg.id);
        if (msg.ok) pending.resolve(msg.value);
        else pending.reject(new Error(msg.error));
        break;
      }
      case "discovery-result": {
        const pending = this.discoveryPending.get(msg.id);
        if (!pending) break;
        this.discoveryPending.delete(msg.id);
        if (msg.ok) pending.resolve(msg.value);
        else pending.reject(new Error(msg.error));
        break;
      }
    }
  }

  private subscribe(event: string): void {
    if (!isSubscribable(event)) {
      console.warn(`[sandbox:${this.manifest?.id ?? "?"}] event "${event}" is not subscribable — ignored`);
      return;
    }
    const need = requiredPermissionFor(event);
    if (need && !this.manifest?.permissions.includes(need)) {
      console.warn(`[sandbox:${this.manifest?.id ?? "?"}] event "${event}" requires the "${need}" permission — ignored`);
      return;
    }
    const unsub = EventBus.on(event as keyof EventMap, (payload: unknown) =>
      this.send({ t: "event", event, payload: deliverablePayload(event, payload) })
    );
    this.eventUnsubs.push(unsub);
  }

  private async handleCall(id: number, cap: string, method: string, args: unknown[]): Promise<void> {
    if (!this.manifest) {
      return this.send({ t: "host-result", id, ok: false, error: "Module not ready" });
    }
    try {
      const value = await dispatchCapability(this.manifest, cap, method, args);
      this.send({ t: "host-result", id, ok: true, value });
    } catch (err) {
      this.send({ t: "host-result", id, ok: false, error: String(err) });
    }
  }
}
