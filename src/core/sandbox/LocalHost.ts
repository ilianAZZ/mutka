import { EventBus } from "../event-bus/EventBus";
import type { EventMap } from "../event-bus/events";
import { createHostProxy, type CommandHandler, type OpenHandler, type EventHandler, type ColumnProvider, type UIEventHandler, type ProviderHandler, type ProviderMethod, type DiscoverHandler, type FetchSourceHandler } from "./hostProxy";
import { dispatchCapability } from "./gateway";
import { registerProxyModule } from "./proxyModule";
import { ModuleRegistry } from "../module-registry/ModuleRegistry";
import { isSubscribable, deliverablePayload, requiredPermissionFor } from "./eventWhitelist";
import { FileSystemRegistry } from "../file-system/FileSystemRegistry";
import { DiscoveryRegistry } from "../discovery/DiscoveryRegistry";
import type { DiscoveryResult } from "../discovery/types";
import type { SandboxManifest, HostSnapshot, ColumnCell, DiscoveryMethod } from "./protocol";
import type { SandboxModuleDef } from "./defineModule";
import type { FileItem } from "../types";

/**
 * LOCAL RUNTIME — hosts ONE trusted built-in module in-process. Same module
 * format (`defineModule`), same permission gateway as the worker runtime, but
 * no Worker, no postMessage, no serialization: capability calls go straight to
 * `dispatchCapability`, event subscriptions straight to the EventBus.
 *
 * File system providers are registered here (LocalHost only): a provider
 * intercepts the whole file view, so it must be trusted, and the worker realm
 * lacks the DOM APIs (DOMParser, etc.) such providers usually need.
 */
export class LocalHost {
  /** The module's manifest, derived from its def without running setup(). */
  readonly manifest: SandboxManifest;
  private readonly commands = new Map<string, CommandHandler>();
  private readonly opens = new Map<string, OpenHandler>();
  private readonly columns = new Map<string, ColumnProvider>();
  private readonly uiEvents = new Map<string, UIEventHandler>();
  private readonly providers = new Map<string, ProviderHandler>();
  private readonly discoveries = new Map<string, DiscoverHandler | FetchSourceHandler>();
  private readonly eventUnsubs: Array<() => void> = [];
  private readonly registeredSchemes: string[] = [];
  private readonly registeredSources: string[] = [];

