import { useState, useEffect, useCallback, useMemo } from "react";
import { ModuleManager } from "../../module-manager/ModuleManager";
import { DiscoveryRegistry } from "../../module-manager/DiscoveryRegistry";
import { probeManifest } from "../../module-manager/probeManifest";
import type { ModuleListing, ResolvedModule } from "../../module-manager/types";
import type { SandboxManifest } from "../../core/sandbox/protocol";
import { ModulesStore } from "../../core/stores/ModulesStore";
import { ModuleRegistry } from "../../core/module-registry/ModuleRegistry";
import { EventBus } from "../../core/event-bus/EventBus";
import { Events } from "../../core/event-bus/events";
import { ICON_REGISTRY } from "../ContextMenu/icon-registry";
import { useModules } from "../../hooks/useModules";
import { InstalledList } from "./InstalledList";
import { BrowseCatalog } from "./BrowseCatalog";
import { InstallReviewDialog } from "./InstallReviewDialog";
import "./ModulesPanel.css";

/** A synthetic listing for a raw source (local file / module-proposed install). */
function localListing(manifest: SandboxManifest): ModuleListing {
  return {
    sourceId: "local",
    ref: manifest.id,
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    icon: manifest.icon,
    author: (manifest.author ?? null) as ModuleListing["author"],
    permissions: manifest.permissions,
    tags: manifest.tags,
  };
}

interface ModulesPanelProps {
  onClose: () => void;
}

type Tab = "installed" | "browse";

/**
 * The module manager overlay. Two tabs: "Installed" (toggle/delete every tracked
 * module) and "Browse" (search GitHub, install with permission review). Every
 * action runs live — enabling/disabling/installing/deleting create and tear down
 * workers without a restart, driven through ModuleManager.
 */
export function ModulesPanel({ onClose }: ModulesPanelProps) {
  const modules = useModules();
  const [tab, setTab] = useState<Tab>("installed");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [review, setReview] = useState<ResolvedModule | null>(null);
  const [installing, setInstalling] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const installedIds = useMemo(() => new Set(modules.map((m) => m.id)), [modules]);

  // Buttons modules contribute to this overlay (e.g. "Import local file"). Refresh
  // when modules register/unregister.
  const [mmButtons, setMmButtons] = useState(() => ModuleRegistry.getModuleManagerButtons());
  useEffect(() => {
    const refresh = () => setMmButtons(ModuleRegistry.getModuleManagerButtons());
    const u1 = EventBus.on(Events.Module.registered, refresh);
    const u2 = EventBus.on(Events.Module.unregistered, refresh);
    return () => { u1(); u2(); };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !installing) {
        if (review) setReview(null);
        else onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, review, installing]);

  // A module (e.g. the Local Installer) asked to install a raw source: probe it and
  // open the same permission-review dialog the Browse install uses.
  useEffect(() => {
    const handle = async () => {
      const source = ModulesStore.takePendingInstall();
      if (!source) return;
      try {
        const manifest = await probeManifest(source);
        setReviewError(null);
        setReview({ source, manifest, listing: localListing(manifest) });
      } catch (err) {
        setActionError(`Could not load the selected module: ${String(err instanceof Error ? err.message : err)}`);
      }
    };
    void handle(); // covers the overlay being opened *by* the request
    const unsub = EventBus.on(Events.ModulesUi.installRequested, () => void handle());
    return unsub;
  }, []);

  const handleToggle = useCallback(async (id: string) => {
    setBusyId(id);
    setActionError(null);
    try {
      await ModuleManager.toggle(id);
    } catch (err) {
      setActionError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm(`Delete "${id}" from disk? This cannot be undone.`)) return;
    setBusyId(id);
    setActionError(null);
    try {
      await ModuleManager.uninstall(id);
    } catch (err) {
      setActionError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusyId(null);
    }
  }, []);

  // Fetch the listing's source + validate it (probe), then open the consent dialog.
  const handleInstallClick = useCallback(async (listing: ModuleListing) => {
    setBusyRef(listing.ref);
    setActionError(null);
    try {
      const resolved = await DiscoveryRegistry.resolve(listing);
      setReviewError(null);
      setReview(resolved);
    } catch (err) {
      setActionError(`Could not load ${listing.name}: ${String(err instanceof Error ? err.message : err)}`);
    } finally {
      setBusyRef(null);
    }
  }, []);

  const handleConfirmInstall = useCallback(async () => {
    if (!review) return;
    setInstalling(true);
    setReviewError(null);
    try {
      await ModuleManager.install(review);
      setReview(null);
      setTab("installed");
    } catch (err) {
      setReviewError(String(err instanceof Error ? err.message : err));
    } finally {
      setInstalling(false);
    }
  }, [review]);

  return (
    <>
      <div className="modules-backdrop" onClick={onClose} />
      <div className="modules-panel" role="dialog" aria-label="Modules">
        <div className="modules-header">
          <div className="modules-tabs">
            <button
              className={`modules-tab${tab === "installed" ? " modules-tab--active" : ""}`}
              onClick={() => setTab("installed")}
            >
              Installed
            </button>
            <button
              className={`modules-tab${tab === "browse" ? " modules-tab--active" : ""}`}
              onClick={() => setTab("browse")}
            >
              Browse
            </button>
          </div>
          <button className="modules-close" onClick={onClose} title="Close">✕</button>
        </div>

        {actionError && <div className="modules-action-error">{actionError}</div>}

        <div className="modules-body">
          {tab === "installed" ? (
            <InstalledList
              modules={modules}
              busyId={busyId}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ) : (
            <>
              {mmButtons.length > 0 && (
                <div className="modules-mm-buttons">
                  {mmButtons.map((b) => {
                    const Icon = b.icon ? ICON_REGISTRY[b.icon] : undefined;
                    return (
                      <button
                        key={`${b.moduleId}:${b.id}`}
                        className="modules-mm-button"
                        onClick={() => ModuleRegistry.dispatchUIEvent(b.moduleId, b.id, null)}
                      >
                        {Icon && <Icon size={14} strokeWidth={1.8} />}
                        {b.label}
                      </button>
                    );
                  })}
                </div>
              )}
              <BrowseCatalog
                installedIds={installedIds}
                busyRef={busyRef}
                onInstall={handleInstallClick}
              />
            </>
          )}
        </div>
      </div>

      {review && (
        <InstallReviewDialog
          resolved={review}
          installedVersion={modules.find((m) => m.id === review.manifest.id)?.version ?? null}
          installing={installing}
          error={reviewError}
          onConfirm={handleConfirmInstall}
          onCancel={() => setReview(null)}
        />
      )}
    </>
  );
}
