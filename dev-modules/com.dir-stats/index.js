// EXAMPLE COMMUNITY MODULE — untrusted, runs ISOLATED in a Web Worker.
//
// In dev it is loaded from this repo folder (see loadDevModules in moduleLoader).
// In production the same file would live in ~/.macows/modules/com.dir-stats/index.js.
// It imports NOTHING — everything it can do arrives through `host`, and every
// host capability is gated by the permissions it declares below.
//
// TRY IT: run a command, see the count in the console. Then delete "fs:read"
// from `permissions` and reload — host.fs.readDir is now DENIED by the gateway.
export default {
  id: "com.dir-stats",
  name: "Directory Stats",
  version: "1.0.0",
  permissions: ["fs:read"],
  commands: [
    {
      id: "com.dir-stats.count",
      label: "Count items here (sandboxed)",
      contextMenu: true,
      contextMenuCategory: "View",
      when: { selection: "any" },
    },
  ],
  setup(host) {
    host.onCommand("com.dir-stats.count", async (snap) => {
      const items = await host.fs.readDir(snap.currentDirectory);
      const dirs = items.filter((i) => i.isDir).length;
      host.log(
        `${snap.currentDirectory} → ${items.length} items (${dirs} folders, ${items.length - dirs} files)`
      );
    });
  },
};
