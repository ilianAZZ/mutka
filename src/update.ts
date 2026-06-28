// In-app auto-update (prompt mode).
//
// On launch — and on demand from Settings — we ask the GitHub Release
// `latest.json` whether a newer signed build exists. If so, the UpdateToast
// (components/UpdateToast) surfaces a Liquid Glass notification with an "Update
// & Restart" button; on accept we download + install (streaming progress) and
// relaunch. The signature is verified natively against the pubkey in
// tauri.conf.json — a tampered update is rejected before it ever runs.
//
// GitHub's `/releases/latest` redirect always points at the newest
// NON-prerelease release, so `-rc` builds are never offered as updates.
//
// This is intentionally NOT a defineModule module: there is no "update"
// capability in the gateway, and the check uses the updater plugin API
// directly. Keep all updater logic in this one file; the UI only reads state.

import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/** The observable lifecycle of an update, mirrored into the UpdateToast. */
export type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; version: string; currentVersion: string; notes: string }
  | { status: "downloading"; version: string; pct: number | null }
  | { status: "ready"; version: string }
  | { status: "uptodate" }
  | { status: "error"; message: string };

type Listener = (state: UpdateState) => void;

// Tauri APIs only exist inside the native shell. In a plain browser (e.g. the
// Vite dev server opened directly) they are absent, so we no-op.
function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Reactive owner of the update lifecycle — a singleton store, like the others in
 * core/stores. The UpdateToast and the Settings "Check for Updates" row both
 * subscribe; nobody else touches the updater plugin.
 */
class UpdateControllerClass {
  private _state: UpdateState = { status: "idle" };
  private _update: Update | null = null;
  private listeners = new Set<Listener>();

  get state(): UpdateState {
    return this._state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private set(state: UpdateState): void {
    this._state = state;
    for (const l of this.listeners) l(state);
  }

  /**
   * Fetch latest.json and, if a newer signed build exists, move to "available"
   * (which surfaces the toast). Returns whether an update was found. `silent`
   * keeps a no-update or failed result invisible — used for the startup check so
   * an up-to-date launch shows nothing.
   */
  async check(silent: boolean): Promise<boolean> {
    if (!inTauri()) return false;
    // A download in progress must not be interrupted by a re-check.
    if (this._state.status === "downloading") return true;
    this.set({ status: "checking" });
    try {
      const update = await check();
      if (update) {
        this._update = update;
        this.set({
          status: "available",
          version: update.version,
          currentVersion: update.currentVersion,
          notes: update.body?.trim() ?? "",
        });
        return true;
      }
      this.set(silent ? { status: "idle" } : { status: "uptodate" });
      return false;
    } catch (err) {
      console.warn("[update] check failed:", err);
      this.set(silent ? { status: "idle" } : { status: "error", message: String(err) });
      return false;
    }
  }

  /**
   * User accepted: download the verified payload (streaming progress into the
   * toast), then relaunch into the new version.
   */
  async install(): Promise<void> {
    const update = this._update;
    if (!update) return;

    this.set({ status: "downloading", version: update.version, pct: null });
    let downloaded = 0;
    let total = 0;
    try {
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            total = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            this.set({
              status: "downloading",
              version: update.version,
              pct: total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : null,
            });
            break;
          case "Finished":
            this.set({ status: "ready", version: update.version });
            break;
        }
      });
      await relaunch();
    } catch (err) {
      console.error("[update] install failed:", err);
      this.set({ status: "error", message: String(err) });
    }
  }

  /** Dismiss the toast ("Later"). The update stays pending for the next launch. */
  dismiss(): void {
    this.set({ status: "idle" });
  }
}

export const UpdateController = new UpdateControllerClass();

/**
 * Fire-and-forget from main.tsx at startup. Never throws into startup: a failed
 * check (offline, GitHub down) must not block the app from opening, and an
 * up-to-date launch shows no UI.
 */
export function checkForUpdates(): void {
  void UpdateController.check(true);
}
