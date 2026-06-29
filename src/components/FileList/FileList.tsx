import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FileItem } from "../../core/types";
import type { SortKey, SortState } from "../../core/stores/listing.types";
import type { ColumnDescriptor, ColumnCellState } from "../../core/columns/column.types";
import { FileIconRegistry } from "../../core/file-icons/FileIconRegistry";
import { EventBus } from "../../core/event-bus/EventBus";
import { Events } from "../../core/event-bus/events";
import { FileRow } from "./FileRow";
import "./FileList.css";

interface Props {
  files: FileItem[];
  selected: FileItem[];
  cutItems: FileItem[];
  sort: SortState;
  currentDir: string;
  extraColumns?: ColumnDescriptor[];
  cellData?: Record<string, Record<string, ColumnCellState>>;
  columnWidths?: Record<string, number>;
  onColumnResize?: (id: string, width: number) => void;
  error?: string | null;
  onSelect: (items: FileItem[]) => void;
  onOpen: (item: FileItem) => void;
  onSortChange: (key: SortKey) => void;
  onModifierOpen?: (item: FileItem, modifiers: { ctrl: boolean; meta: boolean }) => void;
  onMiddleClick?: (item: FileItem) => void;
  onMoveItems?: (paths: string[], destPath: string) => void;
  onDropExternal?: (files: FileList, destPath: string) => void;
  onNativeDrag?: (items: FileItem[]) => void;
  onRendered?: (count: number) => void;
}

const ROW_HEIGHT = 26;

const COLUMNS: { key: SortKey; label: string; className: string }[] = [
  { key: "name", label: "Name", className: "col-name" },
  { key: "date", label: "Date modified", className: "col-date" },
  { key: "type", label: "Type", className: "col-type" },
  { key: "size", label: "Size", className: "col-size" },
];

const BUILTIN_DEFAULT_WIDTH: Record<string, number> = { name: 280, date: 180, type: 100, size: 90 };

