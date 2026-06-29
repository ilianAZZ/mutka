// SQLite Browser — a community module that turns the file explorer into a tiny
// database browser. Double-click a .sqlite / .db file and it opens in a right-pane
// panel: list of tables → click one → its rows → click a row → a modal with every
// column. All rendered declaratively (no React).
//
// REFERENCE MODULE — "parse a file format inside the worker". The core has NO
// SQLite/`db` capability: a .sqlite file IS the database, so the module just reads
// the raw bytes with `fs:read` (host.fs.readBytes → a Uint8Array) and decodes the
// SQLite on-disk format itself, entirely inside its sandboxed Web Worker. No host
// help, no Rust, no server, no socket. This is the pattern any format viewer
// (zip, pdf, parquet, …) should follow — read bytes, parse in the worker.
//
// Scope/limits (it's a viewer, kept small on purpose):
//   • read-only; never writes — it only ever reads the byte array in memory.
//   • the whole file is loaded into worker memory (same as sql.js would do).
//   • reads the main database file only — pending changes in a -wal sidecar
//     (WAL journal mode) are not merged in.
//   • table b-trees only (no index scans); INTEGER PRIMARY KEY alias columns read
//     back as NULL (the value lives in the rowid, which a viewer doesn't surface).
//
// Untrusted, runs ISOLATED in a Web Worker. Imports nothing.

const PANEL = "browser";
const ROW_LIMIT = 200;

// ── SQLite on-disk format decoder ───────────────────────────────────────────
// Format reference: https://www.sqlite.org/fileformat2.html

/** Read a big-endian base-128 varint at `off`. Returns [value (Number), byteLen]. */
function readVarint(view, off) {
  let result = 0n;
  for (let i = 0; i < 8; i++) {
    const byte = view.getUint8(off + i);
    result = (result << 7n) | BigInt(byte & 0x7f);
    if ((byte & 0x80) === 0) return [Number(result), i + 1];
  }
  // 9th byte contributes all 8 bits.
  result = (result << 8n) | BigInt(view.getUint8(off + 8));
  return [Number(result), 9];
}

/** Decode one value of the given serial type at `off`. Returns [value, byteLen]. */
function readValue(view, off, serial) {
  if (serial === 0) return [null, 0];           // NULL
  if (serial === 1) return [view.getInt8(off), 1];
  if (serial === 2) return [view.getInt16(off, false), 2];
  if (serial === 3) {                           // 24-bit signed
    let v = (view.getUint8(off) << 16) | (view.getUint8(off + 1) << 8) | view.getUint8(off + 2);
    if (v & 0x800000) v -= 0x1000000;
    return [v, 3];
  }
  if (serial === 4) return [view.getInt32(off, false), 4];
  if (serial === 5) {                           // 48-bit signed
    let v = 0n;
    for (let i = 0; i < 6; i++) v = (v << 8n) | BigInt(view.getUint8(off + i));
    if (v & 0x800000000000n) v -= 0x1000000000000n;
    return [Number(v), 6];
  }
  if (serial === 6) {                           // 64-bit signed
    const v = view.getBigInt64(off, false);
    const n = Number(v);
    return [Number.isSafeInteger(n) ? n : v.toString(), 8];
  }
  if (serial === 7) return [view.getFloat64(off, false), 8];
  if (serial === 8) return [0, 0];
  if (serial === 9) return [1, 0];
  // serial >= 12: even → BLOB of (n-12)/2 bytes, odd → TEXT of (n-13)/2 bytes.
  if (serial % 2 === 0) {
    const len = (serial - 12) / 2;
    return [`<${len} bytes>`, len];
  }
  const len = (serial - 13) / 2;
  const bytes = new Uint8Array(view.buffer, view.byteOffset + off, len);
  return [new TextDecoder().decode(bytes), len];
}

/** Decode a record (header of serial types + the values) into an array of cells. */
function decodeRecord(payload) {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  let [headerLen, n] = readVarint(view, 0);
  let p = n;
  const serials = [];
  while (p < headerLen) {
    const [serial, m] = readVarint(view, p);
    serials.push(serial);
    p += m;
  }
  let dataPos = headerLen;
  const values = [];
  for (const serial of serials) {
    const [val, size] = readValue(view, dataPos, serial);
    values.push(val);
    dataPos += size;
  }
  return values;
}

/** Read a cell payload that may spill onto overflow pages; returns the full bytes. */
function readPayload(file, view, off, payloadLen, db) {
  const { usable, pageSize } = db;
  const X = usable - 35; // max payload kept on a table-leaf page without overflow
  if (payloadLen <= X) return file.subarray(off, off + payloadLen);

  const M = Math.floor(((usable - 12) * 32) / 255) - 23;
  const K = M + ((payloadLen - M) % (usable - 4));
  const local = K <= X ? K : M;

  const result = new Uint8Array(payloadLen);
  result.set(file.subarray(off, off + local), 0);
  let written = local;
  let page = view.getUint32(off + local, false);
  while (page !== 0 && written < payloadLen) {
    const base = (page - 1) * pageSize;
    const next = view.getUint32(base, false);
    const chunk = Math.min(usable - 4, payloadLen - written);
    result.set(file.subarray(base + 4, base + 4 + chunk), written);
    written += chunk;
    page = next;
  }
  return result;
}

