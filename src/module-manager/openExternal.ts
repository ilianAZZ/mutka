import { invoke } from "@tauri-apps/api/core";

// =============================================================================
// OPEN EXTERNAL — open an http(s) link in the user's default browser.
//
// Inside a Tauri webview a plain <a href target="_blank"> does nothing (there is
// no browser tab to open and external navigation is blocked), so every external
// link in the UI routes through here → the Rust `open_url` command → the OS.
// No-ops on a missing or non-http(s) URL, and outside the native shell.
// =============================================================================

/** Open an external http(s) URL via the OS. Silently ignores anything else. */
export async function openExternal(url: string | null | undefined): Promise<void> {
  if (!url || !/^https?:\/\//i.test(url)) return;
  try {
    await invoke("open_url", { url });
  } catch (err) {
    console.error("Failed to open URL", url, err);
  }
}
