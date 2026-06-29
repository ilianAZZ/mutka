import { invoke } from "@tauri-apps/api/core";
import { ModuleRegistry } from "../core/module-registry/ModuleRegistry";
import type { SandboxManifest } from "../core/sandbox/protocol";
import { manifestFromDef } from "../core/sandbox/manifestFromDef";
import { collectDescriptors, makeWorkerDescriptor } from "./descriptors";
import { loadConfig, saveConfig } from "./moduleConfig";
import { writeModule } from "./installModule";
import type {
  ManagedModule,
  ModuleConfig,
  ModuleDescriptor,
  ResolvedModule,
} from "./types";

// =============================================================================
// MODULE MANAGER — the single owner of every module's lifecycle. It tracks the
// live host behind each module so the UI can enable / disable / install / delete
// WHILE the app runs: disabling tears the worker down (ModuleRegistry.unregister
// → onUnmount → host.dispose → worker.terminate); enabling spins a fresh one.
//
// Built-in/dev modules ship in the bundle and can be toggled but not deleted;
// community modules (installed from a catalog) can also be deleted from disk.
//
// Lives at the app layer (it calls invoke, like the old moduleLoader). Not core.
// =============================================================================

/** A bare manifest for a module whose source couldn't even be read. */
function minimalManifest(id: string): SandboxManifest {
  // Reuse the one manifest builder so a new contribution field is never missed
  // here (an error-state module would otherwise be structurally invalid).
  return manifestFromDef({ id });
}

class ModuleManagerClass {
  private modules = new Map<string, ManagedModule>();
  private config: ModuleConfig = { version: 1, disabled: [], installed: {} };
  private listeners = new Set<() => void>();
  private started = false;

  /**
   * Discover every module, then activate the enabled ones and read metadata for
   * the disabled ones (so they still render). Resolves once all are processed,
   * which is what gates `app:ready` — same contract as the old moduleLoader.
   */
  async init(): Promise<void> {
    if (this.started) return;
    this.started = true;

    this.config = await loadConfig();
    const descriptors = await collectDescriptors();
    await Promise.all(descriptors.map((d) => this.load(d, !this.isDisabled(d.id))));
    this.emit();
  }

  // ── Reads (for the UI) ───────────────────────────────────────────────────────

  /** Every tracked module, sorted: built-ins first, then by name. */
  getAll(): ManagedModule[] {
    const rank = { builtin: 0, dev: 1, community: 2 } as const;
    return [...this.modules.values()].sort(
      (a, b) => rank[a.source] - rank[b.source] || a.name.localeCompare(b.name)
    );
  }

  get(id: string): ManagedModule | undefined {
    return this.modules.get(id);
  }

  /** Subscribe to any change (load, toggle, install, delete). Returns an unsubscribe. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ── Lifecycle (hot, while the app runs) ──────────────────────────────────────

  /** Enable a disabled module: spin up its runtime and register it. */
  async enable(id: string): Promise<void> {
    const mod = this.modules.get(id);
    if (!mod || mod.enabled) return;
    this.config.disabled = this.config.disabled.filter((d) => d !== id);
    await saveConfig(this.config);
    mod.enabled = true;
    await this.activate(mod);
    this.emit();
  }

  /** Disable an active module: unregister it and tear its worker down. */
  async disable(id: string): Promise<void> {
    const mod = this.modules.get(id);
    if (!mod || !mod.enabled) return;
    if (mod.status === "active") ModuleRegistry.unregister(id);
    if (!this.config.disabled.includes(id)) this.config.disabled.push(id);
    await saveConfig(this.config);
    mod.enabled = false;
    mod.host = undefined;
    mod.status = "disabled";
    mod.error = undefined;
    this.emit();
  }

  async toggle(id: string): Promise<void> {
    const mod = this.modules.get(id);
    if (!mod) return;
    return mod.enabled ? this.disable(id) : this.enable(id);
  }

