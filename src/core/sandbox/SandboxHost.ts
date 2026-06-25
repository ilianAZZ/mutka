import { EventBus } from "../event-bus/EventBus";
import type { EventMap } from "../event-bus/events";
import { dispatchCapability } from "./gateway";
import { registerProxyModule } from "./proxyModule";
import { ModuleRegistry } from "../module-registry/ModuleRegistry";
import { isSubscribable } from "./eventWhitelist";
import type { WorkerToHost, HostToWorker, SandboxManifest } from "./protocol";

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
  private manifest: SandboxManifest | null = null;
  private readonly ready: Promise<SandboxManifest>;
  private readonly eventUnsubs: Array<() => void> = [];

  constructor(source: string) {
    this.worker = new Worker(new URL("./sandbox.worker.ts", import.meta.url), { type: "module" });
    this.ready = new Promise<SandboxManifest>((resolve, reject) => {
      this.worker.onmessage = (e: MessageEvent<WorkerToHost>) => this.onMessage(e.data, resolve, reject);
      this.worker.onerror = (e) => reject(new Error(e.message));
    });
    this.send({ t: "load", source });
  }

  /** Await the worker's manifest, then surface its commands to ModuleRegistry. */
  async register(): Promise<void> {
    const manifest = await this.ready;
    registerProxyModule(manifest, {
      run: (commandId, snapshot) => this.send({ t: "run", commandId, snapshot }),
      runOpen: (handlerId, item) => this.send({ t: "open", handlerId, item }),
      dispose: () => this.dispose(),
    });
  }

  private dispose(): void {
    for (const unsub of this.eventUnsubs) unsub();
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
        this.manifest = msg.manifest; // set early so host-calls during setup are gated correctly
        resolveReady(msg.manifest);
        break;
      case "subscribe":
        this.subscribe(msg.event);
        break;
      case "sidebar":
        if (this.manifest) ModuleRegistry.setDynamicSidebarItems(this.manifest.id, msg.items);
        break;
      case "log":
        console[msg.level](`[sandbox:${this.manifest?.id ?? "?"}]`, ...msg.args);
        break;
      case "fatal":
        rejectReady(new Error(msg.message));
        break;
      case "host-call":
        void this.handleCall(msg.id, msg.cap, msg.method, msg.args);
        break;
    }
  }

  private subscribe(event: string): void {
    if (!isSubscribable(event)) {
      console.warn(`[sandbox:${this.manifest?.id ?? "?"}] event "${event}" is not subscribable — ignored`);
      return;
    }
    const unsub = EventBus.on(event as keyof EventMap, (payload: unknown) =>
      this.send({ t: "event", event, payload })
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
