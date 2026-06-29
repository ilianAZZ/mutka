// WebDAV — a REAL community module. Untrusted, runs ISOLATED in a Web Worker.
//
// It used to be a built-in because it parsed PROPFIND XML with DOMParser, which
// the worker realm lacks. This version ships a tiny string-based XML parser (no
// DOM, no dependency), so it needs nothing from the app: it is a plain module
// like any other, proving the file-system-provider + declarative-UI story
// end-to-end. To add sftp/s3/… you write another module like this — zero core
// changes.
//
// Registers the "webdav" scheme:  webdav:<accountId>/path  → one server account.
// Browsing = PROPFIND, opening = download, create/rename/delete = MKCOL/PUT/MOVE/
// DELETE. Accounts ({ id, name, url, username }) live in `config`; each PASSWORD
// lives in the macOS Keychain via `secrets` — never plaintext. Manage them in
// Settings → WebDAV (a declarative section this module renders itself) and in the
// left "Places" sidebar under "Cloud".
//
// PATH ENCODING: virtual paths are stored DECODED so the UI shows real names; we
// percent-encode each segment only when building a request URL.

const SCHEME = "webdav";
const ACCOUNTS_KEY = "accounts";
const ITEM_PREFIX = "com.webdav.account:";
const SETTINGS_SURFACE = "accounts";
const PROPFIND_BODY =
  `<?xml version="1.0"?>` +
  `<d:propfind xmlns:d="DAV:"><d:prop>` +
  `<d:getlastmodified/><d:getcontentlength/><d:resourcetype/>` +
  `</d:prop></d:propfind>`;

function basename(path) {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed.slice(trimmed.lastIndexOf("/") + 1) || "/";
}

function extensionOf(name, isDir) {
  if (isDir) return undefined;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : undefined;
}

/** Percent-encode each path segment (keeps the slashes). */
function encodePath(p) {
  return p.split("/").map(encodeURIComponent).join("/");
}

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

/** Split a virtual path "webdav:<accountId>/sub" into its parts. */
function parsePath(path) {
  const raw = path.slice(`${SCHEME}:`.length);
  const slash = raw.indexOf("/");
  if (slash === -1) return { accountId: raw, sub: "/" };
  return { accountId: raw.slice(0, slash), sub: raw.slice(slash) || "/" };
}

// ── Tiny string XML parser (no DOMParser) ───────────────────────────────────
// PROPFIND responses are regular enough to parse with namespace-agnostic regex:
// any prefix ("d:", "D:", none) is accepted. We only need <response> blocks plus
// <href>, <getcontentlength>, <getlastmodified> and the presence of <collection>.

function unescapeXml(s) {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&"); // must be last
}