  constructor(private readonly def: SandboxModuleDef) {
    this.manifest = {
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
  }

  async register(): Promise<SandboxManifest> {
    const host = createHostProxy({
      callHost: (cap, method, args) => dispatchCapability(this.manifest, cap, method, args),
      registerCommand: (id, fn) => this.commands.set(id, fn),
      registerOpen: (id, fn) => this.opens.set(id, fn),
      registerColumn: (id, fn) => this.columns.set(id, fn),
      registerUIEvent: (id, fn) => this.uiEvents.set(id, fn),
      registerProvider: (scheme, method, fn) => this.providers.set(`${scheme}:${method}`, fn),
      registerDiscovery: (sourceId, method, fn) => this.discoveries.set(`${sourceId}:${method}`, fn),
      setSidebarItems: (items) => ModuleRegistry.setDynamicSidebarItems(this.manifest.id, items),
      subscribe: (event, fn) => this.subscribe(event, fn),
      post: (m) => { if (m.t === "log") console[m.level](`[builtin:${this.manifest.id}]`, ...m.args); },
    });
    if (typeof this.def.setup === "function") await this.def.setup(host);

    for (const scheme of this.manifest.fileSystemProviders) {
      FileSystemRegistry.registerProvider(scheme, {
        list: (path) => this.callProvider(scheme, "list", path) as Promise<FileItem[]>,
        openFile: (path) => this.callProvider(scheme, "openFile", path) as Promise<void>,
        createFolder: (path) => this.callProvider(scheme, "createFolder", path) as Promise<void>,
        createFile: (path) => this.callProvider(scheme, "createFile", path) as Promise<void>,
        deleteItem: (path) => this.callProvider(scheme, "deleteItem", path) as Promise<void>,
        renameItem: (from, to) => this.callProvider(scheme, "renameItem", from, to) as Promise<void>,
        copyFiles: (paths, dest) => this.callProvider(scheme, "copyFiles", paths, dest) as Promise<void>,
        moveFiles: (paths, dest) => this.callProvider(scheme, "moveFiles", paths, dest) as Promise<void>,
      });
      this.registeredSchemes.push(scheme);
    }

    for (const decl of this.manifest.discoverySources) {
      DiscoveryRegistry.register({
        id: decl.id,
        label: decl.label,
        discover: (query) => this.callDiscovery(decl.id, "discover", [query]) as Promise<DiscoveryResult>,
        fetchSource: (ref) => this.callDiscovery(decl.id, "fetchSource", [ref]) as Promise<string>,
      });
      this.registeredSources.push(decl.id);
    }

    registerProxyModule(this.manifest, {
      run: (id, snap) => this.run(this.commands.get(id), snap, `command "${id}"`),
      runOpen: (id, item) => this.run(this.opens.get(id), item, `open handler "${id}"`),
      runColumn: (id, item) => this.runColumn(id, item),
      runUIEvent: (id, value) => this.run(this.uiEvents.get(id), value, `ui-event "${id}"`),
      dispose: () => this.dispose(),
    });
    return this.manifest;
  }

  private async runColumn(columnId: string, item: FileItem): Promise<ColumnCell | null> {
    const provider = this.columns.get(columnId);
    if (!provider) return null;
    return (await provider(item)) ?? null;
  }

  private callProvider(scheme: string, method: ProviderMethod, ...args: unknown[]): Promise<unknown> {
    const fn = this.providers.get(`${scheme}:${method}`);
    if (!fn) return Promise.reject(new Error(`provider "${scheme}" has no "${method}" handler`));
    return Promise.resolve((fn as (...a: unknown[]) => unknown)(...args));
  }

  private callDiscovery(sourceId: string, method: DiscoveryMethod, args: unknown[]): Promise<unknown> {
    const fn = this.discoveries.get(`${sourceId}:${method}`);
    if (!fn) return Promise.reject(new Error(`discovery source "${sourceId}" has no "${method}" handler`));
    return Promise.resolve((fn as (...a: unknown[]) => unknown)(...args));
  }

  private subscribe(event: string, handler: EventHandler): void {
    if (!isSubscribable(event)) {
      console.warn(`[builtin:${this.manifest.id}] event "${event}" is not subscribable — ignored`);
      return;
    }
    const need = requiredPermissionFor(event);
    if (need && !this.manifest.permissions.includes(need)) {
      console.warn(`[builtin:${this.manifest.id}] event "${event}" requires the "${need}" permission — ignored`);
      return;
    }
    this.eventUnsubs.push(
      EventBus.on(event as keyof EventMap, (payload: unknown) =>
        handler(deliverablePayload(event, payload))
      )
    );
  }

  private run<A>(fn: ((arg: A) => void | Promise<void>) | undefined, arg: A | HostSnapshot | FileItem, label: string): void {
    if (!fn) return;
    Promise.resolve(fn(arg as A)).catch((err) =>
      console.error(`[builtin:${this.manifest.id}] ${label} failed:`, err)
    );
  }

  private dispose(): void {
    for (const unsub of this.eventUnsubs) unsub();
    for (const scheme of this.registeredSchemes) FileSystemRegistry.unregisterProvider(scheme);
    for (const sourceId of this.registeredSources) DiscoveryRegistry.unregister(sourceId);
    this.commands.clear();
    this.opens.clear();
    this.columns.clear();
    this.uiEvents.clear();
    this.providers.clear();
    this.discoveries.clear();
  }
}
