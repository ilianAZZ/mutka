import { defineModule } from "../core/sandbox/defineModule";
import type { FileItem } from "../core/types";
import type { SidebarItem } from "../core/module-registry/module-registry.types";

// Generic multi-account WebDAV provider. Registers the "webdav" scheme:
//   webdav:<accountId>/path   →  one configured server account.
// Browsing lists folders over WebDAV (PROPFIND), opening downloads, and
// create/rename/delete map to MKCOL/PUT/MOVE/DELETE. Works with any WebDAV
// server (Nextcloud, ownCloud, Apache mod_dav, …).
//
// Accounts ({ id, name, url, username }) live in `config` (storage); each
// PASSWORD lives in the macOS Keychain via the `secrets` capability — never in
// plaintext. Manage them in Settings → WebDAV. Each account shows as a renamable,
// removable entry in the left "Places" sidebar under "Cloud".
//
// Built-in (in-process): a provider intercepts the whole file view (high trust)
// and parses XML with DOMParser, which the worker realm lacks.
//
// PATH ENCODING: virtual paths are stored DECODED so the UI shows real names; we
// percent-encode each segment only when building a request URL.

const SCHEME = "webdav";
const ACCOUNTS_KEY = "accounts";
const ITEM_PREFIX = "core.webdav.account:";
const PROPFIND_BODY =
  `<?xml version="1.0"?>` +
  `<d:propfind xmlns:d="DAV:"><d:prop>` +
  `<d:displayname/><d:getlastmodified/><d:getcontentlength/><d:resourcetype/>` +
  `</d:prop></d:propfind>`;

interface NetResponse { status: number; body: string }
interface Account { id: string; name: string; url: string; username: string }

function basename(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed.slice(trimmed.lastIndexOf("/") + 1) || "/";
}

function extensionOf(name: string, isDir: boolean): string | undefined {
  if (isDir) return undefined;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : undefined;
}

/** Percent-encode each path segment (keeps the slashes). */
function encodePath(p: string): string {
  return p.split("/").map(encodeURIComponent).join("/");
}

function safeDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

/** Split a virtual path "webdav:<accountId>/sub" into its parts. */
function parsePath(path: string): { accountId: string; sub: string } {
  const raw = path.slice(`${SCHEME}:`.length);
  const slash = raw.indexOf("/");
  if (slash === -1) return { accountId: raw, sub: "/" };
  return { accountId: raw.slice(0, slash), sub: raw.slice(slash) || "/" };
}