function firstTag(block, name) {
  const m = block.match(new RegExp(`<(?:[\\w-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, "i"));
  return m ? unescapeXml(m[1].trim()) : "";
}

function hasTag(block, name) {
  return new RegExp(`<(?:[\\w-]+:)?${name}(?:[\\s/>])`, "i").test(block);
}

function splitResponses(xml) {
  const out = [];
  const re = /<(?:[\w-]+:)?response(?:\s[^>]*)?>[\s\S]*?<\/(?:[\w-]+:)?response>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[0]);
  return out;
}

export default {
  id: "com.webdav",
  name: "WebDAV",
  version: "1.0.0",
  icon: "data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2024%2024'%3E%3Crect%20width%3D'24'%20height%3D'24'%20rx%3D'6'%20fill%3D'%2364748b'%2F%3E%3Ccircle%20cx%3D'12'%20cy%3D'12'%20r%3D'6.5'%20stroke%3D'%23fff'%20stroke-width%3D'1.5'%20fill%3D'none'%2F%3E%3Cpath%20d%3D'M5.5%2012h13M12%205.5c2%202.2%202%2010.8%200%2013M12%205.5c-2%202.2-2%2010.8%200%2013'%20stroke%3D'%23fff'%20stroke-width%3D'1.3'%20fill%3D'none'%2F%3E%3C%2Fsvg%3E",
  author: { name: "Ilian", github: "ilianAZZ" },
  tags: ["network","cloud","filesystem"],
  description: "Browse and edit WebDAV servers (Nextcloud, ownCloud, …) — multiple accounts.",
  permissions: ["network:public", "network:local", "storage", "secrets", "fs:read", "fs:temp", "ui"],
  fileSystemProviders: [SCHEME],
  settingsSections: [{ id: SETTINGS_SURFACE, title: "WebDAV Accounts" }],
  setup(host) {
    // undefined → account list; null → adding; string → editing that account id.
    let editing = undefined;

    const accounts = async () => {
      const raw = await host.config.get(ACCOUNTS_KEY);
      try { return raw ? JSON.parse(raw) : []; } catch { return []; }
    };

    const credsFor = async (accountId) => {
      const account = (await accounts()).find((a) => a.id === accountId);
      if (!account) throw new Error("Unknown WebDAV account — re-add it in Settings → WebDAV.");
      const password = (await host.secrets.get(accountId)) ?? "";
      return { base: account.url.replace(/\/+$/, ""), username: account.username, password };
    };

    const auth = (username, password) =>
      username ? { Authorization: `Basic ${btoa(`${username}:${password}`)}` } : {};

    // A WebDAV request for a virtual path. Resolves the account, encodes the path.
    const dav = async (path, method, init = {}) => {
      const { accountId, sub } = parsePath(path);
      const { base, username, password } = await credsFor(accountId);
      const res = await host.net.request({
        url: base + encodePath(sub),
        method,
        headers: { ...auth(username, password), ...(init.headers ?? {}) },
        body: init.body,
      });
      if (res.status === 401) throw new Error("WebDAV authentication failed (401) — check the account's password.");
      if (res.status < 200 || res.status >= 300) throw new Error(`WebDAV ${method} failed: HTTP ${res.status}`);
      return { res, base, accountId };
    };

    // ── Left sidebar: one entry per account ───────────────────────────────────
    const renderSidebar = async () => {
      const items = (await accounts()).map((a) => ({
        id: ITEM_PREFIX + a.id,
        label: a.name || a.username || "WebDAV",
        icon: "cloud",
        category: "Cloud",
        path: `${SCHEME}:${a.id}/`,
        removable: true,
      }));
      host.sidebar.set(items);
    };

    // ── Settings section: account management (declarative, no React) ──────────
    const accountFormTree = (draft) => ({
      type: "vstack",
      gap: 10,
      children: [
        { type: "text", text: draft.id ? "Edit account" : "Add account", weight: "bold" },
        {
          type: "form",
          action: "wd.save",
          submitLabel: "Save",
          schema: {
            type: "object",
            required: ["url"],
            properties: {
              name: { type: "string", title: "Name", default: draft.name || "" },
              url: {
                type: "string", title: "Server URL", default: draft.url || "",
                description: "Nextcloud: https://host/remote.php/dav/files/USERNAME/",
              },
              username: { type: "string", title: "Username", default: draft.username || "" },
              password: {
                type: "string", format: "password",
                title: draft.id ? "Password (blank = keep current)" : "App password",
              },
            },
          },
        },
        { type: "button", label: "Cancel", action: "wd.cancel" },
      ],
    });

    const renderSettings = async () => {
      const list = await accounts();
      if (editing !== undefined) {
        const acc = editing ? list.find((a) => a.id === editing) : null;
        host.ui.render(SETTINGS_SURFACE, accountFormTree(acc || { id: null }));
        return;
      }
      const children = [
        { type: "button", label: "Add account", action: "wd.add", variant: "primary", icon: "cloud" },
        { type: "divider" },
      ];
      if (!list.length) {
        children.push({ type: "text", text: "No accounts yet.", muted: true, size: "sm" });
      }
      for (const a of list) {
        children.push({
          type: "hstack", gap: 8, align: "center", children: [
            {
              type: "vstack", gap: 2, children: [
                { type: "text", text: a.name, weight: "medium" },
                { type: "text", text: (a.username ? `${a.username} · ` : "") + a.url, muted: true, size: "sm" },
              ],
            },
            { type: "button", label: "Edit", action: "wd.edit", value: a.id },
            { type: "button", label: "Remove", action: "wd.remove", value: a.id, variant: "danger" },
          ],
        });
      }
      host.ui.render(SETTINGS_SURFACE, { type: "vstack", gap: 8, children });
    };

    const refreshUI = async () => { await renderSidebar(); await renderSettings(); };

    const saveAccount = async (values) => {
      const url = String(values.url || "").trim();
      if (!url) return;
      const id = editing || crypto.randomUUID();
      const account = {
        id,
        name: String(values.name || "").trim() || String(values.username || "").trim() || "WebDAV",
        url,
        username: String(values.username || "").trim(),
      };
      const list = await accounts();
      const next = editing ? list.map((a) => (a.id === id ? account : a)) : [...list, account];
      await host.config.set(ACCOUNTS_KEY, JSON.stringify(next));
      if (values.password) await host.secrets.set(id, String(values.password));
    };

    const removeAccount = async (accountId) => {
      const remaining = (await accounts()).filter((a) => a.id !== accountId);
      await host.config.set(ACCOUNTS_KEY, JSON.stringify(remaining));
      await host.secrets.delete(accountId);
    };

    host.onUIEvent("wd.add", () => { editing = null; void renderSettings(); });
    host.onUIEvent("wd.edit", (id) => { editing = String(id); void renderSettings(); });
    host.onUIEvent("wd.cancel", () => { editing = undefined; void renderSettings(); });
    host.onUIEvent("wd.remove", async (id) => {
      await removeAccount(String(id));
      editing = undefined;
      await refreshUI();
    });
    host.onUIEvent("wd.save", async (values) => {
      await saveAccount(values || {});
      editing = undefined;
      await refreshUI();
    });

    host.events.on("sidebar:item-remove", (payload) => {
      const { id } = payload;
      if (id && id.startsWith(ITEM_PREFIX)) {
        void removeAccount(id.slice(ITEM_PREFIX.length)).then(refreshUI);
      }
    });

    // ── Read ──────────────────────────────────────────────────────────────────
    host.onList(SCHEME, async (path) => {
      const { accountId, sub } = parsePath(path);
      const { res, base } = await dav(path, "PROPFIND", {
        body: PROPFIND_BODY,
        headers: { Depth: "1", "Content-Type": "application/xml" },
      });

      const prefix = new URL(base).pathname.replace(/\/+$/, "");
      const requested = sub.replace(/\/+$/, "");
      const items = [];

      for (const block of splitResponses(res.body)) {
        const hrefRaw = firstTag(block, "href");
        if (!hrefRaw) continue;
        const hrefPath = new URL(hrefRaw, base).pathname;
        const rel = safeDecode(hrefPath.slice(prefix.length).replace(/\/+$/, ""));
        if (rel === requested) continue; // the directory itself

        const isDir = hasTag(block, "collection");
        const name = basename(rel);
        const size = Number.parseInt(firstTag(block, "getcontentlength"), 10) || 0;
        const modText = firstTag(block, "getlastmodified");
        items.push({
          name,
          path: `${SCHEME}:${accountId}${rel || "/"}`,
          isDir,
          size,
          modified: modText ? Math.floor(Date.parse(modText) / 1000) || 0 : 0,
          extension: extensionOf(name, isDir),
          isHidden: name.startsWith("."),
          isSymlink: false,
          isPackage: false,
          hasCustomIcon: false,
        });
      }
      return items;
    });

    host.onOpenFile(SCHEME, async (path) => {
      const { sub } = parsePath(path);
      const { base, username, password } = await credsFor(parsePath(path).accountId);
      // Fetch over the network (network), stage the bytes in a temp file (fs:temp),
      // then open it (fs:read) — one permission per step, no hidden disk write.
      const res = await host.net.request({
        url: base + encodePath(sub),
        headers: auth(username, password),
      });
      if (res.status < 200 || res.status >= 300) throw new Error(`WebDAV GET failed: HTTP ${res.status}`);
      const local = await host.sys.writeTempFile(basename(sub), res.bytes);
      await host.fs.openItem(local);
    });

    // ── Write ─────────────────────────────────────────────────────────────────
    host.onCreateFolder(SCHEME, async (path) => { await dav(path, "MKCOL"); });
    host.onCreateFile(SCHEME, async (path) => { await dav(path, "PUT", { body: "" }); });
    host.onDeleteItem(SCHEME, async (path) => { await dav(path, "DELETE"); });
    host.onRenameItem(SCHEME, async (from, to) => {
      const a = parsePath(from);
      const b = parsePath(to);
      if (a.accountId !== b.accountId) throw new Error("Cannot move between WebDAV accounts.");
      const { base } = await credsFor(a.accountId);
      const destination = base.replace(/\/+$/, "") + encodePath(b.sub);
      await dav(from, "MOVE", { headers: { Destination: destination, Overwrite: "F" } });
    });

    // Copy/move INTO a WebDAV folder. Local sources are read (fs:read) and PUT as
    // the request body; same-account remote sources use WebDAV COPY/MOVE.
    const transfer = async (sources, destDir, mode) => {
      const { accountId, sub: destSub } = parsePath(destDir);
      const { base, username, password } = await credsFor(accountId);
      const headers = auth(username, password);
      const destBase = destSub.replace(/\/+$/, "");
      for (const src of sources) {
        const targetUrl = base + encodePath(`${destBase}/${basename(src)}`);
        if (src.startsWith(`${SCHEME}:`)) {
          const s = parsePath(src);
          if (s.accountId !== accountId) throw new Error("Cannot copy/move between WebDAV accounts.");
          const method = mode === "move" ? "MOVE" : "COPY";
          const res = await host.net.request({
            url: base + encodePath(s.sub),
            method,
            headers: { ...headers, Destination: targetUrl, Overwrite: "F" },
          });
          if (res.status < 200 || res.status >= 300) throw new Error(`WebDAV ${method} failed: HTTP ${res.status}`);
        } else {
          const bytes = await host.fs.readBytes(src);
          const res = await host.net.request({ url: targetUrl, method: "PUT", headers, body: bytes });
          if (res.status < 200 || res.status >= 300) throw new Error(`WebDAV PUT failed: HTTP ${res.status}`);
        }
      }
    };

    host.onCopyFiles(SCHEME, (paths, dest) => transfer(paths, dest, "copy"));
    host.onMoveFiles(SCHEME, (paths, dest) => transfer(paths, dest, "move"));

    // Initial render of the sidebar entries + settings section.
    void refreshUI();
  },
};
