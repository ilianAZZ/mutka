import { defineModule } from "../core/sandbox/defineModule";

// Owns the app's home directory and the initial navigation. On launch it resolves
// the OS home into the HomeStore (so any module can later override it), then
// restores the last visited local directory — or falls back home. The core holds
// no home-dir logic itself; it just reads the store.
export default defineModule({
  id: "core.home",
  name: "Home",
  version: "1.0.0",
  description: "Resolves the home directory at launch and restores the last folder.",
  permissions: ["fs:read", "view", "navigation"],
  setup(host) {
    host.events.on("app:ready", async () => {
      const home = (await host.sys.homeDir()) as string;
      await host.home.set(home);

      // Restore the last local path; a remote (provider) path may not be mounted
      // yet, so only a path starting with "/" is trusted. Verify it still exists
      // (it may have been deleted/unmounted) — else fall back home, so launch
      // never lands on a dead, empty listing.
      const last = (await host.sys.lastDir()) as string | null;
      let target = home;
      if (last && last.startsWith("/")) {
        try {
          await host.fs.readDir(last);
          target = last;
        } catch {
          target = home;
        }
      }
      await host.nav.navigate(target);
    });
  },
});