export default defineModule({
  id: "core.webdav",
  name: "WebDAV",
  version: "1.0.0",
  description: "Browse and edit WebDAV servers (Nextcloud, ownCloud, …) — multiple accounts.",
  permissions: ["network", "storage", "secrets", "fs:read"],
  fileSystemProviders: [SCHEME],
  setup(host) {
    const accounts = async (): Promise<Account[]> => {
      const raw = (await host.config.get(ACCOUNTS_KEY)) as string | null;
      try { return raw ? (JSON.parse(raw) as Account[]) : []; } catch { return []; }
    };

    const credsFor = async (accountId: string) => {
      const account = (await accounts()).find((a) => a.id === accountId);
      if (!account) throw new Error("Unknown WebDAV account — re-add it in Settings → WebDAV.");
      const password = ((await host.secrets.get(accountId)) as string | null) ?? "";
      return { base: account.url.replace(/\/+$/, ""), username: account.username, password };
    };

    const auth = (username: string, password: string): Record<string, string> =>
      username ? { Authorization: `Basic ${btoa(`${username}:${password}`)}` } : {};

    // A WebDAV request for a virtual path. Resolves the account, encodes the path.
    const dav = async (
      path: string,
      method: string,
      init: { body?: string; headers?: Record<string, string> } = {}
    ): Promise<{ res: NetResponse; base: string; accountId: string }> => {
      const { accountId, sub } = parsePath(path);
      const { base, username, password } = await credsFor(accountId);
      const res = (await host.net.request({
        url: base + encodePath(sub),
        method,
        headers: { ...auth(username, password), ...(init.headers ?? {}) },
        body: init.body,
      })) as NetResponse;
      if (res.status === 401) throw new Error("WebDAV authentication failed (401) — check the account's password.");
      if (res.status < 200 || res.status >= 300) throw new Error(`WebDAV ${method} failed: HTTP ${res.status}`);
      return { res, base, accountId };
    };

    // ── Sidebar: one entry per account ────────────────────────────────────────
    const renderSidebar = async () => {
      const items: SidebarItem[] = (await accounts()).map((a) => ({
        id: ITEM_PREFIX + a.id,
        label: a.name || a.username || "WebDAV",
        icon: "cloud",
        category: "Cloud",
        path: `${SCHEME}:${a.id}/`,
        removable: true,
      }));
      host.sidebar.set(items);
    };

    const removeAccount = async (accountId: string) => {
      const remaining = (await accounts()).filter((a) => a.id !== accountId);
      await host.config.set(ACCOUNTS_KEY, JSON.stringify(remaining));
      await host.secrets.delete(accountId);
      await renderSidebar();
    };

    void renderSidebar();
    host.events.on("webdav:accounts-changed", () => { void renderSidebar(); });
    host.events.on("sidebar:item-remove", (payload) => {
      const { id } = payload as { id: string };
      if (id.startsWith(ITEM_PREFIX)) void removeAccount(id.slice(ITEM_PREFIX.length));
    });

    // ── Read ──────────────────────────────────────────────────────────────────
    host.onList(SCHEME, async (path): Promise<FileItem[]> => {
      const { accountId, sub } = parsePath(path);
      const { res, base } = await dav(path, "PROPFIND", {
        body: PROPFIND_BODY,
        headers: { Depth: "1", "Content-Type": "application/xml" },
      });

      const prefix = new URL(base).pathname.replace(/\/+$/, "");
      const requested = sub.replace(/\/+$/, "");
      const doc = new DOMParser().parseFromString(res.body, "application/xml");
      const items: FileItem[] = [];

      for (const resp of Array.from(doc.getElementsByTagNameNS("DAV:", "response"))) {
        const hrefRaw = resp.getElementsByTagNameNS("DAV:", "href")[0]?.textContent ?? "";
        const hrefPath = new URL(hrefRaw, base).pathname;
        const rel = safeDecode(hrefPath.slice(prefix.length).replace(/\/+$/, ""));
        if (rel === requested) continue; // the directory itself

        const isDir = resp.getElementsByTagNameNS("DAV:", "collection").length > 0;
        const name = basename(rel);
        const sizeText = resp.getElementsByTagNameNS("DAV:", "getcontentlength")[0]?.textContent ?? "0";
        const modText = resp.getElementsByTagNameNS("DAV:", "getlastmodified")[0]?.textContent ?? "";
        items.push({
          name,
          path: `${SCHEME}:${accountId}${rel || "/"}`,
          isDir,
          size: Number.parseInt(sizeText, 10) || 0,
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
      const { accountId, sub } = parsePath(path);
      const { base, username, password } = await credsFor(accountId);
      const local = (await host.net.download({
        url: base + encodePath(sub),
        filename: basename(sub),
        headers: auth(username, password),
      })) as string;
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

    // Copy/move INTO a WebDAV folder. Local sources are uploaded (PUT, bytes stay
    // in Rust); same-account remote sources use WebDAV COPY/MOVE.
    const transfer = async (sources: string[], destDir: string, mode: "copy" | "move") => {
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
          const res = (await host.net.request({
            url: base + encodePath(s.sub),
            method,
            headers: { ...headers, Destination: targetUrl, Overwrite: "F" },
          })) as NetResponse;
          if (res.status < 200 || res.status >= 300) throw new Error(`WebDAV ${method} failed: HTTP ${res.status}`);
        } else {
          await host.net.upload({ localPath: src, url: targetUrl, headers });
        }
      }
    };

    host.onCopyFiles(SCHEME, (paths, dest) => transfer(paths, dest, "copy"));
    host.onMoveFiles(SCHEME, (paths, dest) => transfer(paths, dest, "move"));
  },
});
