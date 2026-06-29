import { defineModule } from "../core/sandbox/defineModule";

// Re-reads the current directory when it changes on disk. The host watches the
// active directory (one native watcher, re-armed on navigation) and emits
// "directory:changed"; this reacts. Re-reading re-arms the same watcher, so
// there is no loop. Pure event reaction — no commands.
export default defineModule({
  id: "core.auto-refresh",
  name: "Auto Refresh",
  version: "1.0.0",
  description: "Refreshes the file list when the current directory changes on disk.",
  permissions: ["fs:read"],
  setup(host) {
    host.events.on("directory:changed", () => {
      void host.refresh().catch((e) => host.log("[auto-refresh] failed:", e));
    });
  },
});
