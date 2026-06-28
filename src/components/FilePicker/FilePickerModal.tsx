import { useState, useEffect, useCallback, useMemo } from "react";
import type { FileItem, DialogPickFileOptions } from "../../core/types";
import type { SortState, SortKey } from "../../core/stores/listing.types";
import { FileSystemRegistry } from "../../core/file-system/FileSystemRegistry";
import { ModuleRegistry } from "../../core/module-registry/ModuleRegistry";
import { HomeStore } from "../../core/stores/HomeStore";
import { Breadcrumb } from "../Breadcrumb/Breadcrumb";
import { FileBrowser } from "../FileBrowser/FileBrowser";
import "./FilePicker.css";

interface FilePickerModalProps {
  options: DialogPickFileOptions;
  /** Directory to open at (App passes options.initialDir ?? current directory). */
  initialDir: string;
  /** Resolve the host.dialog.pickFile() promise with the chosen path, or null. */
  onPick: (path: string | null) => void;
}

const EMPTY: FileItem[] = [];
const DEFAULT_SORT: SortState = { key: "name", dir: "asc" };

/** Dirs first, then by the active sort key (mirrors the main list). */
function sortFiles(files: FileItem[], sort: SortState): FileItem[] {
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...files].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    switch (sort.key) {
      case "size": return (a.size - b.size) * dir;
      case "date": return (a.modified - b.modified) * dir;
      case "type": return (a.extension ?? "").localeCompare(b.extension ?? "") * dir;
      default: return a.name.localeCompare(b.name) * dir;
    }
  });
}

/**
 * A Mutka-native file picker used by the `dialog.pickFile` capability: a modal that
 * reuses the real browsing components — the `Places` sidebar (Home + module-
 * contributed locations like WebDAV mounts), the `Breadcrumb`, and the `FileList`.
 * Folders navigate; the chosen file resolves the promise. `options.fileNames` limits
 * what counts as a valid pick (e.g. only `index.js`). Listings come via
 * `FileSystemRegistry`, so provider schemes (`webdav:`…) work too.
 */
export function FilePickerModal({ options, initialDir, onPick }: FilePickerModalProps) {
  const [dir, setDir] = useState(initialDir);
  const [items, setItems] = useState<FileItem[]>([]);
  const [selected, setSelected] = useState<FileItem[]>([]);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => ModuleRegistry.getSidebarItemGroups(), []);
  const sortedItems = useMemo(() => sortFiles(items, sort), [items, sort]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setSelected([]);
    FileSystemRegistry.readDir(dir)
      .then((res) => { if (!cancelled) setItems(res); })
      .catch((e) => { if (!cancelled) { setItems([]); setError(String(e instanceof Error ? e.message : e)); } });
    return () => { cancelled = true; };
  }, [dir]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onPick(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onPick]);

  const mode = options.mode ?? "file";

  const pickable = useCallback(
    (item: FileItem): boolean => {
      if (mode === "folder") return item.isDir;
      if (mode === "any") return !item.isDir ? (!options.fileNames || options.fileNames.includes(item.name)) : true;
      return !item.isDir && (!options.fileNames || options.fileNames.includes(item.name));
    },
    [options.fileNames, mode]
  );

  const handleSelect = useCallback((sel: FileItem[]) => setSelected(sel.filter(pickable)), [pickable]);

  const handleOpen = useCallback((item: FileItem) => {
    if (item.isDir && mode === "file") setDir(item.path);
    else if (item.isDir && (mode === "folder" || mode === "any")) setDir(item.path);
    else if (pickable(item)) onPick(item.path);
  }, [pickable, onPick, mode]);

  const handleSort = useCallback((key: SortKey) => {
    setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));
  }, []);

  const chosen = selected[0] ?? null;
  const canPickFolder = mode === "folder" || mode === "any";

  return (
    <div className="filepicker-backdrop" onClick={() => onPick(null)}>
      <div className="filepicker" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Pick a file">
        <div className="filepicker-header">{options.title ?? "Select a file"}</div>

        <FileBrowser
          places={{
            groups,
            homeDir: HomeStore.homeDir,
            currentDir: dir,
            onNavigate: setDir,
            onRunCommand: () => {},
            onRemoveItem: () => {},
          }}
          header={
            <div className="filepicker-breadcrumb">
              <Breadcrumb path={dir} onNavigate={setDir} />
            </div>
          }
          fileList={{
            files: sortedItems,
            selected,
            cutItems: EMPTY,
            sort,
            currentDir: dir,
            error,
            onSelect: handleSelect,
            onOpen: handleOpen,
            onSortChange: handleSort,
          }}
        />

        <div className="filepicker-actions">
          <button className="filepicker-cancel" onClick={() => onPick(null)}>Cancel</button>
          {canPickFolder && (
            <button className="filepicker-select" onClick={() => onPick(dir)}>
              Open Current Folder
            </button>
          )}
          {mode !== "folder" && (
            <button className="filepicker-select" onClick={() => chosen && onPick(chosen.path)} disabled={!chosen}>
              {chosen ? `Open "${chosen.name}"` : "Select a file"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