export function FileList({
  files, selected, cutItems, sort, error, currentDir, extraColumns, cellData, columnWidths, onColumnResize,
  onSelect, onOpen, onSortChange, onModifierOpen, onMiddleClick, onMoveItems, onDropExternal, onNativeDrag,
  onRendered,
}: Props) {
  const columns = extraColumns ?? [];

  useLayoutEffect(() => { onRendered?.(files.length); }, [files]);

  useEffect(() => { FileIconRegistry.prefetch(files); }, [files]);

  // ── Lifted icon resolution: ONE subscription instead of per-row ──────────
  const [iconVersion, setIconVersion] = useState(0);
  useEffect(() => EventBus.on(Events.Icons.settled, () => setIconVersion((v) => v + 1)), []);

  const iconMap = useMemo(() => {
    void iconVersion;
    const map = new Map<string, string | null>();
    for (const item of files) map.set(item.path, FileIconRegistry.resolveSync(item));
    return map;
  }, [files, iconVersion]);

  // ── Memoized Sets — selecting one file no longer rebuilds every row ──────
  const selectedPaths = useMemo(() => new Set(selected.map((f) => f.path)), [selected]);
  const cutPaths = useMemo(() => new Set(cutItems.map((f) => f.path)), [cutItems]);

  // ── Column grid template ────────────────────────────────────────────────
  const ew = useCallback(
    (id: string, def: number) => columnWidths?.[id] ?? def,
    [columnWidths],
  );
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

  // ── Virtualization ──────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // ── Stable handlers via live ref (never change identity → memo works) ───
  const dragPathsRef = useRef<string[]>([]);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [bgDrop, setBgDrop] = useState(false);

  const live = useRef({
    files, selected, selectedPaths, currentDir,
    onSelect, onOpen, onModifierOpen, onMiddleClick, onMoveItems, onDropExternal, onNativeDrag,
  });
  live.current = {
    files, selected, selectedPaths, currentDir,
    onSelect, onOpen, onModifierOpen, onMiddleClick, onMoveItems, onDropExternal, onNativeDrag,
  };

  const handleClick = useCallback((e: React.MouseEvent, item: FileItem) => {
    const { files: f, selected: sel, selectedPaths: sp, onSelect: os } = live.current;
    if (e.metaKey || e.ctrlKey) {
      if (sp.has(item.path)) {
        os(sel.filter((s) => s.path !== item.path));
      } else {
        os([...sel, item]);
      }
    } else if (e.shiftKey && sel.length > 0) {
      const last = sel[sel.length - 1];
      const lastIdx = f.findIndex((fi) => fi.path === last.path);
      const thisIdx = f.findIndex((fi) => fi.path === item.path);
      const [from, to] = lastIdx < thisIdx ? [lastIdx, thisIdx] : [thisIdx, lastIdx];
      os(f.slice(from, to + 1));
    } else {
      os([item]);
    }
  }, []);

  const handleContextMenu = useCallback((item: FileItem) => {
    const { selectedPaths: sp, onSelect: os } = live.current;
    if (!sp.has(item.path)) os([item]);
  }, []);

  const handleAuxClick = useCallback((e: React.MouseEvent, item: FileItem) => {
    const mc = live.current.onMiddleClick;
    if (e.button === 1 && mc) { e.preventDefault(); mc(item); }
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent, item: FileItem) => {
    const { onModifierOpen: mo, onOpen: oo } = live.current;
    if ((e.ctrlKey || e.metaKey) && mo) {
      mo(item, { ctrl: e.ctrlKey, meta: e.metaKey });
    } else {
      oo(item);
    }
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, item: FileItem) => {
    const { selectedPaths: sp, selected: sel, onNativeDrag: nd } = live.current;
    const dragItems = sp.has(item.path) ? sel : [item];
    const paths = dragItems.map((f) => f.path);
    dragPathsRef.current = paths;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", paths.join("\n"));
    nd?.(dragItems);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, item: FileItem) => {
    const { onMoveItems: mi, onDropExternal: de } = live.current;
    if (!item.isDir || item.isPackage || (!mi && !de)) return;
    if (dragPathsRef.current.includes(item.path)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes("Files") ? "copy" : "move";
    setDropTarget(item.path);
  }, []);

  const handleDragLeave = useCallback((item: FileItem) => {
    setDropTarget((t) => (t === item.path ? null : t));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, item: FileItem) => {
    const { onMoveItems: mi, onDropExternal: de } = live.current;
    if (!item.isDir || item.isPackage) return;
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    // Internal drag (our own rows) takes priority — the native drag plugin
    // injects real files into dataTransfer.files, so checking files.length
    // first would misroute an internal move into the external-drop (copy) path.
    const paths = dragPathsRef.current.filter((p) => p !== item.path);
    if (paths.length && mi) {
      dragPathsRef.current = [];
      mi(paths, item.path);
      return;
    }
    dragPathsRef.current = [];
    if (e.dataTransfer.files.length > 0 && de) {
      de(e.dataTransfer.files, item.path);
    }
  }, []);

  // ── Background drop (Finder → empty area → current dir) ─────────────────
  const handleBgDragOver = useCallback((e: React.DragEvent) => {
    if (!live.current.onDropExternal || !e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setBgDrop(true);
  }, []);

  const handleBgDrop = useCallback((e: React.DragEvent) => {
    setBgDrop(false);
    const { onDropExternal: de, currentDir: cd } = live.current;
    if (!de || e.dataTransfer.files.length === 0) return;
    e.preventDefault();
    de(e.dataTransfer.files, cd);
  }, []);

  // ── Scroll-to-selection via virtualizer (no querySelectorAll) ───────────
  useEffect(() => {
    const anchor = selected[selected.length - 1];
    if (!anchor) return;
    const idx = files.findIndex((f) => f.path === anchor.path);
    if (idx >= 0) rowVirtualizer.scrollToIndex(idx, { align: "auto" });
  }, [selected, files, rowVirtualizer]);

  // ── Click empty area to deselect ────────────────────────────────────────
  const handleEmptyClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) live.current.onSelect([]);
  }, []);

  return (
    <div
      id="file-list"
      data-menu-zone="background"
      className={bgDrop ? "file-list--drop" : undefined}
      onClick={handleEmptyClick}
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
          <div
            ref={scrollRef}
            className="file-list-body"
            onClick={handleEmptyClick}
          >
            <div
              className="file-list-virtual"
              style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}
              onClick={handleEmptyClick}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const item = files[virtualRow.index];
                return (
                  <div
                    key={item.path}
                    style={{
                      position: "absolute",
                      top: virtualRow.start,
                      left: 0,
                      width: "100%",
                      height: virtualRow.size,
                    }}
                  >
                    <FileRow
                      item={item}
                      isSelected={selectedPaths.has(item.path)}
                      isCut={cutPaths.has(item.path)}
                      isDropTarget={dropTarget === item.path}
                      isEven={virtualRow.index % 2 === 1}
                      iconSrc={iconMap.get(item.path) ?? null}
                      gridStyle={gridStyle}
                      columns={columns}
                      cellData={cellData?.[item.path]}
                      onClick={handleClick}
                      onContextMenu={handleContextMenu}
                      onAuxClick={handleAuxClick}
                      onDoubleClick={handleDoubleClick}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
