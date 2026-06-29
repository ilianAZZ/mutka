// EXAMPLE COMMUNITY MODULE — untrusted, runs ISOLATED in a Web Worker.
//
// In dev it is loaded from this repo folder (see loadDevModules in moduleLoader).
// In production the same file would live in ~/.mutka/modules/com.dir-stats/index.js.
// It imports NOTHING — everything it can do arrives through `host`, and every
// host capability is gated by the permissions it declares below.
//
// TRY IT: run a command, see the count in the console. Then delete "fs:read"
// from `permissions` and reload — host.fs.readDir is now DENIED by the gateway.
export default {
  id: "com.dir-stats",
  name: "Directory Stats",
  version: "1.0.0",
  description: "Count files and folders in the current directory.",
  // Card image: a self-contained SVG data URI (also accepts an https:// URL).
  icon:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6' fill='%234a90d9'/%3E%3Ctext x='12' y='17' font-size='13' font-family='sans-serif' text-anchor='middle' fill='white'%3E%CE%A3%3C/text%3E%3C/svg%3E",
  // Clicking the name opens `link`; `avatar` is any http(s)/data:image URL.
  author: { name: "Ilian", link: "https://github.com/ilianAZZ", avatar: "https://github.com/ilianAZZ.png" },
  // Free-form tags for discovery filtering.
  tags: ["files", "stats"],
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
