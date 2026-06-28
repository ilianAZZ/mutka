import { useEffect, useState } from "react";
import { UpdateController, type UpdateState } from "../../update";
import "./UpdateToast.css";

/**
 * VSCode-style update notification. A Liquid Glass toast pinned bottom-right that
 * mirrors the UpdateController state: offers an update, shows download progress,
 * then a restart prompt. Pure presentation — all updater logic lives in
 * src/update.ts. Renders nothing while idle/checking.
 */
export function UpdateToast() {
  const [state, setState] = useState<UpdateState>(UpdateController.state);
  useEffect(() => UpdateController.subscribe(setState), []);

  if (state.status === "idle" || state.status === "checking") return null;

  return (
    <div className="update-toast" role="alertdialog" aria-label="Software update">
      {state.status === "available" && (
        <>
          <div className="update-toast-body">
            <span className="update-toast-icon" aria-hidden>↑</span>
            <div className="update-toast-text">
              <span className="update-toast-title">A new version is available</span>
              <span className="update-toast-sub">
                Mutka {state.version}
                <span className="update-toast-dim"> · you have {state.currentVersion}</span>
              </span>
              {state.notes && <p className="update-toast-notes">{state.notes}</p>}
            </div>
          </div>
          <div className="update-toast-actions">
            <button className="update-toast-btn update-toast-btn--ghost" onClick={() => UpdateController.dismiss()}>
              Later
            </button>
            <button className="update-toast-btn update-toast-btn--primary" onClick={() => void UpdateController.install()}>
              Update &amp; Restart
            </button>
          </div>
        </>
      )}

      {state.status === "downloading" && (
        <div className="update-toast-body">
          <span className="update-toast-icon update-toast-icon--spin" aria-hidden>↻</span>
          <div className="update-toast-text">
            <span className="update-toast-title">Downloading Mutka {state.version}…</span>
            <div className="update-toast-progress">
              <div
                className={`update-toast-progress-fill${state.pct === null ? " update-toast-progress-fill--indet" : ""}`}
                style={state.pct === null ? undefined : { width: `${state.pct}%` }}
              />
            </div>
            <span className="update-toast-sub">
              {state.pct === null ? "Starting…" : `${state.pct}%`}
            </span>
          </div>
        </div>
      )}

      {state.status === "ready" && (
        <div className="update-toast-body">
          <span className="update-toast-icon" aria-hidden>✓</span>
          <div className="update-toast-text">
            <span className="update-toast-title">Update ready</span>
            <span className="update-toast-sub">Restarting into {state.version}…</span>
          </div>
        </div>
      )}

      {state.status === "uptodate" && (
        <>
          <div className="update-toast-body">
            <span className="update-toast-icon" aria-hidden>✓</span>
            <div className="update-toast-text">
              <span className="update-toast-title">You're up to date</span>
            </div>
          </div>
          <div className="update-toast-actions">
            <button className="update-toast-btn update-toast-btn--ghost" onClick={() => UpdateController.dismiss()}>
              Dismiss
            </button>
          </div>
        </>
      )}

      {state.status === "error" && (
        <>
          <div className="update-toast-body">
            <span className="update-toast-icon update-toast-icon--err" aria-hidden>!</span>
            <div className="update-toast-text">
              <span className="update-toast-title">Update failed</span>
              <span className="update-toast-sub">{state.message}</span>
            </div>
          </div>
          <div className="update-toast-actions">
            <button className="update-toast-btn update-toast-btn--ghost" onClick={() => UpdateController.dismiss()}>
              Dismiss
            </button>
            <button className="update-toast-btn update-toast-btn--primary" onClick={() => void UpdateController.check(false)}>
              Retry
            </button>
          </div>
        </>
      )}
    </div>
  );
}