  /**
   * Install (or update) a community module from an already-resolved, validated
   * download. Writes it to disk, records provenance, and activates it live.
   */
  async install(resolved: ResolvedModule): Promise<void> {
    const id = resolved.manifest.id;
    const meta = await writeModule(resolved);

    // Updating an installed module: tear the old runtime down first.
    const existing = this.modules.get(id);
    if (existing?.status === "active") ModuleRegistry.unregister(id);

    this.config.installed[id] = meta;
    this.config.disabled = this.config.disabled.filter((d) => d !== id);
    await saveConfig(this.config);

    // Build a descriptor from the in-memory source (already validated) so we
    // don't re-read disk; on next launch it loads from ~/.mutka/modules normally.
    const descriptor = makeWorkerDescriptor(id, "community", async () => resolved.source);
    const mod = this.upsert(descriptor, resolved.manifest, true, meta);
    await this.activate(mod);
    this.emit();
  }

  /** Delete a community module from disk and from the running app. */
  async uninstall(id: string): Promise<void> {
    const mod = this.modules.get(id);
    if (!mod || mod.source !== "community") return;
    if (mod.status === "active") ModuleRegistry.unregister(id);
    await invoke("uninstall_module", { id });
    delete this.config.installed[id];
    this.config.disabled = this.config.disabled.filter((d) => d !== id);
    await saveConfig(this.config);
    this.modules.delete(id);
    this.emit();
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  private isDisabled(id: string): boolean {
    return this.config.disabled.includes(id);
  }

  /** Process one descriptor at startup: activate if enabled, else read metadata. */
  private async load(descriptor: ModuleDescriptor, enabled: boolean): Promise<void> {
    if (enabled) {
      try {
        const host = await descriptor.activate();
        const manifest = host.manifest;
        if (!manifest) throw new Error("module reported no manifest");
        const mod = this.upsert(descriptor, manifest, true, this.config.installed[descriptor.id]);
        mod.host = host;
        mod.status = "active";
      } catch (err) {
        // Failed to load — still surface it (with metadata if probing works).
        await this.loadDisabledOrError(descriptor, String(err));
      }
    } else {
      await this.loadDisabledOrError(descriptor, undefined);
    }
  }

  /** Read a module's manifest without activating; record disabled or error state. */
  private async loadDisabledOrError(descriptor: ModuleDescriptor, error?: string): Promise<void> {
    try {
      const manifest = await descriptor.probe();
      const mod = this.upsert(descriptor, manifest, false, this.config.installed[descriptor.id]);
      mod.status = error ? "error" : "disabled";
      mod.error = error;
    } catch (probeErr) {
      // Can't even read the manifest — record a minimal error entry.
      const mod = this.upsert(descriptor, minimalManifest(descriptor.id), false, this.config.installed[descriptor.id]);
      mod.status = "error";
      mod.error = error ?? String(probeErr);
    }
  }

  /** Activate an existing managed module (used by enable/install). */
  private async activate(mod: ManagedModule): Promise<void> {
    try {
      const host = await mod.descriptor.activate();
      mod.host = host;
      mod.status = "active";
      mod.error = undefined;
      this.refreshManifest(mod, host.manifest);
    } catch (err) {
      mod.host = undefined;
      mod.status = "error";
      mod.error = String(err);
    }
  }

  /** Create or update the ManagedModule entry for a descriptor + manifest. */
  private upsert(
    descriptor: ModuleDescriptor,
    manifest: SandboxManifest,
    enabled: boolean,
    installed?: ManagedModule["installed"]
  ): ManagedModule {
    const mod: ManagedModule = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      icon: manifest.icon,
      author: manifest.author,
      permissions: manifest.permissions,
      source: descriptor.source,
      status: enabled ? "active" : "disabled",
      enabled,
      installed,
      descriptor,
    };
    this.modules.set(mod.id, mod);
    return mod;
  }

  /** Copy live manifest fields back onto a managed module after (re)activation. */
  private refreshManifest(mod: ManagedModule, manifest: SandboxManifest | null): void {
    if (!manifest) return;
    mod.name = manifest.name;
    mod.version = manifest.version;
    mod.description = manifest.description;
    mod.icon = manifest.icon;
    mod.author = manifest.author;
    mod.permissions = manifest.permissions;
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}

export const ModuleManager = new ModuleManagerClass();
