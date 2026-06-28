import { useState, useEffect, useCallback } from "react";
import type { FileItem, DialogPickFileOptions } from "../../core/types";
import { FileSystemRegistry } from "../../core/file-system/FileSystemRegistry";
import "./FilePicker.css";

interface FilePickerModalProps {
  options: DialogPickFileOptions;
  /** Directory to open at (App passes options.initialDir ?? current directory). */
  initialDir: string;
  /** Resolve the host.dialog.pickFile() promise with the chosen path, or null. */
  onPick: (path: string | null) => void;
}

/** The parent directory of an absolute path. */
function parentDir(p: string): string {
  const trimmed = p.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx <= 0 ? "/" : trimmed.slice(0, idx);
}

/**
 * A Mutka-native file picker: a modal file browser (its own little Mutka instance)
 * used by the `dialog.pickFile` capability. Folders navigate; files are selectable,
 * dimmed when they don't match `options.fileNames` (e.g. only `index.js`). Resolves
 * with the chosen path or null. Pure UI — reads listings via FileSystemRegistry.
 */
export function FilePickerModal({ options, initialDir, onPick }: FilePickerModalProps) {
  const [dir, setDir] = useState(initialDir);
  const [items, setItems] = useState<FileItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelected(null);
    FileSystemRegistry.readDir(dir)
      .then((res) => { if (!cancelled) setItems(res); })
      .catch((e) => { if (!cancelled) setError(String(e instanceof Error ? e.message : e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dir]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onPick(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onPick]);

  const selectable = useCallback(
    (item: FileItem): boolean =>
      !item.isDir && (!options.fileNames || options.fileNames.includes(item.name)),
    [options.fileNames]
  );

  const onRowClick = (item: FileItem): void => {
    if (item.isDir) setDir(item.path);
    else if (selectable(item)) setSelected((s) => (s === item.path ? null : item.path));
  };

  const onRowDoubleClick = (item: FileItem): void => {
    if (item.isDir) setDir(item.path);
    else if (selectable(item)) onPick(item.path);
  };

  return (
    <div className="filepicker-backdrop" onClick={() => onPick(null)}>
      <div className="filepicker" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Pick a file">
        <div className="filepicker-header">{options.title ?? "Select a file"}</div>
        <div className="filepicker-path">
          <button className="filepicker-up" onClick={() => setDir(parentDir(dir))} disabled={dir === "/"} title="Up">↑</button>
          <span className="filepicker-dir" title={dir}>{dir}</span>
        </div>

        <div className="filepicker-list">
          {loading && <div className="filepicker-empty">Loading…</div>}
          {error && <div className="filepicker-error">{error}</div>}
          {!loading && !error && items.length === 0 && <div className="filepicker-empty">Empty folder</div>}
          {!loading && !error && items.map((item) => {
            const ok = item.isDir || selectable(item);
            return (
              <div
                key={item.path}
                className={`filepicker-row${item.path === selected ? " filepicker-row--selected" : ""}${ok ? "" : " filepicker-row--disabled"}`}
                onClick={() => onRowClick(item)}
                onDoubleClick={() => onRowDoubleClick(item)}
              >
                <span className="filepicker-row-icon">{item.isDir ? "📁" : "📄"}</span>
                <span className="filepicker-row-name">{item.name}</span>
              </div>
            );
          })}
        </div>

        <div className="filepicker-actions">
          <button className="filepicker-cancel" onClick={() => onPick(null)}>Cancel</button>
          <button className="filepicker-select" onClick={() => selected && onPick(selected)} disabled={!selected}>
            Select
          </button>
        </div>
      </div>
    </div>
  );
}
