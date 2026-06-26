// In-app auto-update (prompt mode).
//
// On launch we ask the GitHub Release `latest.json` whether a newer signed
// build exists. If so, we prompt the user; on accept we download + install and
// relaunch. The signature is verified natively against the pubkey in
// tauri.conf.json — a tampered update is rejected before it ever runs.
//
// This is intentionally NOT a defineModule module: there is no "update"
// capability in the gateway, and the check must run once at startup using the
// updater plugin API directly. Keep all updater logic in this one file.

import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

// Tauri APIs only exist inside the native shell. In a plain browser (e.g. the
// Vite dev server opened directly) they are absent, so we no-op.
function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function promptAndInstall(update: Update): Promise<void> {
  const accepted = window.confirm(
    `Mutka ${update.version} is available (you have ${update.currentVersion}).\n\n` +
      `${update.body ?? ""}\n\nUpdate now? The app will restart.`
  );
  if (!accepted) return;

  // downloadAndInstall streams the verified update; the progress events are
  // available if we later want a Liquid Glass progress UI instead of confirm.
  await update.downloadAndInstall();
  await relaunch();
}

// Fire-and-forget from main.tsx. Never throws into startup: a failed check
// (offline, GitHub down, draft release) must not block the app from opening.
export async function checkForUpdates(): Promise<void> {
  if (!inTauri()) return;
  try {
    const update = await check();
    if (update) await promptAndInstall(update);
  } catch (err) {
    console.warn("[update] check failed:", err);
  }
}