/** Walk a table b-tree rooted at `pageNum`, pushing decoded records into `out`. */
function walkTable(db, pageNum, out, limit) {
  if (out.length >= limit) return;
  const { file, view, pageSize } = db;
  const base = (pageNum - 1) * pageSize;
  const hdr = base + (pageNum === 1 ? 100 : 0); // page 1 starts after the 100-byte file header
  const type = view.getUint8(hdr);
  const cellCount = view.getUint16(hdr + 3, false);
  const interior = type === 5;
  const ptrBase = hdr + (interior ? 12 : 8);

  if (type === 5) {            // interior table page: recurse into children
    for (let i = 0; i < cellCount && out.length < limit; i++) {
      const cellOff = base + view.getUint16(ptrBase + i * 2, false);
      walkTable(db, view.getUint32(cellOff, false), out, limit);
    }
    if (out.length < limit) walkTable(db, view.getUint32(hdr + 8, false), out, limit);
  } else if (type === 13) {    // leaf table page: decode each row
    for (let i = 0; i < cellCount && out.length < limit; i++) {
      let cellOff = base + view.getUint16(ptrBase + i * 2, false);
      const [payloadLen, n1] = readVarint(view, cellOff);
      cellOff += n1;
      const [, n2] = readVarint(view, cellOff); // rowid — not surfaced
      cellOff += n2;
      out.push(decodeRecord(readPayload(file, view, cellOff, payloadLen, db)));
    }
  }
  // Other page types (index b-trees) are never reached from a table rootpage.
}

/** Validate the header and read the page geometry. Returns a db handle. */
function openSqlite(file) {
  const MAGIC = "SQLite format 3\0";
  for (let i = 0; i < MAGIC.length; i++) {
    if (file[i] !== MAGIC.charCodeAt(i)) throw new Error("Not a SQLite database file");
  }
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  let pageSize = view.getUint16(16, false);
  if (pageSize === 1) pageSize = 65536; // the documented escape value
  const usable = pageSize - view.getUint8(20); // minus reserved bytes per page
  return { file, view, pageSize, usable };
}

/** Pull column names out of a CREATE TABLE statement (best-effort). */
function parseColumns(sql) {
  if (!sql) return [];
  const open = sql.indexOf("(");
  const close = sql.lastIndexOf(")");
  if (open < 0 || close <= open) return [];
  const cols = [];
  for (const part of splitTopLevel(sql.slice(open + 1, close))) {
    const t = part.trim();
    if (!t || /^(PRIMARY|UNIQUE|CHECK|FOREIGN|CONSTRAINT)\b/i.test(t)) continue;
    const m = t.match(/^("(?:[^"]|"")*"|`[^`]*`|\[[^\]]*\]|\S+)/);
    if (!m) continue;
    let name = m[1];
    if (name[0] === '"') name = name.slice(1, -1).replace(/""/g, '"');
    else if (name[0] === "`" || name[0] === "[") name = name.slice(1, -1);
    cols.push(name);
  }
  return cols;
}

