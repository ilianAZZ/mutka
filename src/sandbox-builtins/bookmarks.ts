import { defineModule } from "../core/sandbox/defineModule";
import type { SidebarItem } from "../core/module-registry/module-registry.types";

// Bookmark folders and jump to them from the left "Places" sidebar. Demonstrates
// DYNAMIC sidebar items: the list is built at runtime from persisted config and
// pushed via host.sidebar.set(), and updates live when you add/remove. Items are
// `removable`, so the ✕ in the sidebar emits "sidebar:item-remove", which this
// module listens to.

const STORE_KEY = "list";
const ID_PREFIX = "core.bookmarks:";

function basename(p: string): string {
  const trimmed = p.replace(/\/+$/, "");
  return trimmed.slice(trimmed.lastIndexOf("/") + 1) || p;
}

export default defineModule({
  id: "core.bookmarks",
  name: "Bookmarks",
  version: "1.0.0",
  description: "Bookmark folders and jump to them from the sidebar.",
  permissions: ["storage"],
  commands: [
    {
      id: "core.bookmarks.add",
      label: "Add to Bookmarks",
      icon: "star",
      contextMenu: true,
      contextMenuCategory: "Go",
      when: { selection: "singleDir" },
    },
  ],
  async setup(host) {
    let paths: string[] = [];

    const load = async (): Promise<string[]> => {
      const raw = (await host.config.get(STORE_KEY)) as string | null;
      try { return raw ? (JSON.parse(raw) as string[]) : []; } catch { return []; }
    };
    const persist = () => host.config.set(STORE_KEY, JSON.stringify(paths));
    const render = () => {
      const items: SidebarItem[] = paths.map((path) => ({
        id: ID_PREFIX + path,
        label: basename(path),
        icon: "star",
        category: "Bookmarks",
        path,
        removable: true,
      }));
      host.sidebar.set(items);
    };

    paths = await load();
    render();

    host.onCommand("core.bookmarks.add", async (snap) => {
      const dir = snap.selectedItems[0];
      if (!dir || !dir.isDir || paths.includes(dir.path)) return;
      paths = [...paths, dir.path];
      await persist();
      render();
    });

    // The ✕ on a bookmark in the sidebar emits this; remove the matching path.
    host.events.on("sidebar:item-remove", async (payload) => {
      const { id } = payload as { id: string };
      if (!id.startsWith(ID_PREFIX)) return;
      const path = id.slice(ID_PREFIX.length);
      if (!paths.includes(path)) return;
      paths = paths.filter((p) => p !== path);
      await persist();
      render();
    });
  },
});
