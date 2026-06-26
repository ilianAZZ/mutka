import { useState, useEffect, useCallback, useMemo } from "react";
import { ModuleManager } from "../../module-manager/ModuleManager";
import { githubCatalog } from "../../module-manager/githubCatalog";
import type { CatalogEntry, ResolvedModule } from "../../module-manager/types";
import { useModules } from "../../hooks/useModules";
import { InstalledList } from "./InstalledList";
import { BrowseCatalog } from "./BrowseCatalog";
import { InstallReviewDialog } from "./InstallReviewDialog";
import "./ModulesPanel.css";

interface ModulesPanelProps {
  onClose: () => void;
}

type Tab = "installed" | "browse";

interface Review {
  entry: CatalogEntry;
  resolved: ResolvedModule[];
}

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
  const [busyRepo, setBusyRepo] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [review, setReview] = useState<Review | null>(null);
  const [installing, setInstalling] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const installedRepos = useMemo(
    () => new Set(modules.map((m) => m.installed?.repo).filter((r): r is string => !!r)),
    [modules]
  );

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

  // Download + validate the repo's module(s), then open the consent dialog.
  const handleInstallClick = useCallback(async (entry: CatalogEntry) => {
    setBusyRepo(entry.repo);
    setActionError(null);
    try {
      const resolved = await githubCatalog.resolve(entry);
      setReviewError(null);
      setReview({ entry, resolved });
    } catch (err) {
      setActionError(`Could not install ${entry.repo}: ${String(err instanceof Error ? err.message : err)}`);
    } finally {
      setBusyRepo(null);
    }
  }, []);

  const handleConfirmInstall = useCallback(async () => {
    if (!review) return;
    setInstalling(true);
    setReviewError(null);
    try {
      for (const resolved of review.resolved) {
        await ModuleManager.install(resolved, review.entry);
      }
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
            <BrowseCatalog
              installedRepos={installedRepos}
              busyRepo={busyRepo}
              onInstall={handleInstallClick}
            />
          )}
        </div>
      </div>

      {review && (
        <InstallReviewDialog
          entry={review.entry}
          resolved={review.resolved}
          installing={installing}
          error={reviewError}
          onConfirm={handleConfirmInstall}
          onCancel={() => setReview(null)}
        />
      )}
    </>
  );
}