/** Split on top-level commas, ignoring commas inside quotes or parentheses. */
function splitTopLevel(s) {
  const out = [];
  let depth = 0, cur = "", quote = null;
  for (const c of s) {
    if (quote) { cur += c; if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; cur += c; continue; }
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

// ── Module ──────────────────────────────────────────────────────────────────

/** Last path segment, no extension — a friendly DB name. */
function dbNameOf(path) {
  const base = path.replace(/\/+$/, "").split("/").pop() || path;
  return base.replace(/\.(sqlite3?|db)$/i, "");
}

function cell(v) {
  return v === null || v === undefined ? "∅" : String(v);
}

export default {
  id: "com.sqlite-browser",
  name: "SQLite Browser",
  version: "1.0.0",
  icon: "data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2024%2024'%3E%3Crect%20width%3D'24'%20height%3D'24'%20rx%3D'6'%20fill%3D'%23e0883a'%2F%3E%3Cellipse%20cx%3D'12'%20cy%3D'7'%20rx%3D'6'%20ry%3D'2.3'%20fill%3D'%23fff'%2F%3E%3Cpath%20d%3D'M6%207v10c0%201.3%202.7%202.3%206%202.3s6-1%206-2.3V7'%20stroke%3D'%23fff'%20stroke-width%3D'1.5'%20fill%3D'none'%2F%3E%3Cpath%20d%3D'M6%2012c0%201.3%202.7%202.3%206%202.3s6-1%206-2.3'%20stroke%3D'%23fff'%20stroke-width%3D'1.5'%20fill%3D'none'%2F%3E%3C%2Fsvg%3E",
  author: { name: "Ilian", github: "ilianAZZ" },
  tags: ["database","sqlite","viewer"],
  description: "Browse a .sqlite/.db file's tables and rows in the right pane.",
  permissions: ["fs:read", "ui"],
  panels: [{ id: PANEL, title: "SQL", icon: "terminal", side: "right", defaultWidth: 320 }],
  openHandlers: [
    { id: "com.sqlite-browser.open", priority: 10, match: { extensions: ["sqlite", "sqlite3", "db"] }, handler: "openDb" },
  ],
  setup(host) {
    const state = { path: null, name: "", view: "tables", tables: [], meta: {}, db: null, table: null, columns: [], rows: [], error: "" };

    // ── Render the panel for the current state ────────────────────────────────
    function render() {
      if (!state.path) {
        host.ui.render(PANEL, {
          type: "vstack", gap: 8, children: [
            { type: "text", text: "No database open", weight: "bold" },
            { type: "text", text: "Double-click a .sqlite or .db file to browse it.", muted: true, size: "sm" },
          ],
        });
        return;
      }
      if (state.error) {
        host.ui.render(PANEL, {
          type: "vstack", gap: 8, children: [
            { type: "text", text: state.name, weight: "bold" },
            { type: "divider" },
            { type: "text", text: state.error, size: "sm", tint: "var(--text-mid)" },
            { type: "button", label: "Back to tables", action: "back" },
          ],
        });
        return;
      }
      if (state.view === "tables") {
        const items = state.tables.map((t) => ({ id: t, label: t, icon: "package", action: "open-table", value: t }));
        host.ui.render(PANEL, {
          type: "vstack", gap: 8, children: [
            { type: "text", text: state.name, weight: "bold" },
            { type: "text", text: `${state.tables.length} tables`, muted: true, size: "sm" },
            { type: "divider" },
            ...(items.length ? [{ type: "list", items }] : [{ type: "text", text: "No tables.", muted: true, size: "sm" }]),
          ],
        });
        return;
      }
      // Rows view.
      const items = state.rows.map((row, i) => ({
        id: String(i),
        label: row.slice(0, 3).map(cell).join("  ·  ") || "(empty row)",
        action: "open-row",
        value: i,
      }));
      host.ui.render(PANEL, {
        type: "vstack", gap: 8, children: [
          { type: "button", label: "← Tables", action: "back" },
          { type: "text", text: state.table, weight: "bold" },
          { type: "text", text: `${state.rows.length} rows (max ${ROW_LIMIT}) · ${state.columns.join(", ")}`, muted: true, size: "sm" },
          { type: "divider" },
          ...(items.length ? [{ type: "list", items }] : [{ type: "text", text: "No rows.", muted: true, size: "sm" }]),
        ],
      });
    }

    // ── Actions ───────────────────────────────────────────────────────────────
    async function openDb(path) {
      state.path = path;
      state.name = dbNameOf(path);
      state.view = "tables";
      state.table = null;
      state.error = "";
      state.db = null;
      try {
        const file = await host.fs.readBytes(path); // Uint8Array — the whole .sqlite file
        const db = openSqlite(file);
        state.db = db;
        // sqlite_master lives in the page-1 table b-tree: (type, name, tbl_name, rootpage, sql).
        const schema = [];
        walkTable(db, 1, schema, Infinity);
        state.meta = {};
        const tables = [];
        for (const [type, name, , rootpage, sql] of schema) {
          if (type === "table" && typeof name === "string" && !name.startsWith("sqlite_")) {
            tables.push(name);
            state.meta[name] = { rootpage: Number(rootpage), sql: typeof sql === "string" ? sql : "" };
          }
        }
        state.tables = tables.sort();
      } catch (err) {
        state.error = `Could not read database: ${String((err && err.message) || err)}`;
        state.tables = [];
      }
      render();
    }

    function openTable(name) {
      state.error = "";
      try {
        const meta = state.meta[name];
        if (!meta) throw new Error("Unknown table");
        const rows = [];
        walkTable(state.db, meta.rootpage, rows, ROW_LIMIT);
        const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
        let columns = parseColumns(meta.sql);
        if (columns.length < width) for (let i = columns.length; i < width; i++) columns.push(`col${i + 1}`);
        else if (width > 0 && columns.length > width) columns = columns.slice(0, width);
        state.table = name;
        state.columns = columns;
        state.rows = rows;
        state.view = "rows";
      } catch (err) {
        state.error = `Read failed: ${String((err && err.message) || err)}`;
      }
      render();
    }

    function openRow(index) {
      const row = state.rows[index];
      if (!row) return;
      host.ui.modal({
        type: "vstack", gap: 8, children: [
          { type: "text", text: `${state.table} · row ${index + 1}`, weight: "bold", size: "lg" },
          { type: "divider" },
          ...state.columns.map((col, i) => ({ type: "row", label: col, value: cell(row[i]) })),
          { type: "divider" },
          { type: "button", label: "Close", action: "close-modal", variant: "primary" },
        ],
      });
    }

    host.onOpen("openDb", (item) => openDb(item.path));
    host.onUIEvent("open-table", (name) => openTable(String(name)));
    host.onUIEvent("open-row", (index) => openRow(Number(index)));
    host.onUIEvent("back", () => { state.view = "tables"; state.error = ""; render(); });
    host.onUIEvent("close-modal", () => host.ui.modal(null));

    host.events.on("app:ready", render);
    render();
  },
};
