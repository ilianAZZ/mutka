import { useCallback, useEffect, useRef, useState } from "react";
import { FileItem } from "../../core/types";
import type { SortKey, SortState } from "../../core/stores/listing.types";
import { FileIcon } from "./FileIcon";
import "./FileList.css";

interface Props {
  files: FileItem[];
  selected: FileItem[];
  cutItems: FileItem[];
  sort: SortState;
  /** The directory currently shown — destination for drops on the empty area. */
  currentDir: string;
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

export function FileList({
  files, selected, cutItems, sort, error, currentDir,
  onSelect, onOpen, onSortChange, onModifierOpen, onMiddleClick, onMoveItems, onDropExternal,
}: Props) {
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
      const paths = selectedPaths.has(item.path) ? selected.map((f) => f.path) : [item.path];
      dragPathsRef.current = paths;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", paths.join("\n"));
    },
    [selected, selectedPaths]
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
          <div className="file-list-header">
            {COLUMNS.map((col) => (
              <button
                key={col.key}
                className={`${col.className} col-sort${sort.key === col.key ? " col-sort--active" : ""}`}
                onClick={() => onSortChange(col.key)}
              >
                {col.label}
                {sort.key === col.key && <span className="sort-arrow">{sort.dir === "asc" ? "▲" : "▼"}</span>}
              </button>
            ))}
          </div>
          <div className="file-list-body">
            {files.map((item) => (
              <div
                key={item.path}
                draggable
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
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
