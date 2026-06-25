import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileItem } from "../../core/types";
import type { SortKey, SortState } from "../../core/stores/listing.types";
import type { ColumnDescriptor, ColumnCellState } from "../../core/columns/column.types";
import { FileIcon } from "./FileIcon";
import "./FileList.css";

interface Props {
  files: FileItem[];
  selected: FileItem[];
  cutItems: FileItem[];
  sort: SortState;
  /** The directory currently shown — destination for drops on the empty area. */
  currentDir: string;
  /** Module-contributed columns that apply to the current directory. */
  extraColumns?: ColumnDescriptor[];
  /** Per-path cell state for each extra column. */
  cellData?: Record<string, Record<string, ColumnCellState>>;
  /** Persisted width overrides, keyed by built-in sort key or custom column id. */
  columnWidths?: Record<string, number>;
  /** Commit a new width for a column (live during a header drag). */
  onColumnResize?: (id: string, width: number) => void;
  /** Error message to show in place of the listing (e.g. a failed remote load). */
  error?: string | null;
  onSelect: (items: FileItem[]) => void;
  onOpen: (item: FileItem) => void;
  onSortChange: (key: SortKey) => void;
  onModifierOpen?: (item: FileItem, modifiers: { ctrl: boolean; meta: boolean }) => void;
  onMiddleClick?: (item: FileItem) => void;
  /** Move dragged paths into a destination directory (internal drag & drop). */
  onMoveItems?: (paths: string[], destPath: string) => void;
  /** Files dropped from outside the app (e.g. Finder) onto a folder. */
  onDropExternal?: (files: FileList, destPath: string) => void;
  /** Start a native OS drag of items so dropping on Finder/other apps moves the real files. */
  onNativeDrag?: (items: FileItem[]) => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const COLUMNS: { key: SortKey; label: string; className: string }[] = [
  { key: "name", label: "Name", className: "col-name" },
  { key: "date", label: "Date modified", className: "col-date" },
  { key: "type", label: "Type", className: "col-type" },
  { key: "size", label: "Size", className: "col-size" },
];

/** Default widths of the resizable built-in columns. A trailing 1fr spacer (not
    a real column) eats the leftover space, so every column is fixed + resizable
    and resizing one only pushes the columns to its right — never the reverse. */
const BUILTIN_DEFAULT_WIDTH: Record<string, number> = { name: 280, date: 180, type: 100, size: 90 };

function renderCell(state: ColumnCellState | undefined): React.ReactNode {
  if (!state || state === "loading") return null;
  return (
    <>
      {state.icon && <img className="col-extra-icon" src={state.icon} alt="" />}
      {state.text && <span style={state.tint ? { color: state.tint } : undefined}>{state.text}</span>}
      {state.badge && <span className="col-extra-badge">{state.badge}</span>}
    </>
  );
}

export function FileList({
  files, selected, cutItems, sort, error, currentDir, extraColumns, cellData, columnWidths, onColumnResize,
  onSelect, onOpen, onSortChange, onModifierOpen, onMiddleClick, onMoveItems, onDropExternal, onNativeDrag,
}: Props) {
  const columns = extraColumns ?? [];
  // Effective width of a column: a stored override, else its default.
  const ew = useCallback(
    (id: string, def: number) => columnWidths?.[id] ?? def,
    [columnWidths]
  );
  // Every column is a fixed px track; a trailing 1fr spacer absorbs leftover
  // width so rows stay full-width and resizing only pushes columns rightward.
  const gridStyle = useMemo<React.CSSProperties>(() => ({
    gridTemplateColumns: [
      `${ew("name", BUILTIN_DEFAULT_WIDTH.name)}px`,
      `${ew("date", BUILTIN_DEFAULT_WIDTH.date)}px`,
      `${ew("type", BUILTIN_DEFAULT_WIDTH.type)}px`,
      `${ew("size", BUILTIN_DEFAULT_WIDTH.size)}px`,
      ...columns.map((c) => `${ew(c.id, c.width ?? 100)}px`),
      "1fr",
    ].join(" "),
  }), [columns, ew]);

  // Drag a header's right edge to resize that column. Listeners live only for the
  // duration of the drag; widths are committed live so the grid tracks the cursor.
  const startResize = useCallback((e: React.MouseEvent, id: string, startWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onColumnResize) return;
    const startX = e.clientX;
    const onMove = (ev: MouseEvent) => onColumnResize(id, startWidth + (ev.clientX - startX));
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "col-resize";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [onColumnResize]);

  const selectedPaths = new Set(selected.map((f) => f.path));
  const cutPaths = new Set(cutItems.map((f) => f.path));
  const dragPathsRef = useRef<string[]>([]);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [bgDrop, setBgDrop] = useState(false);

  // Files dropped from outside onto the empty area → the current directory.
  const handleBgDragOver = useCallback((e: React.DragEvent) => {
    if (!onDropExternal || !e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setBgDrop(true);
  }, [onDropExternal]);

  const handleBgDrop = useCallback((e: React.DragEvent) => {
    setBgDrop(false);
    if (!onDropExternal || e.dataTransfer.files.length === 0) return;
    e.preventDefault();
    onDropExternal(e.dataTransfer.files, currentDir);
  }, [onDropExternal, currentDir]);

  const handleClick = useCallback(
    (e: React.MouseEvent, item: FileItem) => {
      if (e.metaKey || e.ctrlKey) {
        if (selectedPaths.has(item.path)) {
          onSelect(selected.filter((f) => f.path !== item.path));
        } else {
          onSelect([...selected, item]);
        }
      } else if (e.shiftKey && selected.length > 0) {
        const last = selected[selected.length - 1];
        const lastIdx = files.findIndex((f) => f.path === last.path);
        const thisIdx = files.findIndex((f) => f.path === item.path);
        const [from, to] = lastIdx < thisIdx ? [lastIdx, thisIdx] : [thisIdx, lastIdx];
        onSelect(files.slice(from, to + 1));
      } else {
        onSelect([item]);
      }
    },
    [files, selected, selectedPaths, onSelect]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, item: FileItem) => {
      // Drag the whole selection if the dragged row is part of it; otherwise just this row.
      const dragItems = selectedPaths.has(item.path) ? selected : [item];
      const paths = dragItems.map((f) => f.path);
      dragPathsRef.current = paths;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", paths.join("\n")); // keeps the in-app folder-drop working
      // Also start a NATIVE drag so dropping on Finder/another app moves the real
      // files (not just their text paths) — the Finder behaviour.
      onNativeDrag?.(dragItems);
    },
    [selected, selectedPaths, onNativeDrag]
  );

  const handleDragOver = useCallback((e: React.DragEvent, item: FileItem) => {
    // Packages (.app, …) are opaque — never a drop destination, like the Finder.
    if (!item.isDir || item.isPackage || (!onMoveItems && !onDropExternal)) return;
    if (dragPathsRef.current.includes(item.path)) return; // can't drop into itself
    e.preventDefault();
    e.stopPropagation(); // over a folder → don't also light up the background
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes("Files") ? "copy" : "move";
    setDropTarget(item.path);
  }, [onMoveItems, onDropExternal]);

  const handleDrop = useCallback((e: React.DragEvent, item: FileItem) => {
    if (!item.isDir || item.isPackage) return; // non-folders/packages fall through to the background handler
    e.preventDefault();
    e.stopPropagation(); // handled here — don't also drop into the current dir
    setDropTarget(null);
    // Files dropped from outside the app (Finder) arrive in dataTransfer.files.
    if (e.dataTransfer.files.length > 0 && onDropExternal) {
      onDropExternal(e.dataTransfer.files, item.path);
      return;
    }
    if (!onMoveItems) return;
    const paths = dragPathsRef.current.filter((p) => p !== item.path);
    dragPathsRef.current = [];
    if (paths.length) onMoveItems(paths, item.path);
  }, [onMoveItems, onDropExternal]);

  // Keep the active selection scrolled into view. Selection movement itself is a
  // behavior (the core.selection module, driven by ↑/↓); this is the pure-UI
  // reaction to it — a sandboxed module has no DOM to scroll.
  useEffect(() => {
    const anchor = selected[selected.length - 1];
    if (!anchor) return;
    const idx = files.findIndex((f) => f.path === anchor.path);
    if (idx >= 0) document.querySelectorAll("#file-list .file-row")[idx]?.scrollIntoView({ block: "nearest" });
  }, [selected, files]);

  return (
    <div
      id="file-list"
      data-menu-zone="background"
      className={bgDrop ? "file-list--drop" : undefined}
      onClick={(e) => { if (e.target === e.currentTarget) onSelect([]); }}
      onDragOver={handleBgDragOver}
      onDragLeave={(e) => { if (e.target === e.currentTarget) setBgDrop(false); }}
      onDrop={handleBgDrop}
    >
      {error ? (
        <div className="file-list-error">
          <span className="file-list-error-icon">⚠️</span>
          <span className="file-list-error-text">{error}</span>
        </div>
      ) : files.length === 0 ? (
        <div className="file-list-empty">This folder is empty</div>
      ) : (
        <>
          <div className="file-list-header" style={gridStyle}>
            {COLUMNS.map((col) => (
              <button
                key={col.key}
                className={`${col.className} col-sort${sort.key === col.key ? " col-sort--active" : ""}`}
                onClick={() => onSortChange(col.key)}
              >
                {col.label}
                {sort.key === col.key && <span className="sort-arrow">{sort.dir === "asc" ? "▲" : "▼"}</span>}
                <span
                  className="col-resize-handle"
                  onMouseDown={(e) => startResize(e, col.key, ew(col.key, BUILTIN_DEFAULT_WIDTH[col.key]))}
                  onClick={(e) => e.stopPropagation()}
                />
              </button>
            ))}
            {columns.map((col) => (
              <span
                key={col.id}
                className={`col-extra col-extra--header${col.align === "end" ? " col-extra--end" : ""}`}
              >
                {col.label}
                <span
                  className="col-resize-handle"
                  onMouseDown={(e) => startResize(e, col.id, ew(col.id, col.width ?? 100))}
                />
              </span>
            ))}
          </div>
          <div className="file-list-body">
            {files.map((item) => (
              <div
                key={item.path}
                draggable
                style={gridStyle}
                data-menu-zone="file"
                className={[
                  "file-row",
                  selectedPaths.has(item.path) ? "selected" : "",
                  cutPaths.has(item.path) ? "cut" : "",
                  dropTarget === item.path ? "drop-target" : "",
                  item.isHidden ? "file-row--hidden" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={(e) => handleClick(e, item)}
                onContextMenu={() => { if (!selectedPaths.has(item.path)) onSelect([item]); }}
                onAuxClick={(e) => {
                  if (e.button === 1 && onMiddleClick) { e.preventDefault(); onMiddleClick(item); }
                }}
                onDoubleClick={(e) => {
                  if ((e.ctrlKey || e.metaKey) && onModifierOpen) {
                    onModifierOpen(item, { ctrl: e.ctrlKey, meta: e.metaKey });
                  } else {
                    onOpen(item);
                  }
                }}
                onDragStart={(e) => handleDragStart(e, item)}
                onDragOver={(e) => handleDragOver(e, item)}
                onDragLeave={() => setDropTarget((t) => (t === item.path ? null : t))}
                onDrop={(e) => handleDrop(e, item)}
              >
                <span className="col-name">
                  <FileIcon item={item} />
                  {item.name}
                </span>
                <span className="col-date">{formatDate(item.modified)}</span>
                <span className="col-type">
                  {item.isDir && !item.isPackage
                    ? "Folder"
                    : item.extension?.toUpperCase() ?? "File"}
                </span>
                <span className="col-size">{item.isDir ? "—" : formatSize(item.size)}</span>
                {columns.map((col) => (
                  <span
                    key={col.id}
                    className={`col-extra${col.align === "end" ? " col-extra--end" : ""}`}
                  >
                    {renderCell(cellData?.[item.path]?.[col.id])}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
